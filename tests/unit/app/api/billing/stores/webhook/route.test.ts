import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { invoice: { findFirst: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));
const reconcileInvoice = vi.fn();
vi.mock("@/lib/billing/stores/reconcile", () => ({ reconcileInvoice: (...a: unknown[]) => reconcileInvoice(...a) }));

import { POST } from "@/app/api/billing/stores/webhook/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STORES_WEBHOOK_SECRET = "secret123";
});

function req(url: string, body: unknown) {
  return new Request(url, { method: "POST", body: JSON.stringify(body) });
}

it("rejects when token is missing or wrong", async () => {
  const res = await POST(req("https://x/api/billing/stores/webhook?token=wrong", {}));
  expect(res.status).toBe(401);
  expect(reconcileInvoice).not.toHaveBeenCalled();
});

it("reconciles the invoice referenced by the payment id", async () => {
  prisma.invoice.findFirst.mockResolvedValue({ id: "inv_1" });
  reconcileInvoice.mockResolvedValue({ id: "inv_1", status: "paid" });
  const res = await POST(req("https://x/api/billing/stores/webhook?token=secret123", { id: "pay_1" }));
  expect(res.status).toBe(200);
  expect(reconcileInvoice).toHaveBeenCalledWith("inv_1");
});
