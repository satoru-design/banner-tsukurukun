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
  it('constrains the query to the viewer for a non-admin', async () => {
    findFirst.mockResolvedValue(row());

    await loadStyleProfile('sp_1', ALICE);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'sp_1', userId: ALICE },
    });
  });

  // 移行前の遺構 (userId=NULL) は admin だけが合流できる。
  it('lets an admin also reach the legacy rows', async () => {
    findFirst.mockResolvedValue(row({ userId: null }));

    await loadStyleProfile('sp_legacy', ALICE, true);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'sp_legacy', OR: [{ userId: ALICE }, { userId: null }] },
    });
  });

  it('never queries by id alone', async () => {
    findFirst.mockResolvedValue(row());

    await loadStyleProfile('sp_1', ALICE);

    const where = findFirst.mock.calls[0][0].where;
    const constrained = where.userId !== undefined || where.OR !== undefined;
    expect(constrained, 'the tenant constraint must always be present').toBe(true);
  });

  // 既定は非 admin。呼び出し側が渡し忘れても遺構に届かない。
  it('defaults to the non-admin rule when the flag is omitted', async () => {
    findFirst.mockResolvedValue(row());

    await loadStyleProfile('sp_1', ALICE);

    expect(findFirst.mock.calls[0][0].where.OR).toBeUndefined();
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

  it('parses whatever the scoped query returned', async () => {
    findFirst.mockResolvedValue(row({ userId: null }));

    expect((await loadStyleProfile('sp_legacy', ALICE, true))?.id).toBe('sp_1');
  });
});
