import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchRecentPaidOrders } from '@/lib/billing/stores/netshop-client';

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.STORES_API_TOKEN = 'test_token';
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.STORES_API_TOKEN;
});

function makeOrder(id: string, itemName = 'Proプラン（30日間）') {
  return {
    id,
    number: `N-${id}`,
    email: `${id}@example.com`,
    ordered_at: '2026-06-23T10:00:00',
    payment_amount: 5000,
    canceled_at: null,
    cancel_amount: 0,
    deliveries: [
      {
        canceled_at: null,
        items: [{ name: itemName, regular_price: 5000, quantity: 1 }],
      },
    ],
  };
}

describe('fetchRecentPaidOrders', () => {
  it('calls api.stores.dev/retail/202211/orders with correct query params', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ orders: [makeOrder('o1')] }), { status: 200 }),
    );
    const from = new Date('2026-06-23T09:55:00Z');
    const to = new Date('2026-06-23T10:00:00Z');

    await fetchRecentPaidOrders(from, to);

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url: string = call[0];
    expect(url).toContain('https://api.stores.dev/retail/202211/orders');
    expect(url).toContain('paid_status=paid');
    expect(url).toContain('limit=100');
    expect(url).toContain('offset=0');
    expect(url).toContain('ordered_at_from=');
    expect(url).toContain('ordered_at_to=');
  });

  it('sends Authorization Bearer header with STORES_API_TOKEN', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ orders: [] }), { status: 200 }),
    );
    await fetchRecentPaidOrders(new Date(), new Date());
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test_token');
  });

  it('returns parsed orders array', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ orders: [makeOrder('o1'), makeOrder('o2')] }), { status: 200 }),
    );
    const orders = await fetchRecentPaidOrders(new Date(), new Date());
    expect(orders).toHaveLength(2);
    expect(orders[0].id).toBe('o1');
    expect(orders[0].deliveries[0].items[0].name).toContain('Pro');
  });

  it('pages through results: 100 then <100 concatenated', async () => {
    const firstBatch = Array.from({ length: 100 }, (_, i) => makeOrder(`o${i}`));
    const secondBatch = [makeOrder('last1'), makeOrder('last2')];
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response(JSON.stringify({ orders: firstBatch }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ orders: secondBatch }), { status: 200 }));

    const orders = await fetchRecentPaidOrders(new Date(), new Date());
    expect(orders).toHaveLength(102);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    // second call should have offset=100
    const secondUrl: string = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondUrl).toContain('offset=100');
  });

  it('throws if STORES_API_TOKEN env var unset', async () => {
    delete process.env.STORES_API_TOKEN;
    await expect(fetchRecentPaidOrders(new Date(), new Date())).rejects.toThrow(/STORES_API_TOKEN/);
  });

  it('throws on 401 with status in message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('unauthorized', { status: 401 }),
    );
    await expect(fetchRecentPaidOrders(new Date(), new Date())).rejects.toThrow(/401/);
  });

  it('throws on 500 with status in message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    );
    await expect(fetchRecentPaidOrders(new Date(), new Date())).rejects.toThrow(/500/);
  });
});
