import type Stripe from 'stripe';
import { getStripeClient } from '../stripe-client';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';
import { getPrisma } from '@/lib/prisma';

/**
 * Phase A.12: invoice.payment_succeeded
 *
 * - 月次請求成功 → usageCount=0, usageResetAt=current_period_end
 * - paymentFailedAt = NULL（直前の失敗から回復）
 * - subscription を取り直して plan-sync（resetUsage: true）
 *
 * NOTE: Stripe SDK v22 では Invoice.subscription は廃止。
 * invoice.parent.subscription_details.subscription を使用する。
 */
export const handlePaymentSucceeded = async (
  event: Stripe.InvoicePaymentSucceededEvent
): Promise<void> => {
  const invoice = event.data.object;
  if (!invoice.customer) return;

  // SDK v22: subscription_details は parent.subscription_details に格納
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails?.subscription) return;

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return;

  // plan-sync を先に実行。失敗時は throw → webhook が 500 を返し
  // Stripe がリトライ → idempotency で安全に再実行される。
  // この順序により paymentFailedAt クリアと plan-sync の部分的成功による
  // 中間状態（バナーなし＋usage 未リセット）を回避する。
  const stripe = getStripeClient();
  const subId =
    typeof subDetails.subscription === 'string'
      ? subDetails.subscription
      : subDetails.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subId);
  await syncUserPlanFromSubscription(user.id, subscription, { resetUsage: true });

  // plan-sync 成功後に paymentFailedAt / proOverageNoticeShownAt をクリア
  // Phase A.14: 新月次サイクル開始時に Pro 超過アラート再表示を許可するためリセット
  // D11 Task 16: LP usage (currentMonthLpUsageCount) と Pro LP overage アラートも月初リセット
  //   LP usage は必ず毎月リセットが必要なため、常に update を実行する。
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      paymentFailedAt: null,
      proOverageNoticeShownAt: null,
      currentMonthLpUsageCount: 0,
      proLpOverageNoticeShownAt: null,
    },
  });
};
