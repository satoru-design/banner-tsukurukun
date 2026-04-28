import type Stripe from 'stripe';
import { findUserByStripeCustomerId } from '../plan-sync';
import { getPrisma } from '@/lib/prisma';

/**
 * Phase A.12: invoice.payment_failed
 *
 * - paymentFailedAt = now() を立てる
 * - plan は変更しない（Stripe Smart Retries が走る間は Pro のまま）
 */
export const handlePaymentFailed = async (
  event: Stripe.InvoicePaymentFailedEvent
): Promise<void> => {
  const invoice = event.data.object;
  if (!invoice.customer) return;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return;

  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: user.id },
    data: { paymentFailedAt: new Date() },
  });
};
