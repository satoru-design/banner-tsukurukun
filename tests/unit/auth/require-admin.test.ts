import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCurrentUser = vi.fn();
vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: () => getCurrentUser(),
}));

import { isAdmin } from '@/lib/auth/require-admin';

beforeEach(() => vi.clearAllMocks());

describe('isAdmin', () => {
  it('returns true when plan is admin', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'u1', plan: 'admin' });
    expect(await isAdmin()).toBe(true);
  });

  it('returns false when plan is pro', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'u1', plan: 'pro' });
    expect(await isAdmin()).toBe(false);
  });

  it('returns false when plan is free', async () => {
    getCurrentUser.mockResolvedValue({ userId: 'u1', plan: 'free' });
    expect(await isAdmin()).toBe(false);
  });

  it('returns false when userId is null (unauthenticated)', async () => {
    getCurrentUser.mockResolvedValue({ userId: null, plan: 'free' });
    expect(await isAdmin()).toBe(false);
  });

  it('returns false when getCurrentUser returns null-ish object', async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await isAdmin()).toBe(false);
  });
});
