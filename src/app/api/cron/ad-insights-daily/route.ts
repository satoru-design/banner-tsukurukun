import { NextResponse } from 'next/server';
import { fetchAdInsightsForDate, InsightsConfigError } from '@/lib/feedback-loop/insights-client';
import { upsertSnapshots } from '@/lib/feedback-loop/snapshot-upsert';
import { getActiveAccounts, getAccountMetaToken, AccountConfigError } from '@/lib/feedback-loop/accounts';

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
  const accounts = await getActiveAccounts();
  const results: Array<Record<string, unknown>> = [];
  for (const a of accounts) {
    try {
      const token = getAccountMetaToken(a.slug);
      const rows = await fetchAdInsightsForDate(ymd, { metaAdAccountId: a.metaAdAccountId, token });
      const r = await upsertSnapshots(rows);
      results.push({ slug: a.slug, ok: true, fetched: rows.length, matchedAds: r.matchedAds, skippedNoAd: r.skippedNoAd });
    } catch (e) {
      if (e instanceof AccountConfigError || e instanceof InsightsConfigError) {
        console.warn(`[cron/ad-insights-daily] ${a.slug} skipped:`, (e as Error).message);
        results.push({ slug: a.slug, ok: true, skipped: (e as Error).message });
      } else {
        console.error(`[cron/ad-insights-daily] ${a.slug} error:`, e);
        results.push({ slug: a.slug, ok: false });
      }
    }
  }
  return NextResponse.json({ ok: true, date: ymd, accounts: results });
};
