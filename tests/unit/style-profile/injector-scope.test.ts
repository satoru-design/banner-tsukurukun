import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
vi.mock('@/lib/prisma', () => ({
  getPrisma: () => ({ styleProfile: { findFirst: (a: unknown) => findFirst(a) } }),
}));

import { loadStyleProfile } from '@/lib/style-profile/injector';

const ALICE = 'user_alice';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sp_1',
    name: 'My Style',
    productContext: null,
    referenceImageUrls: JSON.stringify(['https://blob/secret-reference.png']),
    visualStyle: '{}',
    typography: '{}',
    priceBadge: '{}',
    cta: '{}',
    layout: '{}',
    copyTone: '{}',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('loadStyleProfile tenant scoping', () => {
  it('returns null without hitting the database when no id is given', async () => {
    expect(await loadStyleProfile(null, ALICE)).toBeNull();
    expect(await loadStyleProfile(undefined, ALICE)).toBeNull();
    expect(await loadStyleProfile('', ALICE)).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  // 本体の回帰テスト: 以前は findUnique({ where: { id } }) だったため、
  // body に他人の styleProfileId を入れるだけで相手の referenceImageUrls を
  // 自分の生成に流用できた。
  it('constrains the query to the viewer and the legacy rows', async () => {
    findFirst.mockResolvedValue(row());

    await loadStyleProfile('sp_1', ALICE);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'sp_1', OR: [{ userId: ALICE }, { userId: null }] },
    });
  });

  it('never queries by id alone', async () => {
    findFirst.mockResolvedValue(row());

    await loadStyleProfile('sp_1', ALICE);

    const where = findFirst.mock.calls[0][0].where;
    expect(where.OR, 'the tenant constraint must always be present').toBeDefined();
  });

  it("returns null when the row is not visible to the viewer", async () => {
    // 他人の行は where で弾かれるので DB から何も返らない
    findFirst.mockResolvedValue(null);

    expect(await loadStyleProfile('sp_of_bob', ALICE)).toBeNull();
  });

  it('parses and returns a visible profile', async () => {
    findFirst.mockResolvedValue(row());

    const p = await loadStyleProfile('sp_1', ALICE);

    expect(p?.id).toBe('sp_1');
    expect(p?.referenceImageUrls).toEqual(['https://blob/secret-reference.png']);
  });

  it('returns a legacy row (userId=null), which stays readable by design', async () => {
    findFirst.mockResolvedValue(row({ userId: null }));

    expect((await loadStyleProfile('sp_legacy', ALICE))?.id).toBe('sp_1');
  });
});
