import { NextResponse } from 'next/server';
import { sendDailyKpi } from '@/lib/slack/kpi-summary';
import { verifyCronSecret } from '@/lib/auth/verify-bearer-secret';
import { internalErrorResponse } from '@/lib/api/error-response';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * 毎朝 JST 8:00 発火（vercel.json: "0 23 * * *" UTC）
 * セキュリティ: Vercel Cron は CRON_SECRET ヘッダーを Bearer 認証として送る
 */
export const GET = async (req: Request) => {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await sendDailyKpi();
    return NextResponse.json({ ok: true, kind: 'daily' });
  } catch (e) {
    console.error('[cron/kpi-daily] error:', e);
    return internalErrorResponse('cron/kpi-daily', e);
  }
};
