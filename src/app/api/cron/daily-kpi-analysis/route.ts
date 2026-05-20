import { NextResponse } from 'next/server';
import { runDailyAnalysis } from '@/lib/analytics/daily-kpi-analysis';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * Phase A.19: 毎朝の日次 KPI 自動分析 + Slack 投稿。
 *
 * 発火: 毎朝 JST 9:00 (vercel.json: "0 0 * * *" UTC)
 * セキュリティ: Vercel Cron が Bearer CRON_SECRET を送付
 *
 * Slack 通知に Claude API 生成の「3 行所感 + 1 行打ち手」を含める。
 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { kpi, insight } = await runDailyAnalysis();
    return NextResponse.json({
      ok: true,
      date: kpi.dateLabel,
      newUsers: kpi.newUsersExternal.length,
      generations: kpi.totalExternalGenerations,
      paidConversions: kpi.paidConversions,
      insightChars: insight.length,
    });
  } catch (e) {
    console.error('[cron/daily-kpi-analysis] error:', e);
    return NextResponse.json(
      { error: 'Internal error', message: String(e) },
      { status: 500 },
    );
  }
};
