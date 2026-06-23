/**
 * STORES netshop Orders API client (Phase 1 auto-grant).
 *
 * - Base URL: https://api.stores.dev
 * - Endpoint: GET /retail/202211/orders
 * - Auth: Bearer ${STORES_API_TOKEN}
 *
 * Pages with limit=100 / offset until len < limit.
 * Mirrors the retry-aware Python impl in
 * `claude_pjt/adreport-daily/src/stores.py` (TypeScript port keeps it simple:
 * single-attempt fetch; throw on non-2xx. The 5min cron is the retry loop.)
 */

const BASE_URL = 'https://api.stores.dev';
const ENDPOINT = '/retail/202211/orders';
const PAGE_LIMIT = 100;

export interface StoresNetshopOrderItem {
  name: string;
  regular_price: number;
  quantity: number;
}

export interface StoresNetshopDelivery {
  canceled_at: string | null;
  items: StoresNetshopOrderItem[];
}

export interface StoresNetshopOrder {
  id: string;
  number: string;
  email: string;
  ordered_at: string;
  payment_amount: number;
  canceled_at: string | null;
  cancel_amount: number;
  deliveries: StoresNetshopDelivery[];
}

interface OrdersResponse {
  orders: StoresNetshopOrder[];
}

/**
 * Format Date as ISO 8601 `YYYY-MM-DDTHH:MM:SS` (no millis, no zone) in JST.
 * STORES Orders API treats the bare timestamp as JST — confirmed by the
 * adreport-daily Python implementation (`stores.py` _jst_range_iso) which
 * has been running against this same API in production.
 * Vercel cron runs in UTC, so we must convert UTC → JST before formatting.
 */
function formatStoresTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // shift UTC to JST (+9h) then read the calendar fields in UTC to avoid local-tz drift.
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return (
    `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}` +
    `T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}`
  );
}

export async function fetchRecentPaidOrders(
  orderedAtFrom: Date,
  orderedAtTo: Date,
): Promise<StoresNetshopOrder[]> {
  const token = process.env.STORES_API_TOKEN;
  if (!token) throw new Error('STORES_API_TOKEN is not set');

  const all: StoresNetshopOrder[] = [];
  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      ordered_at_from: formatStoresTimestamp(orderedAtFrom),
      ordered_at_to: formatStoresTimestamp(orderedAtTo),
      paid_status: 'paid',
      limit: String(PAGE_LIMIT),
      offset: String(offset),
      direction: 'asc',
    });

    const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`STORES Orders API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as OrdersResponse;
    const batch = data.orders ?? [];
    all.push(...batch);

    if (batch.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }

  return all;
}
