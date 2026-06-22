import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = {
  invoice: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
};
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));
const getPayment = vi.fn();
vi.mock("@/lib/billing/stores/stores-client", () => ({ getPayment: (...a: unknown[]) => getPayment(...a) }));

import { reconcileInvoice } from "@/lib/billing/stores/reconcile";

beforeEach(() => vi.clearAllMocks());

// M3: helper — win case (count=1)
function setupPaidWin() {
  prisma.invoice.findUnique.mockResolvedValue({
    id: "inv_1", userId: "u1", plan: "pro", status: "issued",
    storesPaymentId: "pay_1", periodStart: new Date("2026-07-01T00:00:00Z"),
  });
  prisma.user.findUnique.mockResolvedValue({ id: "u1", planExpiresAt: null });
  prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
  prisma.invoice.findUnique
    .mockResolvedValueOnce({
      id: "inv_1", userId: "u1", plan: "pro", status: "issued",
      storesPaymentId: "pay_1", periodStart: new Date("2026-07-01T00:00:00Z"),
    })
    .mockResolvedValue({ id: "inv_1", status: "paid" });
  getPayment.mockResolvedValue({ id: "pay_1", status: "paid", paidAt: "2026-07-02T00:00:00Z" });
}

it("activates the plan and marks invoice paid when STORES reports paid", async () => {
  setupPaidWin();
  const r = await reconcileInvoice("inv_1");
  expect(r?.status).toBe("paid");
  expect(prisma.user.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ plan: "pro" }) }),
  );
});

it("is idempotent: already-paid invoice does not re-activate", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_1", status: "paid", storesPaymentId: "pay_1" });
  const r = await reconcileInvoice("inv_1");
  expect(getPayment).not.toHaveBeenCalled();
  expect(prisma.user.update).not.toHaveBeenCalled();
  expect(r?.status).toBe("paid");
});

it("marks invoice overdue when STORES reports expired (C3)", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_1", userId: "u1", plan: "pro", status: "issued", storesPaymentId: "pay_1" });
  prisma.invoice.update.mockResolvedValue({ id: "inv_1", status: "overdue" });
  getPayment.mockResolvedValue({ id: "pay_1", status: "expired" });
  const r = await reconcileInvoice("inv_1");
  expect(r?.status).toBe("overdue");
  expect(prisma.user.update).not.toHaveBeenCalled();
});

// C3: STORES "cancelled" (customer cancellation) → terminal "canceled", not dunnable "overdue"
it("marks invoice canceled (not overdue) when STORES reports cancelled (C3)", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_2", userId: "u2", plan: "pro", status: "issued", storesPaymentId: "pay_2" });
  prisma.invoice.update.mockResolvedValue({ id: "inv_2", status: "canceled" });
  getPayment.mockResolvedValue({ id: "pay_2", status: "cancelled" });
  const r = await reconcileInvoice("inv_2");
  expect(r?.status).toBe("canceled");
  expect(prisma.user.update).not.toHaveBeenCalled();
});

// M3: concurrent loser — updateMany returns count=0, user.update must NOT be called
it("does not extend plan when updateMany count=0 (concurrent loser) (M3)", async () => {
  prisma.invoice.findUnique
    .mockResolvedValueOnce({
      id: "inv_3", userId: "u3", plan: "pro", status: "issued",
      storesPaymentId: "pay_3",
    })
    .mockResolvedValue({ id: "inv_3", status: "paid" }); // winner already wrote paid
  prisma.invoice.updateMany.mockResolvedValue({ count: 0 }); // lost the race
  getPayment.mockResolvedValue({ id: "pay_3", status: "paid", paidAt: "2026-07-02T00:00:00Z" });

  await reconcileInvoice("inv_3");

  expect(prisma.user.update).not.toHaveBeenCalled();
});
