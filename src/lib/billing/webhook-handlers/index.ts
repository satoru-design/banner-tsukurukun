import type Stripe from 'stripe';
import { handleCheckoutCompleted } from './checkout-completed';
import { handleSubscriptionUpdated } from './subscription-updated';
import { handleSubscriptionDeleted } from './subscription-deleted';
import { handlePaymentSucceeded } from './payment-succeeded';
import { handlePaymentFailed } from './payment-failed';

/**
 * Phase A.12: Webhook dispatcher
 *
 * 5 events 以外は no-op（ログのみ）。Stripe には常に ACK を返す方針。
 */
export const dispatchWebhookEvent = async (event: Stripe.Event): Promise<void> => {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event);
      return;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event);
      return;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event);
      return;
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event);
      return;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event);
      return;
    default:
      console.log(`[webhook] ignored event type: ${event.type}`);
  }
};
