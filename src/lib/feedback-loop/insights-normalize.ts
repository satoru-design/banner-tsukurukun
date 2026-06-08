import type { InsightsRow } from './types';

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

interface RawAction {
  action_type?: string;
  value?: string | number;
}

/**
 * Meta Graph Insights の 1 行（ad×日）を InsightsRow に正規化する。
 * - ctr は Graph が % なので /100 して比率に
 * - conversions は actions[] から指定 action_type の value を採用
 * - cpa = spend / conversions（conversions 0 のとき null）
 */
export function normalizeInsightsRow(
  row: Record<string, unknown>,
  conversionActionType: string,
): InsightsRow {
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const spend = num(row.spend);

  const actions = (Array.isArray(row.actions) ? row.actions : []) as RawAction[];
  const conv = actions.find((a) => a.action_type === conversionActionType);
  const conversions = conv ? num(conv.value) : 0;

  const ctrPct = row.ctr !== undefined ? num(row.ctr) : impressions > 0 ? (clicks / impressions) * 100 : 0;
  const ctr = ctrPct / 100;
  const cpm = row.cpm !== undefined ? num(row.cpm) : impressions > 0 ? (spend / impressions) * 1000 : null;
  const frequency = row.frequency !== undefined ? num(row.frequency) : null;
  const cpa = conversions > 0 ? spend / conversions : null;

  return {
    adId: String(row.ad_id ?? ''),
    statDate: String(row.date_start ?? ''),
    impressions,
    clicks,
    spend,
    conversions,
    ctr,
    cpa,
    cpm,
    frequency,
    roas: null,
    raw: row,
  };
}
