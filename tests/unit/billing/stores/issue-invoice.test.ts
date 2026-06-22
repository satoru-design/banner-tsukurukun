import { describe, it, expect, vi, beforeEach } from "vitest";

// @/lib/prisma exports getPrisma() (not a named `prisma` singleton).
// We override it to return a mock prisma object.
const prisma = {
  invoice: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn().mockResolvedValue({ email: "u@example.com" }) },
};
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));

const createPayment = vi.fn();
vi.mock("@/lib/billing/stores/stores-client", () => ({ createPayment: (...a: unknown[]) => createPayment(...a) }));

const sendInvoiceEmail = vi.fn();
vi.mock("@/lib/mail/resend", () => ({ sendInvoiceEmail: (...a: unknown[]) => sendInvoiceEmail(...a) }));

import { issueInvoice } from "@/lib/billing/stores/issue-invoice";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STORES_AMOUNT_PRO = "9800";
  process.env.STORES_INVOICE_DUE_DAYS = "7";
  process.env.NEXT_PUBLIC_APP_URL = "https://autobanner.jp";
  // restore default user mock after clearAllMocks
  prisma.user.findUnique.mockResolvedValue({ email: "u@example.com" });
});

const periodStart = new Date("2026-07-01T00:00:00Z");

it("returns the existing invoice without calling STORES when one exists for the period", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_1", paymentUrl: "u", status: "issued" });
  const r = await issueInvoice({ userId: "u1", plan: "pro", periodStart });
  expect(r.id).toBe("inv_1");
  expect(createPayment).not.toHaveBeenCalled();
  expect(sendInvoiceEmail).not.toHaveBeenCalled();
});

it("creates a STORES payment and persists an issued invoice when none exists", async () => {
  prisma.invoice.findUnique.mockResolvedValue(null);
  prisma.invoice.create.mockResolvedValue({ id: "inv_new" });
  prisma.invoice.update.mockResolvedValue({ id: "inv_new", paymentUrl: "https://pay/x", storesPaymentId: "pay_x" });
  createPayment.mockResolvedValue({ id: "pay_x", links: { paymentUrl: "https://pay/x" }, status: "open" });
  sendInvoiceEmail.mockResolvedValue({ id: "email_1" });

  const r = await issueInvoice({ userId: "u1", plan: "pro", periodStart });

  expect(createPayment).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 9800, metadata: expect.objectContaining({ userId: "u1", invoiceId: "inv_new" }) }),
  );
  expect(r.paymentUrl).toBe("https://pay/x");
  expect(sendInvoiceEmail).toHaveBeenCalledWith(
    expect.objectContaining({ to: "u@example.com", paymentUrl: "https://pay/x" }),
  );
});
