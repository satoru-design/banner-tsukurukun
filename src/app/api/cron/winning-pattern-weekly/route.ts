import { NextResponse } from 'next/server';
import { aggregateWinningPatterns, defaultFormula } from '@/lib/feedback-loop/aggregate';
import { sendWeeklyAdReport } from '@/lib/slack/ad-report';
import { getActiveAccounts } from '@/lib/feedback-loop/accounts';

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
  const rangeLabel = `${windowStart.toISOString().slice(5, 10).replace('-', '/')}〜${windowEnd.toISOString().slice(5, 10).replace('-', '/')}`;
  const accounts = await getActiveAccounts();
  const out: Array<Record<string, unknown>> = [];
  for (const a of accounts) {
    try {
      const count = await aggregateWinningPatterns({
        accountId: a.id,
        windowStart,
        windowEnd,
        minAdCount: Number(process.env.FEEDBACK_MIN_AD_COUNT ?? '3'),
        minConversions: Number(process.env.FEEDBACK_MIN_CONVERSIONS ?? '10'),
        formula: defaultFormula(),
      });
      out.push({ slug: a.slug, patterns: count });
      try {
        await sendWeeklyAdReport({ id: a.id, slug: a.slug }, rangeLabel);
      } catch (e) {
        console.error(`[winning-pattern-weekly] ${a.slug} report failed:`, e);
      }
    } catch (e) {
      console.error(`[winning-pattern-weekly] ${a.slug} aggregate failed:`, e);
    }
  }
  return NextResponse.json({ ok: true, windowStart: windowStart.toISOString().slice(0, 10), windowEnd: windowEnd.toISOString().slice(0, 10), accounts: out });
};
