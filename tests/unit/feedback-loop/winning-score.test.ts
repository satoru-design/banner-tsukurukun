import { describe, it, expect } from 'vitest';
import { scorePatterns } from '@/lib/feedback-loop/winning-score';
import type { AggregatedTagStat } from '@/lib/feedback-loop/types';

const base = (over: Partial<AggregatedTagStat>): AggregatedTagStat => ({
  dimension: 'angleId',
  value: 'x',
  adCount: 5,
  impressions: 10000,
  clicks: 200,
  conversions: 50,
  spend: 50000,
  ...over,
});

describe('scorePatterns (CPA主)', () => {
  it('閾値未満(adCount<min または conversions<min)は除外する', () => {
    const stats = [
      base({ value: 'low_ads', adCount: 2, conversions: 50 }),
      base({ value: 'low_cv', adCount: 5, conversions: 3 }),
      base({ value: 'ok', adCount: 5, conversions: 50 }),
    ];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    expect(res.map((r) => r.value)).toEqual(['ok']);
  });

  it('CPAが低いほど score が高い（同一 dimension 内 min-max 正規化）', () => {
    const stats = [
      base({ value: 'good', spend: 50000, conversions: 100 }),
      base({ value: 'bad', spend: 100000, conversions: 50 }),
    ];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    const good = res.find((r) => r.value === 'good')!;
    const bad = res.find((r) => r.value === 'bad')!;
    expect(good.avgCpa).toBeCloseTo(500, 5);
    expect(bad.avgCpa).toBeCloseTo(2000, 5);
    expect(good.score).toBeCloseTo(1, 5);
    expect(bad.score).toBeCloseTo(0, 5);
  });

  it('avgCtr = clicks/impressions を計算する', () => {
    const stats = [base({ value: 'a', clicks: 300, impressions: 10000, conversions: 50, adCount: 5 })];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    expect(res[0].avgCtr).toBeCloseTo(0.03, 5);
  });

  it('単一値しかない dimension は score=1（min==max のとき）', () => {
    const stats = [base({ value: 'solo' })];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    expect(res[0].score).toBeCloseTo(1, 5);
  });

  it('CPA mode: spend=0 & conversions>0 の行は NaN/Infinity にならず score=0（最低評価）', () => {
    const stats = [
      base({ value: 'normal', spend: 50000, conversions: 100 }),
      base({ value: 'zero_spend', spend: 0, conversions: 10 }),
    ];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    for (const r of res) {
      expect(Number.isFinite(r.score)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
    const zeroSpendRow = res.find((r) => r.value === 'zero_spend')!;
    expect(zeroSpendRow.score).toBeCloseTo(0, 5);
  });

  it('multi-dimension: 各 dimension が独立して min-max 正規化される（それぞれの最良行が score=1）', () => {
    const stats = [
      // dimension A: good CPA=500, bad CPA=2000
      base({ dimension: 'angleId', value: 'a_good', spend: 50000, conversions: 100 }),
      base({ dimension: 'angleId', value: 'a_bad', spend: 100000, conversions: 50 }),
      // dimension B: 独自スケール（spend 小さく conversions 多め）
      base({ dimension: 'urgency', value: 'b_good', spend: 10000, conversions: 200 }),
      base({ dimension: 'urgency', value: 'b_bad', spend: 30000, conversions: 30 }),
    ];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    const aGood = res.find((r) => r.value === 'a_good')!;
    const bGood = res.find((r) => r.value === 'b_good')!;
    // 各 dimension の best row がそれぞれ 1 になること
    expect(aGood.score).toBeCloseTo(1, 5);
    expect(bGood.score).toBeCloseTo(1, 5);
  });

  it('avgCpc = spend/clicks を計算する（clicks 0 で null）', () => {
    const stats = [
      base({ value: 'a', spend: 38000, clicks: 1000, conversions: 50, adCount: 5 }),
      base({ value: 'b', spend: 100, clicks: 0, conversions: 50, adCount: 5 }),
    ];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    const a = res.find((r) => r.value === 'a')!;
    const b = res.find((r) => r.value === 'b')!;
    expect(a.avgCpc).toBeCloseTo(38, 5);
    expect(b.avgCpc).toBeNull();
  });

  it('CTR mode: impressions=0 の行は NaN にならず avgCtr=null', () => {
    const stats = [
      base({ value: 'with_imp', impressions: 10000, clicks: 300, conversions: 5 }),
      base({ value: 'no_imp', impressions: 0, clicks: 0, conversions: 5 }),
    ];
    // minConversions=1 で impressions=0 の行もゲートを通過させる
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 1, formula: 'ctr' });
    for (const r of res) {
      expect(Number.isFinite(r.score)).toBe(true);
    }
    const noImpRow = res.find((r) => r.value === 'no_imp')!;
    expect(noImpRow.avgCtr).toBeNull();
  });
});
