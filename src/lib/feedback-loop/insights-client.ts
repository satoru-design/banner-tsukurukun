import { normalizeInsightsRow } from './insights-normalize';
import type { InsightsRow } from './types';

const GRAPH_VERSION = 'v21.0';
const CONVERSION_ACTION_TYPE =
  process.env.FEEDBACK_CONVERSION_ACTION_TYPE ?? 'offsite_conversion.fb_pixel_purchase';

export class InsightsConfigError extends Error {}

/**
 * 指定日の ad 単位 Insights を取得して正規化行を返す。
 * @param dateYmd 'YYYY-MM-DD'（time_range の since/until を同日に設定）
 * 設定不足（token/account 無し）は InsightsConfigError を投げる（cron 側で skip+log）。
 */
export async function fetchAdInsightsForDate(dateYmd: string): Promise<InsightsRow[]> {
  const token = process.env.META_INSIGHTS_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;
  if (!token || !account) {
    throw new InsightsConfigError('META_INSIGHTS_ACCESS_TOKEN / META_AD_ACCOUNT_ID not set');
  }
  const actId = account.startsWith('act_') ? account : `act_${account}`;
  const fields = 'ad_id,impressions,clicks,spend,ctr,cpm,frequency,actions,date_start';
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateYmd, until: dateYmd }));

  const rows: InsightsRow[] = [];
  let url:
    | string
    | null = `https://graph.facebook.com/${GRAPH_VERSION}/${actId}/insights?level=ad&fields=${fields}&time_range=${timeRange}&limit=200&access_token=${token}`;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Insights API ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      data?: Record<string, unknown>[];
      paging?: { next?: string };
    };
    for (const row of json.data ?? []) {
      rows.push(normalizeInsightsRow(row, CONVERSION_ACTION_TYPE));
    }
    url = json.paging?.next ?? null;
  }
  return rows;
}
