import { NextResponse } from 'next/server';
import { sendRetentionNotify } from '@/lib/slack/retention-notify';

export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * Phase A.19: リテンション対象ユーザー (D+1 / D+3 / D+7) を毎朝 Slack に通知。
 *
 * 発火: 毎朝 JST 9:00 (vercel.json: "0 0 * * *" UTC)
 * セキュリティ: Vercel Cron は CRON_SECRET ヘッダーを Bearer 認証として送る
 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await sendRetentionNotify();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron/notify-retention] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
