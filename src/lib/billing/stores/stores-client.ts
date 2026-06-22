import { z } from "zod";

const BASE_URL = "https://api.coiney.io/api/v1";
const API_VERSION = "2016-10-25";

export interface CreatePaymentParams {
  amount: number;
  subject: string;
  description?: string;
  metadata?: Record<string, string>;
  redirectUrl?: string;
  cancelUrl?: string;
  webhookUrl?: string;
  expiredOn?: string; // YYYY-MM-DD
}

const PaymentSchema = z.object({
  id: z.string(),
  object: z.literal("payment"),
  mode: z.enum(["live", "test"]),
  amount: z.number(),
  currency: z.literal("jpy"),
  status: z.enum(["open", "expired", "paid", "refunded", "cancelled"]),
  paidAt: z.string().nullish(),
  createdAt: z.string(),
  links: z.object({
    paymentUrl: z.string(),
    redirectUrl: z.string().optional(),
    cancelUrl: z.string().optional(),
    webhookUrl: z.string().optional(),
  }),
});

export type StoresPayment = z.infer<typeof PaymentSchema>;
export type StoresStatus = StoresPayment["status"];

function authHeaders(): Record<string, string> {
  const key = process.env.STORES_API_KEY;
  if (!key) throw new Error("STORES_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "X-CoineyPayge-Version": API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function createPayment(p: CreatePaymentParams): Promise<StoresPayment> {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      amount: p.amount,
      currency: "jpy",
      method: "creditcard",
      locale: "ja_JP",
      subject: p.subject,
      description: p.description,
      metadata: p.metadata,
      redirectUrl: p.redirectUrl,
      cancelUrl: p.cancelUrl,
      webhookUrl: p.webhookUrl,
      expiredOn: p.expiredOn,
    }),
  });
  if (!res.ok) {
    throw new Error(`STORES createPayment failed: ${res.status} ${await res.text()}`);
  }
  return PaymentSchema.parse(await res.json());
}

export async function getPayment(id: string): Promise<StoresPayment> {
  const res = await fetch(`${BASE_URL}/payments/${id}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`STORES getPayment failed: ${res.status} ${await res.text()}`);
  }
  return PaymentSchema.parse(await res.json());
}
