import { getPrisma } from '@/lib/prisma';
import type { InsightsRow } from './types';

export interface UpsertResult {
  matchedAds: number; // MetaAd が見つかり upsert した行数
  skippedNoAd: number; // 対応 MetaAd が無く skip した行数
}

/**
 * InsightsRow[] を AdPerformanceSnapshot に冪等 upsert する。
 * - adId → MetaAd を引き、無ければ skip（手動補完前提）
 * - @@unique([metaAdId, statDate]) により同日再実行で重複しない
 */
export async function upsertSnapshots(rows: InsightsRow[]): Promise<UpsertResult> {
  const prisma = getPrisma();
  let matchedAds = 0;
  let skippedNoAd = 0;

  for (const r of rows) {
    if (!r.adId || !r.statDate) {
      skippedNoAd++;
      continue;
    }
    const metaAd = await prisma.metaAd.findUnique({ where: { adId: r.adId } });
    if (!metaAd) {
      skippedNoAd++;
      continue;
    }
    const statDate = new Date(`${r.statDate}T00:00:00.000Z`);
    const data = {
      impressions: r.impressions,
      clicks: r.clicks,
      spend: r.spend,
      conversions: r.conversions,
      ctr: r.ctr ?? undefined,
      cpa: r.cpa ?? undefined,
      cpm: r.cpm ?? undefined,
      frequency: r.frequency ?? undefined,
      roas: r.roas ?? undefined,
      raw: r.raw as object,
    };
    await prisma.adPerformanceSnapshot.upsert({
      where: { metaAdId_statDate: { metaAdId: metaAd.id, statDate } },
      create: { metaAdId: metaAd.id, statDate, ...data },
      update: data,
    });
    matchedAds++;
  }
  return { matchedAds, skippedNoAd };
}
