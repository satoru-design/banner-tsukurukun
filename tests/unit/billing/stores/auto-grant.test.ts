import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = {
  user: {
    findUnique: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ getPrisma: () => prisma }));

const grantPlan = vi.fn();
vi.mock('@/lib/billing/stores/grant-plan', () => ({ grantPlan: (args: unknown) => grantPlan(args) }));

import { isProOrder, processOrder, processOrders } from '@/lib/billing/stores/auto-grant';
import type { StoresNetshopOrder } from '@/lib/billing/stores/netshop-client';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeOrder(overrides: Partial<StoresNetshopOrder> = {}): StoresNetshopOrder {
  return {
    id: 'o1',
    number: 'N-o1',
    email: 'buyer@example.com',
    ordered_at: '2026-06-23T10:00:00',
    payment_amount: 5000,
    canceled_at: null,
    cancel_amount: 0,
    deliveries: [
      {
        canceled_at: null,
        items: [{ name: 'Proプラン（30日間）', regular_price: 5000, quantity: 1 }],
      },
    ],
    ...overrides,
  };
}

describe('isProOrder', () => {
  it('true for an order with "Proプラン（30日間）" item', () => {
    expect(isProOrder(makeOrder())).toBe(true);
  });

  it('case-insensitive match on "Pro"', () => {
    const o = makeOrder({
      deliveries: [{ canceled_at: null, items: [{ name: 'banner PRO monthly', regular_price: 5000, quantity: 1 }] }],
    });
    expect(isProOrder(o)).toBe(true);
  });

  it('false for non-pro item names', () => {
    const o = makeOrder({
      deliveries: [{ canceled_at: null, items: [{ name: 'Starterプラン', regular_price: 3000, quantity: 1 }] }],
    });
    expect(isProOrder(o)).toBe(false);
  });

  it('false when order.canceled_at is set', () => {
    expect(isProOrder(makeOrder({ canceled_at: '2026-06-23T11:00:00' }))).toBe(false);
  });

  it('false when all deliveries are cancelled', () => {
    const o = makeOrder({
      deliveries: [
        {
          canceled_at: '2026-06-23T11:00:00',
          items: [{ name: 'Proプラン（30日間）', regular_price: 5000, quantity: 1 }],
        },
      ],
    });
    expect(isProOrder(o)).toBe(false);
  });

  it('false when cancel_amount > 0', () => {
    expect(isProOrder(makeOrder({ cancel_amount: 5000 }))).toBe(false);
  });
});

describe('processOrder', () => {
  it('not a pro order → granted=false', async () => {
    const o = makeOrder({
      deliveries: [{ canceled_at: null, items: [{ name: 'Starter', regular_price: 1000, quantity: 1 }] }],
    });
    const r = await processOrder(o);
    expect(r.granted).toBe(false);
    expect(r.reason).toBe('not a pro order');
    expect(grantPlan).not.toHaveBeenCalled();
  });

  it('no email → granted=false', async () => {
    const r = await processOrder(makeOrder({ email: '' }));
    expect(r.granted).toBe(false);
    expect(r.reason).toBe('no email');
    expect(grantPlan).not.toHaveBeenCalled();
  });

  it('user not found → granted=false, grantPlan not called', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const r = await processOrder(makeOrder());
    expect(r.granted).toBe(false);
    expect(r.reason).toBe('user not found');
    expect(r.email).toBe('buyer@example.com');
    expect(grantPlan).not.toHaveBeenCalled();
  });

  it('happy path → grantPlan called with {email, plan:"pro", months:1}, granted=true', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'buyer@example.com' });
    grantPlan.mockResolvedValue({});
    const r = await processOrder(makeOrder());
    expect(r.granted).toBe(true);
    expect(r.reason).toBe('ok');
    expect(r.email).toBe('buyer@example.com');
    expect(grantPlan).toHaveBeenCalledWith({ email: 'buyer@example.com', plan: 'pro', months: 1 });
  });
});

describe('processOrders', () => {
  it('aggregates processed/granted counts', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'buyer@example.com' });
    grantPlan.mockResolvedValue({});
    const orders = [
      makeOrder({ id: 'o1' }),
      makeOrder({ id: 'o2' }),
      makeOrder({
        id: 'o3',
        deliveries: [{ canceled_at: null, items: [{ name: 'Starter', regular_price: 1000, quantity: 1 }] }],
      }),
    ];
    const result = await processOrders(orders);
    expect(result.processed).toBe(3);
    expect(result.granted).toBe(2);
    expect(result.results).toHaveLength(3);
  });

  it("one throwing order doesn't kill the batch", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'buyer@example.com' });
    grantPlan.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({});
    const orders = [makeOrder({ id: 'o1' }), makeOrder({ id: 'o2' })];
    const result = await processOrders(orders);
    expect(result.processed).toBe(2);
    expect(result.granted).toBe(1);
    expect(result.results[0].granted).toBe(false);
    expect(result.results[0].reason).toMatch(/error: boom/);
    expect(result.results[1].granted).toBe(true);
  });
});
