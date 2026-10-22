import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const prisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ getPrisma: () => prisma }));

import { grantPlan } from '@/lib/billing/stores/grant-plan';

/**
 * 時刻を固定する。grantPlan は「既存の期限が未来かどうか」で基準日を切り替えるため、
 * 実時間に依存すると、固定日付で書いた期待値がその日付を過ぎた時点で突然落ちる。
 * Date だけを差し替え、setTimeout や Promise はそのまま動かす。
 */
const FROZEN_NOW = new Date('2026-07-01T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'], now: FROZEN_NOW });
});

afterEach(() => vi.useRealTimers());

describe('grantPlan', () => {
  it('grants a new paid plan (no existing expiry) — sets plan and a future planExpiresAt', async () => {
    const now = new Date();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', planExpiresAt: null });
    prisma.user.update.mockResolvedValue({ id: 'u1', email: 'a@b.com', plan: 'pro', planExpiresAt: new Date() });

    await grantPlan({ email: 'a@b.com', plan: 'pro', months: 1 });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          plan: 'pro',
          planExpiresAt: expect.any(Date),
        }),
      }),
    );

    // planExpiresAt should be roughly now+1 month
    const callData = prisma.user.update.mock.calls[0][0].data;
    expect(callData.planExpiresAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it('extends from existing future planExpiresAt (renewal)', async () => {
    // FROZEN_NOW より後であることが、このテストが renewal 分岐を通る前提。
    const existingExpiry = new Date('2026-08-01T00:00:00Z');
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', planExpiresAt: existingExpiry });
    prisma.user.update.mockResolvedValue({ id: 'u1', email: 'a@b.com', plan: 'pro', planExpiresAt: new Date() });

    await grantPlan({ email: 'a@b.com', plan: 'pro', months: 2 });

    const callData = prisma.user.update.mock.calls[0][0].data;
    // base = existingExpiry, expected = existingExpiry + 2 months = 2026-10-01
    const expected = new Date('2026-10-01T00:00:00Z');
    expect(callData.planExpiresAt.getTime()).toBe(expected.getTime());
  });

  it('sets planExpiresAt to null when downgrading to free', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', planExpiresAt: new Date() });
    prisma.user.update.mockResolvedValue({ id: 'u1', email: 'a@b.com', plan: 'free', planExpiresAt: null });

    await grantPlan({ email: 'a@b.com', plan: 'free', months: 0 });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'free', planExpiresAt: null }),
      }),
    );
  });

  it('throws when user is not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(grantPlan({ email: 'no@one.com', plan: 'pro', months: 1 })).rejects.toThrow(
      'user not found: no@one.com',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
