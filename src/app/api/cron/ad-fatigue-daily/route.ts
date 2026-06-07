import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { isFatigued } from '@/lib/feedback-loop/fatigue';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 疲労広告を検知してリストを返す（自動停止はせず通知に留める=景表法/運用安全）。"0 23 * * *" */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const prisma = getPrisma();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const ads = await prisma.metaAd.findMany({
    where: { status: 'active' },
    include: { snapshots: { where: { statDate: { gte: since } }, orderBy: { statDate: 'asc' } } },
  });
  const fatigued: { adId: string; adName: string | null }[] = [];
  for (const ad of ads) {
    if (ad.snapshots.length < 2) continue;
    const ctrs = ad.snapshots.map((s) => Number(s.ctr ?? 0));
    const cpms = ad.snapshots.map((s) => Number(s.cpm ?? 0));
    const today = ad.snapshots[ad.snapshots.length - 1];
    if (
      isFatigued({
        ctrToday: Number(today.ctr ?? 0),
        ctrPeak: Math.max(...ctrs),
        frequency: Number(today.frequency ?? 0),
        cpmToday: Number(today.cpm ?? 0),
        cpmBaseline: cpms.length ? cpms.reduce((a, b) => a + b, 0) / cpms.length : 0,
      })
    ) {
      fatigued.push({ adId: ad.adId, adName: ad.adName });
    }
  }
  return NextResponse.json({ ok: true, fatiguedCount: fatigued.length, fatigued });
};
