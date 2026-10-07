import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCurrentUser = vi.fn();
vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}));

const findUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({
  getPrisma: () => ({ user: { findUnique: (args: unknown) => findUnique(args) } }),
}));

import { guardGeneration } from '@/lib/plans/generation-guard';
import { USAGE_HARDCAP_FREE, USAGE_HARDCAP_PRO } from '@/lib/plans/limits';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** 上限に余裕のある free ユーザー。 */
function freeUser() {
  getCurrentUser.mockResolvedValue({
    userId: 'u1',
    plan: 'free',
    usageLimit: 10,
  });
  findUnique.mockResolvedValue({ plan: 'free', usageCount: 0, usageResetAt: null });
}

describe('guardGeneration', () => {
  // 本体の回帰テスト: 以前は userId が null のとき上限チェックごと素通りし、
  // 未ログインでも従量課金の生成が走った。
  it('returns 401 when there is no session', async () => {
    getCurrentUser.mockResolvedValue({ userId: null, plan: 'free', usageLimit: 10 });

    const result = await guardGeneration('test');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    // 生成前に落ちるので DB も触らない
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns 401 when the user row is gone', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'ghost', plan: 'free', usageLimit: 10 });
    findUnique.mockResolvedValue(null);

    const result = await guardGeneration('test');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('allows a free user under the hard cap', async () => {
    freeUser();

    const result = await guardGeneration('test');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe('u1');
      expect(result.plan).toBe('free');
    }
  });

  it('returns 429 once a free user reaches the hard cap', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'u1', plan: 'free', usageLimit: 10 });
    findUnique.mockResolvedValue({
      plan: 'free',
      usageCount: USAGE_HARDCAP_FREE,
      usageResetAt: new Date(Date.now() + 86_400_000),
    });

    const result = await guardGeneration('test');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      const body = await result.response.json();
      expect(body.hardcapReached).toBe(true);
      expect(body.usageLimit).toBe(USAGE_HARDCAP_FREE);
    }
  });

  it('returns 429 with the Plan C wording for pro at the hard cap', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'u1', plan: 'pro', usageLimit: 100 });
    findUnique.mockResolvedValue({
      plan: 'pro',
      usageCount: USAGE_HARDCAP_PRO,
      usageResetAt: new Date(Date.now() + 86_400_000),
    });

    const result = await guardGeneration('test');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      const body = await result.response.json();
      expect(body.error).toContain('Plan C');
    }
  });

  it('returns 429 for starter at its soft limit', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'u1', plan: 'starter', usageLimit: 30 });
    findUnique.mockResolvedValue({
      plan: 'starter',
      usageCount: 30,
      usageResetAt: new Date(Date.now() + 86_400_000),
    });

    const result = await guardGeneration('test');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(429);
  });

  it('treats a past usageResetAt as a fresh month and allows generation', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'u1', plan: 'free', usageLimit: 10 });
    findUnique.mockResolvedValue({
      plan: 'free',
      usageCount: 999,
      usageResetAt: new Date(Date.now() - 86_400_000),
    });

    const result = await guardGeneration('test');

    expect(result.ok).toBe(true);
  });

  it('skips the DB lookup for admin (unlimited)', async () => {
    getCurrentUser.mockResolvedValue({
      userId: 'admin1',
      plan: 'admin',
      usageLimit: Number.POSITIVE_INFINITY,
    });

    const result = await guardGeneration('test');

    expect(result.ok).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
