import type { AggregatedTagStat, ScoredPattern } from './types';

export type ScoreFormula = 'cpa' | 'ctr' | 'roas';

export interface ScoreOptions {
  minAdCount: number;
  minConversions: number;
  formula: ScoreFormula;
}

/** 高いほど良い metric を返す（CPA は逆数で「高いほど良い」へ統一） */
function rawMetric(s: AggregatedTagStat, formula: ScoreFormula): number {
  const ctr = s.impressions > 0 ? s.clicks / s.impressions : 0;
  const cpa = s.conversions > 0 ? s.spend / s.conversions : Infinity;
  switch (formula) {
    case 'ctr':
      return ctr;
    case 'roas':
      return s.spend > 0 ? s.conversions / s.spend : 0;
    case 'cpa':
    default:
      return cpa === Infinity ? 0 : 1 / cpa;
  }
}

/**
 * (次元,値) 集計に閾値ガードを適用し、同一 dimension 内で min-max 正規化した score を付与する。
 * - adCount < minAdCount または conversions < minConversions の行は除外（誤学習防止）
 * - score: 同一 dimension 内で rawMetric を 0..1 に正規化（min==max のときは 1）
 */
export function scorePatterns(
  stats: AggregatedTagStat[],
  opts: ScoreOptions,
): ScoredPattern[] {
  const eligible = stats.filter(
    (s) => s.adCount >= opts.minAdCount && s.conversions >= opts.minConversions,
  );

  const byDim = new Map<string, number[]>();
  for (const s of eligible) {
    const m = rawMetric(s, opts.formula);
    const arr = byDim.get(s.dimension) ?? [];
    arr.push(m);
    byDim.set(s.dimension, arr);
  }
  const range = new Map<string, { min: number; max: number }>();
  for (const [dim, arr] of byDim) {
    range.set(dim, { min: Math.min(...arr), max: Math.max(...arr) });
  }

  return eligible.map((s) => {
    const m = rawMetric(s, opts.formula);
    const { min, max } = range.get(s.dimension)!;
    const score = max === min ? 1 : (m - min) / (max - min);
    return {
      ...s,
      avgCtr: s.impressions > 0 ? s.clicks / s.impressions : null,
      avgCpa: s.conversions > 0 ? s.spend / s.conversions : null,
      score,
    };
  });
}
