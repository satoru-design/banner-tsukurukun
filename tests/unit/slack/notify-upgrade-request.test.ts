import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifyUpgradeRequest } from "@/lib/slack/notify-upgrade-request";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SLACK_WEBHOOK_URL_NEW_USER;
});

describe("notifyUpgradeRequest", () => {
  it("posts to the webhook with email & plan in the body when webhook is set", async () => {
    process.env.SLACK_WEBHOOK_URL_NEW_USER = "https://hooks.slack.test/abc";
    await notifyUpgradeRequest({ email: "user@example.com", plan: "pro" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.slack.test/abc");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.text).toContain("user@example.com");
    expect(body.text).toContain("pro");
  });

  it("does NOT call fetch when webhook is unset", async () => {
    delete process.env.SLACK_WEBHOOK_URL_NEW_USER;
    await notifyUpgradeRequest({ email: "user@example.com", plan: "pro" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
