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
});
