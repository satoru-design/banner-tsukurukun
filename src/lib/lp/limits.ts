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
 *
 * Sprint 3 CR C-1 fix: Free ユーザー (Stripe subscription 無し) の lazy reset。
 *   従来は payment_succeeded webhook のみが usage をリセットしていたため、
 *   Free user は 1 本作ると永久ロックされていた。`lpUsageResetAt` を追加し、
 *   過去日付なら次月 1 日 0:00 にセット + count=1 にリセット。
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

/**
 * 渡した日時の翌月 1 日 00:00:00 を返す（local TZ）。
 * Free user の lpUsageResetAt 次回値として使う。
 */
function nextMonthStart(now: Date): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getLpUsageStatus(userId: string): Promise<LpUsageStatus> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      currentMonthLpUsageCount: true,
      lpUsageResetAt: true,
      stripeCustomerId: true,
    },
  });
  if (!user) throw new Error('User not found');

  const plan = (((user.plan as string) ?? 'free') as LpPlan);
  const now = new Date();
  // C-1 fix: lazy reset — lpUsageResetAt が過去 (or NULL) ならまだ今月生成していない扱い。
  //   この判定は read-only。実際の DB 更新は incrementLpUsage で行う。
  //   NULL は「migration 直後 / まだ一度も生成していない」状態。
  const needsReset = !user.lpUsageResetAt || user.lpUsageResetAt <= now;
  const effectiveUsage = needsReset ? 0 : (user.currentMonthLpUsageCount ?? 0);
  const { soft, hard } = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  return {
    plan,
    currentUsage: effectiveUsage,
    softLimit: soft,
    hardCap: hard,
    isHardBlocked: effectiveUsage >= hard,
    isOverSoft: effectiveUsage >= soft,
    stripeCustomerId: user.stripeCustomerId ?? null,
  };
}

export async function incrementLpUsage(userId: string): Promise<void> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lpUsageResetAt: true, currentMonthLpUsageCount: true },
  });
  if (!user) return;

  const now = new Date();
  // C-1 fix: needsReset 時は count=1 + 次月 1 日 0:00 を lpUsageResetAt にセット。
  //   それ以外は通常通り increment。
  //   nextMonthStart は local TZ（Vercel: UTC）で計算する。月境界が JST 9 時間ずれるが
  //   Free user の月次リセットには影響なし（厳密 JST 月初リセットが必要なら別途調整）。
  const needsReset = !user.lpUsageResetAt || user.lpUsageResetAt <= now;
  if (needsReset) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentMonthLpUsageCount: 1,
        lpUsageResetAt: nextMonthStart(now),
      },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { currentMonthLpUsageCount: { increment: 1 } },
    });
  }
}
