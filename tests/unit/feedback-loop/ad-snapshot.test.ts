import { describe, it, expect } from 'vitest';
import { bucketSnapshots, type SnapshotInput } from '@/lib/feedback-loop/ad-snapshot';

const row = (statDate: string, over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  statDate,
  impressions: 1000,
  clicks: 10,
  spend: 1000,
  conversions: 1,
  ...over,
});

describe('bucketSnapshots weekly (日曜起点)', () => {
  it('同一週(日〜土)を1バケットに合算する', () => {
    const rows = [row('2026-06-07', { impressions: 100 }), row('2026-06-10', { impressions: 200 })];
    const buckets = bucketSnapshots(rows, 'weekly');
    expect(buckets).toHaveLength(1);
    expect(buckets[0].impressions).toBe(300);
    expect(buckets[0].label).toBe('26/06/07-06/13');
  });
  it('週をまたぐと別バケット・新しい順', () => {
    const rows = [row('2026-05-31'), row('2026-06-07')];
    const buckets = bucketSnapshots(rows, 'weekly');
    expect(buckets).toHaveLength(2);
    expect(buckets[0].label.startsWith('26/06/07')).toBe(true);
  });
  it('派生指標 CTR/CPC/CPA を合算値から計算', () => {
    const rows = [row('2026-06-07', { impressions: 10000, clicks: 300, spend: 30000, conversions: 10 })];
    const b = bucketSnapshots(rows, 'weekly')[0];
    expect(b.ctr).toBeCloseTo(0.03, 5);
    expect(b.cpc).toBeCloseTo(100, 5);
    expect(b.cpa).toBeCloseTo(3000, 5);
  });
});

describe('bucketSnapshots monthly', () => {
  it('暦月で合算・新しい順', () => {
    const rows = [row('2026-05-03'), row('2026-05-28'), row('2026-06-01')];
    const buckets = bucketSnapshots(rows, 'monthly');
    expect(buckets).toHaveLength(2);
    expect(buckets[0].label).toBe('2026-06');
  });
});
