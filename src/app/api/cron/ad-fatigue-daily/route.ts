import { NextResponse } from 'next/server';
import { detectFatiguedAds } from '@/lib/feedback-loop/fatigue-query';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 疲労広告を検知してリストを返す（通知のみ・自動停止なし）。"0 23 * * *" */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const fatigued = await detectFatiguedAds();
    return NextResponse.json({ ok: true, fatiguedCount: fatigued.length, fatigued });
  } catch (e) {
    console.error('[cron/ad-fatigue-daily] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
