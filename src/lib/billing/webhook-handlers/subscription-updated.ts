import type Stripe from 'stripe';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';

/**
 * Phase A.12: customer.subscription.updated
 *
 * - 即時 upgrade / 解約予約 / schedule 経由予約 / 期末 apply 後の状態変化を全て反映
 * - plan-sync 内部で分岐ロジックが完結
 *
 * Sprint 3 CR C-4 fix: Free → Starter 転換通知は checkout-completed に移管。
 *   subscription.updated は plan 変更以外（cancel 予約・price 変更・metered item 追加等）でも発火するので、
 *   Free → Starter 通知の起点として誤検知が出やすい。新規契約の確定起点は checkout.session.completed 一択。
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

  await syncUserPlanFromSubscription(user.id, subscription);
};
