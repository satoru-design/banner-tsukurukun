import { describe, it, expect } from 'vitest';
import { formatWinningReport, formatSnapshotTable } from '@/lib/slack/ad-report';
import type { SnapshotBucket } from '@/lib/feedback-loop/ad-snapshot';

describe('formatWinningReport', () => {
  const hints = [
    { dimension: '訴求軸', value: 'ベネフィット型', avgCpa: 480, avgCpc: 38, avgCtr: 0.029, adCount: 5, conversions: 62, score: 0.95 },
    { dimension: '緊急性', value: '高', avgCpa: 520, avgCpc: 45, avgCtr: 0.024, adCount: 4, conversions: 41, score: 0.8 },
  ];
  const fatigued = [{ adId: '1', adName: '夏キャンA', reason: 'ctr_drop' as const, detail: 'CTRピーク比 -38%' }];

  it('CPA/CPC/CTR を含む勝ち要因を出す', () => {
    const t = formatWinningReport({ rangeLabel: '6/1〜6/7', hints, fatigued });
    expect(t).toContain('ベネフィット型');
    expect(t).toContain('¥480');
    expect(t).toContain('¥38');
    expect(t).toContain('2.90%');
    expect(t).toContain('夏キャンA');
    expect(t).toContain('-38%');
  });
  it('勝ち要因0件なら データ不足 を明記', () => {
    const t = formatWinningReport({ rangeLabel: '6/1〜6/7', hints: [], fatigued: [] });
    expect(t).toContain('有意な勝ち要因なし');
  });
  it('疲労0件なら疲労ブロックを出さない', () => {
    const t = formatWinningReport({ rangeLabel: '6/1〜6/7', hints, fatigued: [] });
    expect(t).not.toContain('要差し替え');
  });
});

describe('formatSnapshotTable', () => {
  const buckets: SnapshotBucket[] = [
    { label: '26/05/31-06/06', impressions: 1_100_000, clicks: 7900, spend: 271000, conversions: 11, ctr: 0.0072, cpc: 34, cpa: 24636 },
  ];
  it('等幅テーブルに主要指標が並ぶ', () => {
    const t = formatSnapshotTable('週次スナップショット 直近16週', buckets);
    expect(t).toContain('週次スナップショット');
    expect(t).toContain('26/05/31-06/06');
    expect(t).toContain('```');
  });
  it('空なら no-data 文言', () => {
    expect(formatSnapshotTable('x', [])).toContain('データなし');
  });
});
