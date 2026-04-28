import type Stripe from 'stripe';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';

/**
 * Phase A.12: customer.subscription.deleted
 *
 * - 期末解約完了 / 全リトライ失敗 / 手動キャンセル
 * - plan-sync が status=canceled を見て free に戻す
 */
export const handleSubscriptionDeleted = async (
  event: Stripe.CustomerSubscriptionDeletedEvent
): Promise<void> => {
  const subscription = event.data.object;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    console.warn('[subscription-deleted] user not found for customer', customerId);
    return;
  }
  await syncUserPlanFromSubscription(user.id, subscription);
};
