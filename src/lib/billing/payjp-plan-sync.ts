import { getPrisma } from '@/lib/prisma';
import { getPlanKeyFromPayjpPlanId } from './payjp-plans';
import type { PayjpSubscription } from './payjp-types';

/**
 * Pay.jp Subscription → User.plan 同期（Stripe plan-sync.ts の Pay.jp 版 / 移管 P3）
 *
 * Pay.jp の status: 'active' | 'trial' | 'canceled' | 'paused'
 * - active / trial         → 通常（plan を plan.id から決定）
 * - canceled               → 期末まで現プラン維持（planExpiresAt=current_period_end）。
 *                            free 化は subscription.deleted（即時削除）か planExpiresAt の lazy 判定で行う。
 * - paused（更新課金失敗で自動停止）→ paymentFailedAt を立て、plan は猶予維持
 */

export const findUserByPayjpCustomerId = async (customerId: string) => {
  const prisma = getPrisma();
  return prisma.user.findUnique({ where: { payjpCustomerId: customerId } });
};

/** event.data から userId を解決（metadata 優先、無ければ customerId 逆引き） */
export const resolveUserId = async (
  metadataUserId: string | undefined,
  customerId: string | null
): Promise<string | null> => {
  if (metadataUserId) return metadataUserId;
  if (!customerId) return null;
  const user = await findUserByPayjpCustomerId(customerId);
  return user?.id ?? null;
};

interface SyncOptions {
  resetUsage?: boolean; // subscription.renewed 時のみ true
}

export const syncUserPlanFromPayjpSubscription = async (
  userId: string,
  sub: PayjpSubscription,
  options: SyncOptions = {}
): Promise<void> => {
  const prisma = getPrisma();
  const planKey = getPlanKeyFromPayjpPlanId(sub.plan.id);
  if (!planKey) {
    console.warn(`[payjp-plan-sync] unknown plan id ${sub.plan.id}`);
    return;
  }

  const periodEnd = new Date(sub.current_period_end * 1000);
  const periodStart = new Date(sub.current_period_start * 1000);

  if (sub.status === 'canceled') {
    // 期末まで現プラン維持（解約予約）。plan は触らず planExpiresAt をセット。
    await prisma.user.update({
      where: { id: userId },
      data: {
        payjpSubscriptionId: sub.id,
        planExpiresAt: periodEnd,
        ...(options.resetUsage ? { usageCount: 0, usageResetAt: periodEnd } : {}),
      },
    });
    return;
  }

  if (sub.status === 'paused') {
    // 更新課金失敗で自動停止 → 失敗フラグのみ立てる（plan は猶予維持）
    await prisma.user.update({
      where: { id: userId },
      data: {
        payjpSubscriptionId: sub.id,
        paymentFailedAt: new Date(),
      },
    });
    return;
  }

  // active / trial → 通常同期
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: planKey,
      payjpSubscriptionId: sub.id,
      planStartedAt: periodStart,
      planExpiresAt: null,
      ...(options.resetUsage ? { usageCount: 0, usageResetAt: periodEnd } : {}),
    },
  });
};

/** subscription.deleted（即時削除）→ free 化 */
export const downgradeToFree = async (userId: string): Promise<void> => {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: 'free',
      payjpSubscriptionId: null,
      planExpiresAt: null,
      paymentFailedAt: null,
    },
  });
};
