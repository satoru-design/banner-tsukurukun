import { NextResponse } from 'next/server';
import { aggregateWinningPatterns, defaultFormula } from '@/lib/feedback-loop/aggregate';
import { sendWeeklyAdReport } from '@/lib/slack/ad-report';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 直近7日を集計して WinningPattern を更新。"0 0 * * 1"(UTC月曜)=JST月曜9:00 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const end = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  const windowStart = new Date(start.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const windowEnd = new Date(end.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  try {
    const count = await aggregateWinningPatterns({
      windowStart,
      windowEnd,
      minAdCount: Number(process.env.FEEDBACK_MIN_AD_COUNT ?? '3'),
      minConversions: Number(process.env.FEEDBACK_MIN_CONVERSIONS ?? '10'),
      formula: defaultFormula(),
    });
    try {
      const rangeLabel = `${windowStart.toISOString().slice(5, 10).replace('-', '/')}〜${windowEnd
        .toISOString()
        .slice(5, 10)
        .replace('-', '/')}`;
      await sendWeeklyAdReport(rangeLabel);
    } catch (e) {
      console.error('[cron/winning-pattern-weekly] Slack report failed (continuing):', e);
    }
    return NextResponse.json({
      ok: true,
      windowStart: windowStart.toISOString().slice(0, 10),
      windowEnd: windowEnd.toISOString().slice(0, 10),
      patterns: count,
    });
  } catch (e) {
    console.error('[cron/winning-pattern-weekly] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
