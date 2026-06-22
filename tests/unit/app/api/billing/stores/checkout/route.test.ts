import { describe, it, expect, vi, beforeEach } from "vitest";

const issueInvoice = vi.fn();
vi.mock("@/lib/billing/stores/issue-invoice", () => ({ issueInvoice: (...a: unknown[]) => issueInvoice(...a) }));
const getCurrentUserId = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserId: () => getCurrentUserId() }));

import { POST } from "@/app/api/billing/stores/checkout/route";

beforeEach(() => vi.clearAllMocks());

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
