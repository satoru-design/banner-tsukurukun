import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * D14 Task 21: LP Maker Pro 2.0 週次サマリ + 赤信号判定 を Slack に投稿。
 * - 新規 sign-up 数 (過去 7 日)
 * - 公開 LP 数 (過去 7 日)
 * - Free→Starter 転換率 = starter / (starter + free) * 100
 * - 赤信号: 非 admin (= starter + free) が 10 以上 かつ 転換率 < 4%
 *
 * 認証: Vercel Cron からの Bearer ${CRON_SECRET}
 * Schedule: vercel.json で "0 0 * * 1" UTC (月曜 JST 9:00)
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const newUsers = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } });
  const starterUsers = await prisma.user.count({ where: { plan: 'starter' } });
  const freeUsers = await prisma.user.count({ where: { plan: 'free' } });
  const publishedThisWeek = await prisma.landingPage.count({
    where: { status: 'published', publishedAt: { gte: weekAgo } },
  });

  const totalNonAdmin = starterUsers + freeUsers;
  const conversionRate = totalNonAdmin > 0 ? (starterUsers / totalNonAdmin) * 100 : 0;
  const isRedAlert = totalNonAdmin >= 10 && conversionRate < 4;

  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `📅 LP Maker Weekly Summary\n新規 sign-up: ${newUsers}\n公開 LP: ${publishedThisWeek}\nFree→Starter 転換率: *${conversionRate.toFixed(1)}%*${isRedAlert ? ' ⚠ 赤信号 (target ≥ 8%)' : ''}`,
        }),
      });
    } catch (e) {
      console.error('[cron lp-kpi-weekly] slack failed', e);
    }
  }

  return NextResponse.json({ newUsers, publishedThisWeek, conversionRate, isRedAlert });
}
