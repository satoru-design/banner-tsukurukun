import type Stripe from 'stripe';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';
import { getPlanFromPriceId } from '../prices';

/**
 * Phase A.12: customer.subscription.updated
 *
 * - 即時 upgrade / 解約予約 / schedule 経由予約 / 期末 apply 後の状態変化を全て反映
 * - plan-sync 内部で分岐ロジックが完結
 *
 * D14 Task 21: Free → Starter 転換時に Slack 通知（KPI 監視用）
 */
export const handleSubscriptionUpdated = async (
  event: Stripe.CustomerSubscriptionUpdatedEvent
): Promise<void> => {
  const subscription = event.data.object;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    console.error('[subscription-updated] user not found for customer', customerId);
    return;
  }

  // D14: 同期前に「現在の plan」を保持しておく
  const previousPlan = user.plan;

  await syncUserPlanFromSubscription(user.id, subscription);

  // D14: Free → Starter 転換通知 (KPI 監視)
  // - 通常 active 状態 (cancel 予約・schedule 予約なし) のみで転換を検出
  // - subscription の base price から newPlan を算定し、previousPlan=free と比較
  const baseItem = subscription.items.data.find((item) => {
    const recurring = item.price.recurring;
    return recurring && recurring.usage_type === 'licensed';
  });
  const newPlan = baseItem ? getPlanFromPriceId(baseItem.price.id) : null;
  const isNormalActive =
    subscription.status === 'active' &&
    !subscription.cancel_at_period_end &&
    !subscription.cancel_at &&
    !subscription.schedule;

  if (isNormalActive && previousPlan === 'free' && newPlan === 'starter') {
    const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
    if (webhook) {
      fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `💰 Free → Starter 転換! user=${user.email ?? user.id}`,
        }),
      }).catch(() => {});
    }
  }
};
