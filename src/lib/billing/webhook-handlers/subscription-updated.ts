import type Stripe from 'stripe';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';

/**
 * Phase A.12: customer.subscription.updated
 *
 * - 即時 upgrade / 解約予約 / schedule 経由予約 / 期末 apply 後の状態変化を全て反映
 * - plan-sync 内部で分岐ロジックが完結
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
