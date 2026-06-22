import { describe, it, expect, vi, beforeEach } from "vitest";
const send = vi.fn();
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: (...a: unknown[]) => send(...a) } })) }));
import { sendInvoiceEmail } from "@/lib/mail/resend";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.MAIL_FROM = "billing@autobanner.jp";
});

it("sends an email containing the payment url", async () => {
  send.mockResolvedValue({ id: "email_1" });
  await sendInvoiceEmail({ to: "u@example.com", plan: "Pro", paymentUrl: "https://pay/x" });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "u@example.com", from: "billing@autobanner.jp" }));
  const arg = send.mock.calls[0][0];
  expect(arg.html).toContain("https://pay/x");
});

it("throws when RESEND_API_KEY or MAIL_FROM is missing", async () => {
  delete process.env.RESEND_API_KEY;
  await expect(sendInvoiceEmail({ to: "u@example.com", plan: "Pro", paymentUrl: "https://pay/x" })).rejects.toThrow();
});
