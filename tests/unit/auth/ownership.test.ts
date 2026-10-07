import { describe, it, expect } from 'vitest';
import { ownedWhere, canAccessOwned } from '@/lib/auth/ownership';

const ALICE = 'user_alice';
const BOB = 'user_bob';

const aliceRow = { userId: ALICE };
const bobRow = { userId: BOB };
const legacyRow = { userId: null };

describe('ownedWhere', () => {
  it('scopes a non-admin to their own rows only', () => {
    expect(ownedWhere(ALICE, false)).toEqual({ userId: ALICE });
  });

  it('lets an admin also see the legacy (NULL) rows', () => {
    expect(ownedWhere(ALICE, true)).toEqual({
      OR: [{ userId: ALICE }, { userId: null }],
    });
  });

  // 移行直後は既存行すべてが userId=NULL なので、ここを緩めると
  // テナント分離を謳いながら既存データが丸ごと開いたままになる。
  it('does not include legacy rows for a non-admin', () => {
    expect(JSON.stringify(ownedWhere(ALICE, false))).not.toContain('null');
  });

  it('never names another tenant', () => {
    expect(JSON.stringify(ownedWhere(ALICE, false))).not.toContain(BOB);
    expect(JSON.stringify(ownedWhere(ALICE, true))).not.toContain(BOB);
  });
});

describe('canAccessOwned', () => {
  it('allows the owner', () => {
    expect(canAccessOwned(aliceRow, ALICE, false)).toBe(true);
  });

  // 本体の回帰テスト: 以前は所有者判定が無く、他人の行を読み書きできた。
  it("refuses another tenant's row", () => {
    expect(canAccessOwned(bobRow, ALICE, false)).toBe(false);
  });

  it("refuses another tenant's row even for an admin", () => {
    expect(canAccessOwned(bobRow, ALICE, true)).toBe(false);
  });

  it('refuses a legacy row for a non-admin', () => {
    expect(canAccessOwned(legacyRow, ALICE, false)).toBe(false);
  });

  it('allows an admin to access a legacy row', () => {
    expect(canAccessOwned(legacyRow, ALICE, true)).toBe(true);
  });
});

// 空文字や undefined の userId がうっかり渡っても行を掴まないこと。
describe('a falsy userId never grants access', () => {
  it('does not match a real owner', () => {
    expect(canAccessOwned(aliceRow, '', false)).toBe(false);
  });

  it('does not match a legacy row for a non-admin', () => {
    expect(canAccessOwned(legacyRow, '', false)).toBe(false);
  });
});
