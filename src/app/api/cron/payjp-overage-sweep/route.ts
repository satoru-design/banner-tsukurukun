import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { isPayjpEnabled } from '@/lib/billing/payjp-client';
import { billPayjpOverage } from '@/lib/billing/payjp-overage';
import { downgradeToFree } from '@/lib/billing/payjp-plan-sync';

export const maxDuration = 300;
export const runtime = 'nodejs';

/**
 * 日次 Cron: 解約済みサブスクの最終周期 超過課金 + free 化（移管 P5 セーフティネット）
 *
 * 期末解約（subscriptions.cancel）したユーザーには subscription.renewed が来ないため、
 * webhook 経由では最終周期の超過課金が走らない。本 cron が planExpiresAt 経過ユーザーを
 * 拾い、超過を請求（OverageCharge で冪等）してから plan=free に降格する。
 *
 * セキュリティ: Vercel Cron の CRON_SECRET Bearer 認証。
 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPayjpEnabled()) {
    return NextResponse.json({ ok: true, skipped: 'payjp disabled' });
  }

  const prisma = getPrisma();
  const now = new Date();

  // 期末を過ぎた解約予約ユーザー（free/admin は対象外）
  const expired = await prisma.user.findMany({
    where: {
      planExpiresAt: { not: null, lte: now },
      plan: { in: ['starter', 'pro', 'business'] },
    },
    select: { id: true, plan: true, planExpiresAt: true },
  });

  let billed = 0;
  let downgraded = 0;
  const errors: string[] = [];

  for (const u of expired) {
    try {
      if (u.planExpiresAt) {
        const result = await billPayjpOverage(u.id, u.planExpiresAt);
        if (result.billed) billed += 1;
      }
      // 超過課金成功（or 超過なし）後に free 化
      await downgradeToFree(u.id);
      downgraded += 1;
    } catch (e) {
      // 課金失敗時は free 化しない（次回 cron で再試行）
      console.error(`[cron/payjp-overage-sweep] user ${u.id} failed:`, e);
      errors.push(u.id);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: expired.length,
    billed,
    downgraded,
    errors: errors.length,
  });
};
