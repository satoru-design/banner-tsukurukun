import { NextResponse } from 'next/server';
import { detectFatiguedAds } from '@/lib/feedback-loop/fatigue-query';
import { getActiveAccounts } from '@/lib/feedback-loop/accounts';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 疲労広告を検知してリストを返す（通知のみ・自動停止なし）。"0 23 * * *" */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const accounts = await getActiveAccounts();
  const out: Array<Record<string, unknown>> = [];
  for (const a of accounts) {
    try {
      const f = await detectFatiguedAds(a.id);
      out.push({ slug: a.slug, fatiguedCount: f.length, fatigued: f });
    } catch (e) {
      console.error(`[ad-fatigue-daily] ${a.slug} failed:`, e);
    }
  }
  return NextResponse.json({ ok: true, accounts: out });
};
