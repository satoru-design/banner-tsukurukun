import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = {
  invoice: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
};
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));
const getPayment = vi.fn();
vi.mock("@/lib/billing/stores/stores-client", () => ({ getPayment: (...a: unknown[]) => getPayment(...a) }));

import { reconcileInvoice } from "@/lib/billing/stores/reconcile";

beforeEach(() => vi.clearAllMocks());

it("activates the plan and marks invoice paid when STORES reports paid", async () => {
  prisma.invoice.findUnique.mockResolvedValue({
    id: "inv_1", userId: "u1", plan: "pro", status: "issued",
    storesPaymentId: "pay_1", periodStart: new Date("2026-07-01T00:00:00Z"),
  });
  prisma.user.findUnique.mockResolvedValue({ id: "u1", planExpiresAt: null });
  prisma.invoice.update.mockResolvedValue({ id: "inv_1", status: "paid" });
  getPayment.mockResolvedValue({ id: "pay_1", status: "paid", paidAt: "2026-07-02T00:00:00Z" });

  const r = await reconcileInvoice("inv_1");

  expect(r.status).toBe("paid");
  expect(prisma.user.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ plan: "pro" }) }),
  );
});

it("is idempotent: already-paid invoice does not re-activate", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_1", status: "paid", storesPaymentId: "pay_1" });
  const r = await reconcileInvoice("inv_1");
  expect(getPayment).not.toHaveBeenCalled();
  expect(prisma.user.update).not.toHaveBeenCalled();
  expect(r.status).toBe("paid");
});

it("marks invoice overdue when STORES reports expired", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_1", userId: "u1", plan: "pro", status: "issued", storesPaymentId: "pay_1" });
  prisma.invoice.update.mockResolvedValue({ id: "inv_1", status: "overdue" });
  getPayment.mockResolvedValue({ id: "pay_1", status: "expired" });
  const r = await reconcileInvoice("inv_1");
  expect(r.status).toBe("overdue");
  expect(prisma.user.update).not.toHaveBeenCalled();
});
