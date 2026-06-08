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
  // Fix 1: spend=0 & conversions>0 → cpa=0 → 1/0=Infinity を防ぐため、spend>0 も条件に加える
  const cpa = s.conversions > 0 && s.spend > 0 ? s.spend / s.conversions : Infinity;
  switch (formula) {
    case 'ctr':
      return ctr;
    case 'roas':
      // conversions/spend = CV per cost（収益データ未取得のため revenue ベースの ROAS ではなく CV 効率の近似値）
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

  // Fix 2: rawMetric を1回だけ計算してキャッシュし、range 導出と最終 map で再利用する
  const withMetric = eligible.map((s) => ({ stat: s, metric: rawMetric(s, opts.formula) }));

  const byDim = new Map<string, number[]>();
  for (const { stat, metric } of withMetric) {
    const arr = byDim.get(stat.dimension) ?? [];
    arr.push(metric);
    byDim.set(stat.dimension, arr);
  }
  const range = new Map<string, { min: number; max: number }>();
  for (const [dim, arr] of byDim) {
    range.set(dim, { min: Math.min(...arr), max: Math.max(...arr) });
  }

  return withMetric.map(({ stat: s, metric: m }) => {
    const { min, max } = range.get(s.dimension)!;
    const score = max === min ? 1 : (m - min) / (max - min);
    return {
      ...s,
      avgCtr: s.impressions > 0 ? s.clicks / s.impressions : null,
      avgCpa: s.conversions > 0 ? s.spend / s.conversions : null,
      avgCpc: s.clicks > 0 ? s.spend / s.clicks : null,
      score,
    };
  });
}
