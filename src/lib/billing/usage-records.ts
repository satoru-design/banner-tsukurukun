import { getStripeClient } from './stripe-client';

/**
 * Phase A.14: Stripe Billing Meter に usage event を 1 件送信
 *
 * - event_name は A.12 で作成した meter と一致させる: 'banner_generation_overage'
 * - identifier に Generation.id を使い idempotency 担保
 * - Stripe 側で同 identifier の重複送信は自動 dedupe
 *
 * 失敗時はログのみ。ユーザー側は成功扱いで進める（売上漏れは Stripe Dashboard 監視で検知）。
 */
export const sendMeteredUsage = async (
  customerId: string,
  generationId: string
): Promise<void> => {
  const stripe = getStripeClient();
  try {
    await stripe.billing.meterEvents.create({
      event_name: 'banner_generation_overage',
      payload: {
        stripe_customer_id: customerId,
        value: '1',
      },
      identifier: generationId,
    });
  } catch (e) {
    console.error(
      '[usage-records] failed to send meter event',
      { customerId, generationId, error: e }
    );
    // ユーザー体験優先: 失敗を握りつぶす
  }
};
