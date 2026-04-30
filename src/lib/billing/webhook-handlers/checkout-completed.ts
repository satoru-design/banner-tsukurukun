import type Stripe from 'stripe';
import { getStripeClient } from '../stripe-client';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';
import { sendMetaPurchaseEvent } from '../meta-capi';

/**
 * Phase A.12: checkout.session.completed
 *
 * - Subscription mode の Checkout 完了を契機に subscription を引き、
 *   plan-sync で DB 反映（resetUsage: true）
 *
 * Phase A.15: 完了後に Meta Conversion API へ Purchase イベント送信
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

  // Phase A.15: Meta Conversion API に Purchase 送信
  // session.amount_total は最小通貨単位（JPY は無小数なのでそのまま）。
  // event_id に session.id を使い、Pixel 側 fbq('track','Purchase',...,{eventID})
  // と合わせれば dedup される（クライアント側実装は後追い OK）。
  const email = session.customer_details?.email ?? user.email;
  if (email && session.amount_total != null && session.currency) {
    await sendMetaPurchaseEvent({
      email,
      externalId: user.id,
      value: session.amount_total,
      currency: session.currency.toUpperCase(),
      eventId: session.id,
      eventSourceUrl: session.success_url ?? 'https://autobanner.jp/account',
    });
  }
};
