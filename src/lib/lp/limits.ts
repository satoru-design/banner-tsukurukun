/**
 * D11 Task 17: LP Maker Pro 2.0 — plan ベースの LP 生成上限ゲート
 *
 * - Free: 1 本/月 (hard cap = soft limit = 1)
 * - Starter: 5 本/月 (soft limit 5, hard cap 30)
 * - Pro: 20 本/月 (soft limit 20, hard cap 100, 超過分は Stripe Meter で従量課金)
 * - admin: 無制限 (9999 / 9999)
 *
 * soft limit: 超えても生成は通すが、Pro はメータード課金が走る。
 * hard cap: 到達したら 429 を返して完全にブロック（暴走コスト防止）。
 */
import { getPrisma } from '@/lib/prisma';

export const LP_USAGE_LIMIT_FREE = 1;
export const LP_USAGE_LIMIT_STARTER = 5;
export const LP_USAGE_LIMIT_PRO = 20;

export const LP_USAGE_HARDCAP_FREE = 1;
export const LP_USAGE_HARDCAP_STARTER = 30;
export const LP_USAGE_HARDCAP_PRO = 100;

export type LpPlan = 'free' | 'starter' | 'pro' | 'admin';

export interface LpUsageStatus {
  plan: LpPlan;
  currentUsage: number;
  softLimit: number;
  hardCap: number;
  isHardBlocked: boolean;
  isOverSoft: boolean;
  stripeCustomerId: string | null;
}

const PLAN_LIMITS: Record<LpPlan, { soft: number; hard: number }> = {
  free: { soft: LP_USAGE_LIMIT_FREE, hard: LP_USAGE_HARDCAP_FREE },
  starter: { soft: LP_USAGE_LIMIT_STARTER, hard: LP_USAGE_HARDCAP_STARTER },
  pro: { soft: LP_USAGE_LIMIT_PRO, hard: LP_USAGE_HARDCAP_PRO },
  admin: { soft: 9999, hard: 9999 },
};

export async function getLpUsageStatus(userId: string): Promise<LpUsageStatus> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      currentMonthLpUsageCount: true,
      stripeCustomerId: true,
    },
  });
  if (!user) throw new Error('User not found');

  const plan = (((user.plan as string) ?? 'free') as LpPlan);
  const usage = user.currentMonthLpUsageCount ?? 0;
  const { soft, hard } = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  return {
    plan,
    currentUsage: usage,
    softLimit: soft,
    hardCap: hard,
    isHardBlocked: usage >= hard,
    isOverSoft: usage >= soft,
    stripeCustomerId: user.stripeCustomerId ?? null,
  };
}

export async function incrementLpUsage(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { currentMonthLpUsageCount: { increment: 1 } },
  });
}
