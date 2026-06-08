import { NextResponse } from 'next/server';
import { fetchAdInsightsForDate, InsightsConfigError } from '@/lib/feedback-loop/insights-client';
import { upsertSnapshots } from '@/lib/feedback-loop/snapshot-upsert';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 前日の ad 単位 Insights を取得して snapshot 化。"0 23 * * *"(UTC)=JST 8:00 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ymd = d.toISOString().slice(0, 10);
  try {
    const rows = await fetchAdInsightsForDate(ymd);
    const result = await upsertSnapshots(rows);
    return NextResponse.json({ ok: true, date: ymd, fetched: rows.length, ...result });
  } catch (e) {
    if (e instanceof InsightsConfigError) {
      console.warn('[cron/ad-insights-daily] skipped:', e.message);
      return NextResponse.json({ ok: true, skipped: true, reason: e.message });
    }
    console.error('[cron/ad-insights-daily] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
