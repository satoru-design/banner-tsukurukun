import { describe, it, expect } from 'vitest';
import { normalizeInsightsRow } from '@/lib/feedback-loop/insights-normalize';

describe('normalizeInsightsRow', () => {
  it('Graph API 行を InsightsRow に変換する', () => {
    const row = {
      ad_id: '120000111',
      date_start: '2026-06-01',
      impressions: '10000',
      clicks: '250',
      spend: '12345.67',
      ctr: '2.5',
      cpm: '1234.5',
      frequency: '1.8',
      actions: [
        { action_type: 'offsite_conversion.fb_pixel_purchase', value: '40' },
        { action_type: 'link_click', value: '250' },
      ],
    };
    const r = normalizeInsightsRow(row, 'offsite_conversion.fb_pixel_purchase');
    expect(r.adId).toBe('120000111');
    expect(r.statDate).toBe('2026-06-01');
    expect(r.impressions).toBe(10000);
    expect(r.clicks).toBe(250);
    expect(r.spend).toBeCloseTo(12345.67, 2);
    expect(r.conversions).toBe(40);
    expect(r.ctr).toBeCloseTo(0.025, 5);
    expect(r.cpa).toBeCloseTo(12345.67 / 40, 2);
  });

  it('conversions アクションが無ければ 0、cpa は null', () => {
    const row = {
      ad_id: 'a',
      date_start: '2026-06-01',
      impressions: '100',
      clicks: '1',
      spend: '500',
    };
    const r = normalizeInsightsRow(row, 'offsite_conversion.fb_pixel_purchase');
    expect(r.conversions).toBe(0);
    expect(r.cpa).toBeNull();
  });

  // --- Fix 3: derivation tests ---

  it('ctr フィールド欠損 + impressions > 0 → clicks/impressions で導出', () => {
    const row = {
      ad_id: 'b',
      date_start: '2026-06-01',
      impressions: '10000',
      clicks: '300',
      spend: '1000',
      // ctr フィールドなし
    };
    const r = normalizeInsightsRow(row, 'offsite_conversion.fb_pixel_purchase');
    expect(r.ctr).toBeCloseTo(0.03, 6);
  });

  it('ctr フィールド欠損 + impressions = 0 → ctr === 0 (NaN にならない)', () => {
    const row = {
      ad_id: 'c',
      date_start: '2026-06-01',
      impressions: '0',
      clicks: '0',
      spend: '0',
    };
    const r = normalizeInsightsRow(row, 'offsite_conversion.fb_pixel_purchase');
    expect(r.ctr).toBe(0);
    expect(Number.isNaN(r.ctr)).toBe(false);
  });

  it('cpm フィールド欠損 + impressions = 0 → cpm === null', () => {
    const row = {
      ad_id: 'd',
      date_start: '2026-06-01',
      impressions: '0',
      clicks: '0',
      spend: '0',
    };
    const r = normalizeInsightsRow(row, 'offsite_conversion.fb_pixel_purchase');
    expect(r.cpm).toBeNull();
  });

  it('frequency フィールド欠損 → frequency === null', () => {
    const row = {
      ad_id: 'e',
      date_start: '2026-06-01',
      impressions: '1000',
      clicks: '10',
      spend: '500',
      // frequency フィールドなし
    };
    const r = normalizeInsightsRow(row, 'offsite_conversion.fb_pixel_purchase');
    expect(r.frequency).toBeNull();
  });

  it('num() 堅牢性: impressions がオブジェクトや null でも 0 になる (NaN にならない)', () => {
    const rowObj = {
      ad_id: 'f',
      date_start: '2026-06-01',
      impressions: {} as unknown,
      clicks: '10',
      spend: '100',
    };
    const r1 = normalizeInsightsRow(rowObj as Record<string, unknown>, 'any');
    expect(r1.impressions).toBe(0);
    expect(Number.isNaN(r1.impressions)).toBe(false);

    const rowNull = {
      ad_id: 'g',
      date_start: '2026-06-01',
      impressions: null as unknown,
      clicks: '10',
      spend: '100',
    };
    const r2 = normalizeInsightsRow(rowNull as Record<string, unknown>, 'any');
    expect(r2.impressions).toBe(0);
    expect(Number.isNaN(r2.impressions)).toBe(false);
  });
});
