import { NextResponse } from 'next/server';
import { sendMonthlyKpi } from '@/lib/slack/kpi-summary';

export const maxDuration = 120;
export const runtime = 'nodejs';

/**
 * 毎月1日 JST 9:00 発火（vercel.json: "0 0 1 * *" UTC = JST 1日 9:00）
 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await sendMonthlyKpi();
    return NextResponse.json({ ok: true, kind: 'monthly' });
  } catch (e) {
    console.error('[cron/kpi-monthly] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
