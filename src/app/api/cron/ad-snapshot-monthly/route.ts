import { NextResponse } from 'next/server';
import { sendMonthlyAdSnapshot } from '@/lib/slack/ad-report';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 月次スナップショットを Slack 送信。"0 0 1 * *"（毎月1日 UTC0時=JST9時） */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await sendMonthlyAdSnapshot();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[cron/ad-snapshot-monthly] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
