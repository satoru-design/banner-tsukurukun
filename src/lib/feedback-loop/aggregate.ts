import { getPrisma } from '@/lib/prisma';
import { extractTags } from './tag-extract';
import { scorePatterns, type ScoreFormula } from './winning-score';
import type { AggregatedTagStat, TagDim } from './types';

export interface AggregateOptions {
  windowStart: Date; // 集計開始日（含む）
  windowEnd: Date; // 集計終了日（含む）
  minAdCount: number;
  minConversions: number;
  formula: ScoreFormula;
}

/** 環境変数からデフォルト ScoreFormula を読む */
export function defaultFormula(): ScoreFormula {
  const f = process.env.FEEDBACK_SCORE_FORMULA;
  return f === 'ctr' || f === 'roas' ? f : 'cpa';
}

/**
 * 窓内の snapshot を MetaAd→GenerationImage→Generation.briefSnapshot に辿り、
 * タグ次元ごとに成果を合算 → scorePatterns → WinningPattern upsert（窓単位で置換）。
 * 返り値は採用された WinningPattern 数。
 */
export async function aggregateWinningPatterns(opts: AggregateOptions): Promise<number> {
  const prisma = getPrisma();

  const snapshots = await prisma.adPerformanceSnapshot.findMany({
    where: { statDate: { gte: opts.windowStart, lte: opts.windowEnd } },
    include: {
      metaAd: {
        include: {
          generationImage: { include: { generation: true } },
        },
      },
    },
  });

  const acc = new Map<string, AggregatedTagStat & { _ads: Set<string> }>();

  for (const s of snapshots) {
    const gi = s.metaAd.generationImage;
    if (!gi || !gi.generation) continue;
    const brief = gi.generation.briefSnapshot;
    const tags: TagDim[] = extractTags(brief, { size: gi.size, provider: gi.provider });

    for (const t of tags) {
      const key = `${t.dimension}|${t.value}`;
      const cur =
        acc.get(key) ??
        ({
          dimension: t.dimension,
          value: t.value,
          adCount: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          _ads: new Set<string>(),
        } as AggregatedTagStat & { _ads: Set<string> });
      cur.impressions += s.impressions;
      cur.clicks += s.clicks;
      cur.conversions += s.conversions;
      cur.spend += Number(s.spend);
      cur._ads.add(s.metaAdId);
      acc.set(key, cur);
    }
  }

  const stats: AggregatedTagStat[] = [...acc.values()].map((a) => ({
    dimension: a.dimension,
    value: a.value,
    adCount: a._ads.size,
    impressions: a.impressions,
    clicks: a.clicks,
    conversions: a.conversions,
    spend: a.spend,
  }));

  const scored = scorePatterns(stats, {
    minAdCount: opts.minAdCount,
    minConversions: opts.minConversions,
    formula: opts.formula,
  });

  await prisma.winningPattern.deleteMany({
    where: { windowStart: opts.windowStart, windowEnd: opts.windowEnd },
  });
  if (scored.length > 0) {
    await prisma.winningPattern.createMany({
      data: scored.map((p) => ({
        dimension: p.dimension,
        value: p.value,
        windowStart: opts.windowStart,
        windowEnd: opts.windowEnd,
        adCount: p.adCount,
        impressions: p.impressions,
        conversions: p.conversions,
        clicks: p.clicks,
        spend: p.spend,
        avgCtr: p.avgCtr ?? undefined,
        avgCpa: p.avgCpa ?? undefined,
        avgCpc: p.avgCpc ?? undefined,
        score: p.score,
      })),
    });
  }
  return scored.length;
}
