import { NextResponse } from 'next/server';
import { sendMonthlyAdSnapshot } from '@/lib/slack/ad-report';
import { getActiveAccounts } from '@/lib/feedback-loop/accounts';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 月次スナップショットを Slack 送信。"0 0 1 * *"（毎月1日 UTC0時=JST9時） */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const accounts = await getActiveAccounts();
  for (const a of accounts) {
    try {
      await sendMonthlyAdSnapshot({ id: a.id, slug: a.slug });
    } catch (e) {
      console.error(`[ad-snapshot-monthly] ${a.slug} failed:`, e);
    }
  }
  return NextResponse.json({ ok: true, accounts: accounts.length });
};
