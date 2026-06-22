export type PaidPlan = "starter" | "pro" | "business";

const ENV_KEY: Record<PaidPlan, string> = {
  starter: "STORES_AMOUNT_STARTER",
  pro: "STORES_AMOUNT_PRO",
  business: "STORES_AMOUNT_BUSINESS",
};

export function monthlyAmount(plan: PaidPlan): number {
  const key = ENV_KEY[plan];
  const raw = process.env[key];
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1) {
    throw new Error(`${key} is not set to a valid positive integer (got: ${raw})`);
  }
  return n;
}
