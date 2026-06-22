import { describe, it, expect, vi, beforeEach } from "vitest";

const issueInvoice = vi.fn();
vi.mock("@/lib/billing/stores/issue-invoice", () => ({ issueInvoice: (...a: unknown[]) => issueInvoice(...a) }));
const getCurrentUserId = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserId: () => getCurrentUserId() }));

const prisma = { user: { findUnique: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));

import { POST } from "@/app/api/billing/stores/checkout/route";

beforeEach(() => {
  vi.clearAllMocks();
  // I1: ensure provider is correctly set for all existing tests
  process.env.PAYMENT_PROVIDER = "stores";
  // default: user has no active plan (new signup)
  prisma.user.findUnique.mockResolvedValue({ planExpiresAt: null });
});

function req(body: unknown) {
  return new Request("https://x/api/billing/stores/checkout", { method: "POST", body: JSON.stringify(body) });
}

it("401 when not authenticated", async () => {
  getCurrentUserId.mockResolvedValue(null);
  const res = await POST(req({ plan: "pro" }));
  expect(res.status).toBe(401);
});

it("400 on invalid plan", async () => {
  getCurrentUserId.mockResolvedValue("u1");
  const res = await POST(req({ plan: "free" }));
  expect(res.status).toBe(400);
});

it("returns paymentUrl for a valid upgrade", async () => {
  getCurrentUserId.mockResolvedValue("u1");
  issueInvoice.mockResolvedValue({ id: "inv_1", paymentUrl: "https://pay/x" });
  const res = await POST(req({ plan: "pro" }));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ paymentUrl: "https://pay/x" });
});

it("uses planExpiresAt as periodStart when user has an active plan (renewal)", async () => {
  const futureExpiry = new Date("2026-07-15T00:00:00Z");
  getCurrentUserId.mockResolvedValue("u1");
  prisma.user.findUnique.mockResolvedValue({ planExpiresAt: futureExpiry });
  issueInvoice.mockResolvedValue({ id: "inv_2", paymentUrl: "https://pay/y" });
  await POST(req({ plan: "pro" }));
  expect(issueInvoice).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "u1", periodStart: futureExpiry })
  );
});

// I1: provider split-brain guard — short-circuits before auth
it("409 when PAYMENT_PROVIDER is not stores (I1)", async () => {
  process.env.PAYMENT_PROVIDER = "stripe";
  const res = await POST(req({ plan: "pro" }));
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body).toMatchObject({ error: "provider mismatch" });
  // auth must NOT have been called (short-circuit before auth)
  expect(getCurrentUserId).not.toHaveBeenCalled();
});
