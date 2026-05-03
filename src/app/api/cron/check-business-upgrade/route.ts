import { NextResponse } from 'next/server';
import { detectBusinessUpgradeCandidates } from '@/lib/billing/upgrade-detection';

export const maxDuration = 300;
export const runtime = 'nodejs';

/**
 * Phase A.17.0 X: 月次 Cron handler
 * Vercel Cron が呼ぶ → UpgradeNotice insert
 *
 * セキュリティ: Vercel Cron は CRON_SECRET ヘッダーを Bearer 認証として送る
 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await detectBusinessUpgradeCandidates();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron/check-business-upgrade] error:', e);
    return NextResponse.json(
      { error: 'Internal error', message: String(e) },
      { status: 500 }
    );
  }
};
