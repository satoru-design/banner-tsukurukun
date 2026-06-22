import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPayment, getPayment } from "@/lib/billing/stores/stores-client";

const OK = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

const sample = {
  id: "pay_123",
  object: "payment",
  mode: "test",
  amount: 1000,
  currency: "jpy",
  status: "open",
  createdAt: "2026-06-22T00:00:00Z",
  links: { paymentUrl: "https://payge.coiney.io/pay/pay_123" },
};

beforeEach(() => {
  process.env.STORES_API_KEY = "sk_test_dummy";
});
afterEach(() => vi.restoreAllMocks());

describe("createPayment", () => {
  it("posts to /payments with auth headers and returns parsed payment", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(OK(sample));
    const p = await createPayment({ amount: 1000, subject: "Pro 月額", metadata: { userId: "u1" } });
    expect(p.links.paymentUrl).toBe("https://payge.coiney.io/pay/pay_123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.coiney.io/api/v1/payments");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_dummy");
    expect((init!.headers as Record<string, string>)["X-CoineyPayge-Version"]).toBe("2016-10-25");
    const sent = JSON.parse(init!.body as string);
    expect(sent).toMatchObject({ amount: 1000, currency: "jpy", method: "creditcard" });
  });

  it("throws when API returns non-2xx", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 400, text: async () => "bad" } as Response);
    await expect(createPayment({ amount: 1, subject: "x" })).rejects.toThrow(/400/);
  });
});

describe("getPayment", () => {
  it("GETs /payments/{id} and returns parsed payment", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(OK({ ...sample, status: "paid", paidAt: "2026-06-22T01:00:00Z" }));
    const p = await getPayment("pay_123");
    expect(p.status).toBe("paid");
  });
});
