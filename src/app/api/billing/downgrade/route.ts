import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isStripeEnabled, getStripeClient } from '@/lib/billing/stripe-client';
import { getPlanPrices } from '@/lib/billing/prices';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Phase A.12: Pro → Starter ダウングレード（期末切替予約）
 *
 * - Subscription Schedule API で「現期間は Pro / 次期間から Starter」を予約
 * - Webhook (subscription.updated with schedule) を受けて planExpiresAt 反映
 * - 期末到達で schedule が apply され、再度 subscription.updated → 新プラン start
 */
export const POST = async (): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser?.stripeSubscriptionId || dbUser.plan !== 'pro') {
      return NextResponse.json(
        { error: 'Active Pro subscription required' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const prices = getPlanPrices();

    // 既存 subscription を schedule に変換
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: dbUser.stripeSubscriptionId,
    });

    // 現 subscription の period 情報を取得（baseItem.current_period_end が SDK v22 の正しい場所）
    const sub = await stripe.subscriptions.retrieve(dbUser.stripeSubscriptionId);
    const baseItem = sub.items.data.find(
      (item) => item.price.recurring?.usage_type === 'licensed'
    );
    if (!baseItem) {
      return NextResponse.json({ error: 'Pro base item not found' }, { status: 500 });
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

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        {
          items: currentPhaseItems,
          start_date: periodStart,
          end_date: periodEnd,
        },
        {
          items: [{ price: prices.starter.basePriceId, quantity: 1 }],
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      scheduledFor: new Date(periodEnd * 1000).toISOString(),
    });
  } catch (e) {
    console.error('[downgrade] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
