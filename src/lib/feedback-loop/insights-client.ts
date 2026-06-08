import { normalizeInsightsRow } from './insights-normalize';
import type { InsightsRow } from './types';

const GRAPH_VERSION = 'v21.0';

export class InsightsConfigError extends Error {}

export interface InsightsAccount {
  metaAdAccountId: string;
  token: string;
}

/**
 * 指定日の ad 単位 Insights を取得して正規化行を返す。
 * @param dateYmd 'YYYY-MM-DD'（time_range の since/until を同日に設定）
 * @param account Meta アカウント情報（token / metaAdAccountId）
 * 設定不足（token/account 無し）は InsightsConfigError を投げる（cron 側で skip+log）。
 *
 * セキュリティ: access_token を含む URL は fetch() に直接渡すのみ。
 * エラーメッセージ・ログへの token 埋め込みを防ぐため、
 * token-bearing URL を保持する変数は Error/console には一切使用しない。
 */
export async function fetchAdInsightsForDate(
  dateYmd: string,
  account: InsightsAccount,
): Promise<InsightsRow[]> {
  const conversionActionType =
    process.env.FEEDBACK_CONVERSION_ACTION_TYPE ?? 'offsite_conversion.fb_pixel_purchase';

  const token = account.token;
  const acct = account.metaAdAccountId;
  if (!token || !acct) {
    throw new InsightsConfigError('token / metaAdAccountId missing');
  }
  const actId = acct.startsWith('act_') ? acct : `act_${acct}`;
  const fields = 'ad_id,impressions,clicks,spend,ctr,cpm,frequency,actions,date_start';
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateYmd, until: dateYmd }));

  // Fix 1: token を含まない safe descriptor をエラーコンテキスト用に保持する。
  // token-bearing URL は fetch() へ直接渡すのみ。変数名でも Error にも使わない。
  const safeDescriptor = `GET /${GRAPH_VERSION}/${actId}/insights date=${dateYmd}`;

  const rows: InsightsRow[] = [];
  // token-bearing URL。この変数は fetch() の引数としてのみ使用し、
  // Error メッセージや console には絶対に渡さない。
  let nextUrl: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/${actId}/insights` +
    `?level=ad&fields=${fields}&time_range=${timeRange}&limit=200&access_token=${token}`;
  let pageNo = 0;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const body = await res.text();
      // safeDescriptor のみ使用。nextUrl (token) は絶対に含めない。
      throw new Error(
        `Insights API ${res.status} (page ${pageNo}, ${safeDescriptor}): ${body.slice(0, 300)}`,
      );
    }
    const json = (await res.json()) as {
      data?: Record<string, unknown>[];
      paging?: { next?: string };
    };
    for (const row of json.data ?? []) {
      rows.push(normalizeInsightsRow(row, conversionActionType));
    }
    // paging.next も token を含むが fetch() に渡すだけで良い。
    nextUrl = json.paging?.next ?? null;
    pageNo++;
  }
  return rows;
}
