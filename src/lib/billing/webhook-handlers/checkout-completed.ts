import type Stripe from 'stripe';
import { getStripeClient } from '../stripe-client';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';

/**
 * Phase A.12: checkout.session.completed
 *
 * - Subscription mode の Checkout 完了を契機に subscription を引き、
 *   plan-sync で DB 反映（resetUsage: true）
 */
export const handleCheckoutCompleted = async (
  event: Stripe.CheckoutSessionCompletedEvent
): Promise<void> => {
  const session = event.data.object;
  if (session.mode !== 'subscription' || !session.subscription || !session.customer) return;

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    console.error('[checkout-completed] user not found for customer', customerId);
    return;
  }

  const stripe = getStripeClient();
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subId);
  await syncUserPlanFromSubscription(user.id, subscription, { resetUsage: true });
};
