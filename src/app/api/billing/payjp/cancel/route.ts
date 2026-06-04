/**
 * POST /api/billing/payjp/cancel（退会＝期末解約 / 移管 P4）
 *
 * Stripe の cancel_at_period_end 相当。Pay.jp の subscriptions.cancel は
 * 更新課金を停止し、current_period_end まで現プランを維持する（期末解約）。
 * その後 free 化は webhook(subscription.canceled→planExpiresAt) + lazy 判定で行う。
 *
 * NOTE: 即時解約が必要なら subscriptions.delete を使うが、ここは UX 上「期末まで利用可」を採用。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isPayjpEnabled, getPayjpClient } from '@/lib/billing/payjp-client';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const POST = async (): Promise<Response> => {
  if (!isPayjpEnabled()) {
    return NextResponse.json({ error: 'Pay.jp is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser?.payjpSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription to cancel' },
        { status: 400 }
      );
    }

    const payjp = getPayjpClient();
    const canceled = await payjp.subscriptions.cancel(dbUser.payjpSubscriptionId);

    const periodEnd = canceled.current_period_end
      ? new Date(canceled.current_period_end * 1000)
      : null;

    // 期末まで現プラン維持（webhook でも同期されるが UI 即時反映のため先行更新）
    await prisma.user.update({
      where: { id: user.userId },
      data: { planExpiresAt: periodEnd },
    });

    return NextResponse.json({
      ok: true,
      cancelAt: periodEnd ? periodEnd.toISOString() : null,
    });
  } catch (e) {
    console.error('[payjp/cancel] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
