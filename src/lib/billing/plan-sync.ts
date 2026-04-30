import type Stripe from 'stripe';
import { getPrisma } from '@/lib/prisma';
import { getPlanFromPriceId } from './prices';

/**
 * Phase A.12: Stripe Subscription → User.plan 同期の中核ロジック
 *
 * Webhook 系イベントの DB 反映は全てこの関数に集約。
 * 仕様変更時の修正点が 1 ファイルで済む。
 *
 * Subscription 側の状態:
 * - active + cancel_at_period_end=false → 通常 (plan=base price のプラン)
 * - active + cancel_at_period_end=true → 解約予約 (plan=current の維持、planExpiresAt セット)
 * - active + schedule.id がある → プラン切替予約 (plan=current の維持、planExpiresAt セット)
 * - canceled → free 化 (plan='free', stripeSubscriptionId=NULL)
 *
 * NOTE: Stripe SDK v22 では current_period_end / current_period_start は
 * Subscription オブジェクト直下ではなく SubscriptionItem 側にある。
 * baseItem.current_period_end / current_period_start を使用。
 */

interface SyncOptions {
  resetUsage?: boolean; // payment_succeeded 時のみ true
}

export const syncUserPlanFromSubscription = async (
  userId: string,
  subscription: Stripe.Subscription,
  options: SyncOptions = {}
): Promise<void> => {
  const prisma = getPrisma();
  const status = subscription.status;
  const baseItem = subscription.items.data.find((item) => {
    const recurring = item.price.recurring;
    return recurring && recurring.usage_type === 'licensed';
  });
  if (!baseItem) {
    console.warn(`[plan-sync] no licensed base item for subscription ${subscription.id}`);
    return;
  }

  const planFromPrice = getPlanFromPriceId(baseItem.price.id);
  if (!planFromPrice) {
    console.warn(`[plan-sync] unknown priceId ${baseItem.price.id}`);
    return;
  }

  // current_period_end は SubscriptionItem レベルにある（SDK v22）
  const periodEnd = new Date(baseItem.current_period_end * 1000);
  const periodStart = new Date(baseItem.current_period_start * 1000);

  if (status === 'canceled' || status === 'incomplete_expired') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'free',
        stripeSubscriptionId: null,
        planExpiresAt: null,
        paymentFailedAt: null,
      },
    });
    return;
  }

  // schedule (future plan change) / cancel_at_period_end / cancel_at (Stripe 新仕様) → plan は維持、planExpiresAt セット
  // NOTE: 最新の Customer Portal は「キャンセル」操作時に cancel_at_period_end ではなく
  // cancel_at (Unix timestamp) をセットする。両方を見ないと NULL 上書きが発生する。
  const cancelAt = subscription.cancel_at;
  const isPendingChange = !!subscription.schedule || subscription.cancel_at_period_end || !!cancelAt;

  if (isPendingChange) {
    const expiresAt = cancelAt ? new Date(cancelAt * 1000) : periodEnd;
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        planExpiresAt: expiresAt,
        ...(options.resetUsage
          ? { usageCount: 0, usageResetAt: periodEnd }
          : {}),
      },
    });
    return;
  }

  // 通常の active 状態 → plan を base price から決定して同期
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: planFromPrice,
      stripeSubscriptionId: subscription.id,
      planStartedAt: periodStart,
      planExpiresAt: null,
      ...(options.resetUsage
        ? { usageCount: 0, usageResetAt: periodEnd }
        : {}),
    },
  });
};

/**
 * Stripe Customer ID から DB User を引く
 */
export const findUserByStripeCustomerId = async (customerId: string) => {
  const prisma = getPrisma();
  return prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
};
