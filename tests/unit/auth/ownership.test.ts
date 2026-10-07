import { describe, it, expect } from 'vitest';
import {
  ownedOrLegacyWhere,
  ownedWhere,
  canMutateOwned,
  canReadOwnedOrLegacy,
} from '@/lib/auth/ownership';

const ALICE = 'user_alice';
const BOB = 'user_bob';

const aliceRow = { userId: ALICE };
const bobRow = { userId: BOB };
const legacyRow = { userId: null };

describe('ownedOrLegacyWhere', () => {
  it('matches the owner and the legacy (NULL) rows', () => {
    expect(ownedOrLegacyWhere(ALICE)).toEqual({
      OR: [{ userId: ALICE }, { userId: null }],
    });
  });

  it('never names another tenant', () => {
    expect(JSON.stringify(ownedOrLegacyWhere(ALICE))).not.toContain(BOB);
  });
});

describe('ownedWhere', () => {
  it('scopes a non-admin to their own rows only', () => {
    expect(ownedWhere(ALICE, false)).toEqual({ userId: ALICE });
  });

  it('lets an admin also see the legacy rows', () => {
    expect(ownedWhere(ALICE, true)).toEqual({
      OR: [{ userId: ALICE }, { userId: null }],
    });
  });

  // Banner は「移行前は全員に見えていた」を引き継がない。
  it('does not include legacy rows for a non-admin', () => {
    expect(JSON.stringify(ownedWhere(ALICE, false))).not.toContain('null');
  });
});

describe('canMutateOwned', () => {
  it('allows the owner', () => {
    expect(canMutateOwned(aliceRow, ALICE, false)).toBe(true);
  });

  // 本体の回帰テスト: 以前は所有者判定が無く、他人の行を書き換え・削除できた。
  it("refuses another tenant's row", () => {
    expect(canMutateOwned(bobRow, ALICE, false)).toBe(false);
  });

  it("refuses another tenant's row even for an admin", () => {
    expect(canMutateOwned(bobRow, ALICE, true)).toBe(false);
  });

  it('refuses a legacy row for a non-admin', () => {
    expect(canMutateOwned(legacyRow, ALICE, false)).toBe(false);
  });

  it('allows an admin to mutate a legacy row', () => {
    expect(canMutateOwned(legacyRow, ALICE, true)).toBe(true);
  });
});

describe('canReadOwnedOrLegacy', () => {
  it('allows the owner and the legacy rows', () => {
    expect(canReadOwnedOrLegacy(aliceRow, ALICE)).toBe(true);
    expect(canReadOwnedOrLegacy(legacyRow, ALICE)).toBe(true);
  });

  it("refuses another tenant's row", () => {
    expect(canReadOwnedOrLegacy(bobRow, ALICE)).toBe(false);
  });
});

// 空文字や undefined の userId がうっかり渡っても他人の行を掴まないこと。
describe('a falsy userId never grants access', () => {
  it('does not match a real owner', () => {
    expect(canMutateOwned(aliceRow, '', false)).toBe(false);
    expect(canReadOwnedOrLegacy(aliceRow, '')).toBe(false);
  });

  // NULL 行は誰にでも読めるのが仕様なので、ここは true のままが正しい。
  it('still reads the legacy row, which is the documented rule', () => {
    expect(canReadOwnedOrLegacy(legacyRow, '')).toBe(true);
  });
});
