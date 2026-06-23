import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchRecentPaidOrders = vi.fn();
const processOrders = vi.fn();
vi.mock('@/lib/billing/stores/netshop-client', () => ({
  fetchRecentPaidOrders: (...a: unknown[]) => fetchRecentPaidOrders(...a),
}));
vi.mock('@/lib/billing/stores/auto-grant', () => ({
  processOrders: (...a: unknown[]) => processOrders(...a),
}));

import { GET } from '@/app/api/cron/stores-netshop-poll/route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'cronsecret';
  process.env.PAYMENT_PROVIDER = 'stores';
});

const authed = () =>
  new Request('https://x/api/cron/stores-netshop-poll', {
    headers: new Headers({ authorization: 'Bearer cronsecret' }),
  });

it('401 on bad CRON_SECRET', async () => {
  const res = await GET(
    new Request('https://x', { headers: new Headers({ authorization: 'Bearer wrong' }) }),
  );
  expect(res.status).toBe(401);
});

it('skipped when PAYMENT_PROVIDER !== "stores"', async () => {
  process.env.PAYMENT_PROVIDER = 'stripe';
  const res = await GET(authed());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, skipped: 'provider not stores' });
  expect(fetchRecentPaidOrders).not.toHaveBeenCalled();
});

it('happy path: fetches recent orders and returns aggregated counts', async () => {
  fetchRecentPaidOrders.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
  processOrders.mockResolvedValue({
    processed: 2,
    granted: 1,
    results: [
      { orderId: 'o1', granted: true, reason: 'ok', email: 'a@b.com' },
      { orderId: 'o2', granted: false, reason: 'user not found' },
    ],
  });
  const res = await GET(authed());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.processed).toBe(2);
  expect(body.granted).toBe(1);
  expect(body.results).toHaveLength(2);
  // Verify the time window was ~15min
  const call = fetchRecentPaidOrders.mock.calls[0];
  const from = call[0] as Date;
  const to = call[1] as Date;
  const diffMin = (to.getTime() - from.getTime()) / 60000;
  expect(diffMin).toBeGreaterThanOrEqual(14);
  expect(diffMin).toBeLessThanOrEqual(16);
});

it('returns ok:false when fetch throws', async () => {
  fetchRecentPaidOrders.mockRejectedValue(new Error('upstream 500'));
  const res = await GET(authed());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(false);
  expect(body.error).toMatch(/upstream 500/);
  expect(processOrders).not.toHaveBeenCalled();
});
