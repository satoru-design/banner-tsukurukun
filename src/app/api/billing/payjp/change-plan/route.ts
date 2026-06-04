/**
 * POST /api/billing/payjp/change-plan（プラン変更 / 移管 P6）
 *
 * Stripe の downgrade(subscription schedule) / upgrade(checkout) 相当を Pay.jp で再現:
 * - アップグレード（starter→pro→business）: 即時切替 + 日割り（subscriptions.update plan + prorate:true）
 * - ダウングレード（business→pro→starter）: 期末切替予約（subscriptions.update next_cycle_plan）
 *
 * 検証済み SDK 型: SubscriptionUpdateOptions { plan?, prorate?, next_cycle_plan? }
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isPayjpEnabled, getPayjpClient } from '@/lib/billing/payjp-client';
import { getPayjpPlans, type PlanKey } from '@/lib/billing/payjp-plans';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const PLAN_RANK: Record<PlanKey, number> = { starter: 1, pro: 2, business: 3 };

interface RequestBody {
  targetPlan?: string;
}

export const POST = async (req: Request): Promise<Response> => {
  if (!isPayjpEnabled()) {
    return NextResponse.json({ error: 'Pay.jp is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  const targetPlan = body?.targetPlan as PlanKey | undefined;
  if (!targetPlan || !(targetPlan in PLAN_RANK)) {
    return NextResponse.json({ error: 'Invalid targetPlan' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser?.payjpSubscriptionId) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 400 });
    }

    const currentPlan = dbUser.plan as PlanKey;
    if (!(currentPlan in PLAN_RANK)) {
      return NextResponse.json({ error: 'Current plan not changeable' }, { status: 400 });
    }
    if (currentPlan === targetPlan) {
      return NextResponse.json({ error: 'Already on this plan' }, { status: 400 });
    }

    const payjp = getPayjpClient();
    const plans = getPayjpPlans();
    const targetPlanId = plans[targetPlan];
    const isUpgrade = PLAN_RANK[targetPlan] > PLAN_RANK[currentPlan];

    if (isUpgrade) {
      // 即時アップグレード（日割り）
      const updated = await payjp.subscriptions.update(dbUser.payjpSubscriptionId, {
        plan: targetPlanId,
        prorate: true,
      });
      // DB を即時反映（webhook subscription.updated でも同期される）
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          plan: targetPlan,
          planStartedAt: new Date(),
          planExpiresAt: null,
        },
      });
      return NextResponse.json({
        ok: true,
        mode: 'upgrade',
        targetPlan,
        effective: 'immediate',
        currentPeriodEnd: updated.current_period_end
          ? new Date(updated.current_period_end * 1000).toISOString()
          : null,
      });
    }

    // 期末ダウングレード予約
    const updated = await payjp.subscriptions.update(dbUser.payjpSubscriptionId, {
      next_cycle_plan: targetPlanId,
    });
    return NextResponse.json({
      ok: true,
      mode: 'downgrade',
      targetPlan,
      effective: 'period_end',
      scheduledFor: updated.current_period_end
        ? new Date(updated.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (e) {
    console.error('[payjp/change-plan] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
