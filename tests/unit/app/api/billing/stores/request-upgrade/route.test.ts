import { describe, it, expect, vi, beforeEach } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth/get-current-user", () => ({ getCurrentUser: () => getCurrentUser() }));

const notifyUpgradeRequest = vi.fn();
vi.mock("@/lib/slack/notify-upgrade-request", () => ({
  notifyUpgradeRequest: (...a: unknown[]) => notifyUpgradeRequest(...a),
}));

import { POST } from "@/app/api/billing/stores/request-upgrade/route";

beforeEach(() => {
  vi.clearAllMocks();
  notifyUpgradeRequest.mockResolvedValue(undefined);
});

function req(body: unknown) {
  return new Request("https://x/api/billing/stores/request-upgrade", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

it("401 when not authenticated", async () => {
  getCurrentUser.mockResolvedValue({ userId: null, email: null });
  const res = await POST(req({ plan: "pro" }));
  expect(res.status).toBe(401);
  expect(notifyUpgradeRequest).not.toHaveBeenCalled();
});

it("400 on invalid plan", async () => {
  getCurrentUser.mockResolvedValue({ userId: "u1", email: "u@example.com" });
  const res = await POST(req({ plan: "free" }));
  expect(res.status).toBe(400);
  expect(notifyUpgradeRequest).not.toHaveBeenCalled();
});

it("200 + notifies admin on a valid request", async () => {
  getCurrentUser.mockResolvedValue({ userId: "u1", email: "u@example.com" });
  const res = await POST(req({ plan: "pro" }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true });
  expect(body.message).toContain("ご請求書をお送りします");
  expect(notifyUpgradeRequest).toHaveBeenCalledWith({ email: "u@example.com", plan: "pro" });
});

it("still returns 200 when Slack notify throws", async () => {
  getCurrentUser.mockResolvedValue({ userId: "u1", email: "u@example.com" });
  notifyUpgradeRequest.mockRejectedValue(new Error("slack down"));
  const res = await POST(req({ plan: "business" }));
  expect(res.status).toBe(200);
});
