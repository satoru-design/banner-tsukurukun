import { describe, it, expect, vi, beforeEach } from 'vitest';

const isAdminMock = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({ isAdmin: () => isAdminMock() }));

const grantPlanMock = vi.fn();
vi.mock('@/lib/billing/stores/grant-plan', () => ({
  grantPlan: (...a: unknown[]) => grantPlanMock(...a),
}));

import { POST } from '@/app/api/admin/grant-plan/route';

beforeEach(() => vi.clearAllMocks());

function req(body: unknown) {
  return new Request('https://x/api/admin/grant-plan', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/admin/grant-plan', () => {
  it('403 when not admin', async () => {
    isAdminMock.mockResolvedValue(false);
    const res = await POST(req({ email: 'a@b.com', plan: 'pro', months: 1 }));
    expect(res.status).toBe(403);
    expect(grantPlanMock).not.toHaveBeenCalled();
  });

  it('400 on invalid plan', async () => {
    isAdminMock.mockResolvedValue(true);
    const res = await POST(req({ email: 'a@b.com', plan: 'enterprise', months: 1 }));
    expect(res.status).toBe(400);
    expect(grantPlanMock).not.toHaveBeenCalled();
  });

  it('400 on invalid months (zero)', async () => {
    isAdminMock.mockResolvedValue(true);
    const res = await POST(req({ email: 'a@b.com', plan: 'pro', months: 0 }));
    expect(res.status).toBe(400);
  });

  it('200 + grantPlan called on valid admin request', async () => {
    isAdminMock.mockResolvedValue(true);
    grantPlanMock.mockResolvedValue({
      email: 'a@b.com',
      plan: 'pro',
      planExpiresAt: new Date('2026-08-01T00:00:00Z'),
    });

    const res = await POST(req({ email: 'a@b.com', plan: 'pro', months: 1 }));
    expect(res.status).toBe(200);
    expect(grantPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', plan: 'pro', months: 1 }),
    );

    const data = await res.json();
    expect(data.plan).toBe('pro');
    expect(data.email).toBe('a@b.com');
  });

  it('200 + grantPlan called for free plan downgrade (months defaults to 0)', async () => {
    isAdminMock.mockResolvedValue(true);
    grantPlanMock.mockResolvedValue({
      email: 'a@b.com',
      plan: 'free',
      planExpiresAt: null,
    });

    const res = await POST(req({ email: 'a@b.com', plan: 'free' }));
    expect(res.status).toBe(200);
    expect(grantPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', plan: 'free' }),
    );
  });

  it('404 when grantPlan throws user not found', async () => {
    isAdminMock.mockResolvedValue(true);
    grantPlanMock.mockRejectedValue(new Error('user not found: no@one.com'));

    const res = await POST(req({ email: 'no@one.com', plan: 'pro', months: 1 }));
    expect(res.status).toBe(404);
  });
});
