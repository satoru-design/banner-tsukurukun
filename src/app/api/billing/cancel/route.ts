import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isStripeEnabled, getStripeClient } from '@/lib/billing/stripe-client';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Phase A.17.0: 退会（subscription cancel at period end）
 *
 * - Stripe subscription を `cancel_at_period_end=true` で更新
 * - 期末まで現プラン利用可、その後 plan=free に降格（webhook 経由）
 * - 翌月以降の課金は発生しない
 *
 * UI: SecuritySection の「退会する」ボタンから呼ばれる。
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
    if (!dbUser?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription to cancel' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // 既に schedule（プラン変更予約）が立っている場合は先に release してからキャンセルする
    const sub = await stripe.subscriptions.retrieve(dbUser.stripeSubscriptionId);
    if (sub.schedule) {
      const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id;
      try {
        await stripe.subscriptionSchedules.release(scheduleId);
      } catch (e) {
        console.warn('[cancel] schedule release failed (continuing):', e);
      }
    }

    const updated = await stripe.subscriptions.update(dbUser.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const baseItem = updated.items.data.find(
      (item) => item.price.recurring?.usage_type === 'licensed'
    );
    const periodEnd = baseItem?.current_period_end ?? updated.cancel_at ?? null;

    return NextResponse.json({
      ok: true,
      cancelAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
  } catch (e) {
    console.error('[cancel] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
