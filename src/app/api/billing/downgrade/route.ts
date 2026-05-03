import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isStripeEnabled, getStripeClient } from '@/lib/billing/stripe-client';
import { getPlanPrices, type PlanKey } from '@/lib/billing/prices';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface RequestBody {
  /** ターゲットプラン。指定しない場合は legacy 挙動（Pro→Starter） */
  targetPlan?: 'starter' | 'pro';
}

/**
 * Phase A.12 / A.17.0: 任意プラン降格（期末切替予約）
 *
 * 許可される遷移:
 *   pro      → starter
 *   business → pro
 *   business → starter
 *
 * Subscription Schedule API で「現期間は現プラン / 次期間からターゲットプラン」を予約。
 * Webhook (subscription.updated with schedule) を受けて planExpiresAt 反映。
 */
export const POST = async (req: Request): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;

  try {
    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Active subscription required' },
        { status: 400 }
      );
    }

    const currentPlan = dbUser.plan;
    // legacy fallback: targetPlan 未指定で plan=pro のときだけ pro→starter
    const targetPlan: PlanKey =
      body.targetPlan ?? (currentPlan === 'pro' ? 'starter' : (currentPlan as PlanKey));

    // 許可される遷移チェック
    const allowedTransitions: Record<string, PlanKey[]> = {
      pro: ['starter'],
      business: ['pro', 'starter'],
    };
    const allowed = allowedTransitions[currentPlan];
    if (!allowed || !allowed.includes(targetPlan)) {
      return NextResponse.json(
        { error: `Downgrade ${currentPlan} → ${targetPlan} is not supported` },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const prices = getPlanPrices();

    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: dbUser.stripeSubscriptionId,
    });

    const sub = await stripe.subscriptions.retrieve(dbUser.stripeSubscriptionId);
    const baseItem = sub.items.data.find(
      (item) => item.price.recurring?.usage_type === 'licensed'
    );
    if (!baseItem) {
      return NextResponse.json({ error: 'Base item not found' }, { status: 500 });
    }
    const periodStart = baseItem.current_period_start;
    const periodEnd = baseItem.current_period_end;

    // 現フェーズ items（今の subscription をそのまま継続）
    const currentPhaseItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] =
      sub.items.data.map((item) => {
        const isMetered = item.price.recurring?.usage_type === 'metered';
        return isMetered
          ? { price: item.price.id }
          : { price: item.price.id, quantity: item.quantity ?? 1 };
      });

    // 次フェーズ items（ターゲットプラン）
    const targetConfig = prices[targetPlan];
    const nextPhaseItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] = [
      { price: targetConfig.basePriceId, quantity: 1 },
    ];
    if (targetConfig.meteredPriceId) {
      nextPhaseItems.push({ price: targetConfig.meteredPriceId });
    }

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        {
          items: currentPhaseItems,
          start_date: periodStart,
          end_date: periodEnd,
        },
        {
          items: nextPhaseItems,
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      targetPlan,
      scheduledFor: new Date(periodEnd * 1000).toISOString(),
    });
  } catch (e) {
    console.error('[downgrade] error:', e);
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'resource_already_exists'
    ) {
      return NextResponse.json(
        { error: 'ダウングレードはすでに予約済みです' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
