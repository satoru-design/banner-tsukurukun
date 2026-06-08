import { getPrisma } from '@/lib/prisma';
import { isFatigued } from './fatigue';

export interface FatiguedAd {
  adId: string;
  adName: string | null;
  /** 判定理由（表示用） */
  reason: 'frequency' | 'ctr_drop' | 'cpm_rise';
  detail: string; // 例 'CTRピーク比 -38%' / 'frequency 2.8'
}

/**
 * status='active' の MetaAd を直近14日 snapshot から疲労判定する（通知用・自動停止なし）。
 * snapshot 2件未満の広告はスキップ。
 */
export async function detectFatiguedAds(): Promise<FatiguedAd[]> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const ads = await prisma.metaAd.findMany({
    where: { status: 'active' },
    include: { snapshots: { where: { statDate: { gte: since } }, orderBy: { statDate: 'asc' } } },
  });
  const out: FatiguedAd[] = [];
  for (const ad of ads) {
    if (ad.snapshots.length < 2) continue;
    const ctrs = ad.snapshots.map((s) => Number(s.ctr ?? 0));
    const cpms = ad.snapshots.map((s) => Number(s.cpm ?? 0));
    const today = ad.snapshots[ad.snapshots.length - 1];
    const ctrToday = Number(today.ctr ?? 0);
    const ctrPeak = Math.max(...ctrs);
    const frequency = Number(today.frequency ?? 0);
    const cpmToday = Number(today.cpm ?? 0);
    const cpmBaseline = cpms.length ? cpms.reduce((a, b) => a + b, 0) / cpms.length : 0;
    if (!isFatigued({ ctrToday, ctrPeak, frequency, cpmToday, cpmBaseline })) continue;

    let reason: FatiguedAd['reason'];
    let detail: string;
    if (frequency > 2.5) {
      reason = 'frequency';
      detail = `frequency ${frequency.toFixed(1)}`;
    } else if (ctrPeak > 0 && ctrToday <= ctrPeak * 0.7) {
      reason = 'ctr_drop';
      const dropPct = Math.round((1 - ctrToday / ctrPeak) * 100);
      detail = `CTRピーク比 -${dropPct}%`;
    } else {
      reason = 'cpm_rise';
      const risePct = cpmBaseline > 0 ? Math.round((cpmToday / cpmBaseline - 1) * 100) : 0;
      detail = `CPMベース比 +${risePct}%`;
    }
    out.push({ adId: ad.adId, adName: ad.adName, reason, detail });
  }
  return out;
}
