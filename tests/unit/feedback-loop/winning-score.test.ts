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
});
