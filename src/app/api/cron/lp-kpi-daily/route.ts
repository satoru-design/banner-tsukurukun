import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * D14 Task 21: LP Maker Pro 2.0 日次 KPI を Slack に投稿。
 * - WAU (北極星): 過去 7 日間に published を持つ unique user 数
 * - 日次公開数: 過去 24h に publishedAt がセットされた LP 件数
 *
 * 認証: Vercel Cron からの Bearer ${CRON_SECRET}
 * Schedule: vercel.json で "0 23 * * *" UTC (JST 8:00)
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const wauUsers = await prisma.landingPage.findMany({
    where: { status: 'published', publishedAt: { gte: weekAgo } },
    distinct: ['userId'],
    select: { userId: true },
  });
  const wau = wauUsers.length;

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dailyPublished = await prisma.landingPage.count({
    where: { status: 'published', publishedAt: { gte: dayAgo } },
  });

  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `📊 LP Maker Daily KPI\nWAU (北極星): *${wau}*\n本日公開: ${dailyPublished} 本`,
        }),
      });
    } catch (e) {
      console.error('[cron lp-kpi-daily] slack failed', e);
    }
  }

  return NextResponse.json({ wau, dailyPublished });
}
