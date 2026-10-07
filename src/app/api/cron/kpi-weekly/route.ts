import { NextResponse } from 'next/server';
import { sendWeeklyKpi } from '@/lib/slack/kpi-summary';
import { verifyCronSecret } from '@/lib/auth/verify-bearer-secret';
import { internalErrorResponse } from '@/lib/api/error-response';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * 毎週月曜 JST 9:00 発火（vercel.json: "0 0 * * 1" UTC = JST 月曜 9:00）
 */
export const GET = async (req: Request) => {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await sendWeeklyKpi();
    return NextResponse.json({ ok: true, kind: 'weekly' });
  } catch (e) {
    console.error('[cron/kpi-weekly] error:', e);
    return internalErrorResponse('cron/kpi-weekly', e);
  }
};
