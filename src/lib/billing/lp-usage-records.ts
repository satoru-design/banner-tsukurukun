import { getStripeClient } from './stripe-client';

/**
 * D11 Task 16: LP Maker Pro 2.0 — Stripe Billing Meter に LP 生成 overage を 1 件送信
 *
 * - event_name は D11 Task 15 で作成した meter と一致させる (env: STRIPE_LP_METER_EVENT_NAME)
 *   デフォルト: 'lp_generation_overage'
 * - identifier に `lp-<landingPageId>` を使い idempotency 担保
 *   Stripe 側で同 identifier の重複送信は自動 dedupe
 *
 * 失敗時は呼び出し側で catch（fire-and-forget 想定）。UI 体験を優先し、
 * 売上漏れは Stripe Dashboard 監視で検知する。
 */
export async function sendLpMeteredUsage(args: {
  stripeCustomerId: string;
  landingPageId: string;
  value?: number;
}): Promise<void> {
  const stripe = getStripeClient();
  const eventName = process.env.STRIPE_LP_METER_EVENT_NAME ?? 'lp_generation_overage';

  await stripe.billing.meterEvents.create({
    event_name: eventName,
    identifier: `lp-${args.landingPageId}`,
    payload: {
      stripe_customer_id: args.stripeCustomerId,
      value: String(args.value ?? 1),
    },
  });
}
