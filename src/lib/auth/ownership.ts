/**
 * テナント分離の共通ルール。
 *
 * StyleProfile と Banner には後から userId を足したため、
 * 移行前に作られた行は userId = NULL のまま残る。所有者を特定できないので、
 * NULL 行の扱いをテーブルごとに決めて 1 箇所に集める。
 *
 *  - StyleProfile: 移行前は「全ユーザーが一覧できる共有ライブラリ」として
 *    動いていた。既存の見え方を壊さないよう、NULL 行は全ログインユーザーが
 *    参照できる。変更と削除は所有者のみ（NULL 行は admin のみ）。
 *  - Banner: 共有の意味を持たない保存物なので、NULL 行は admin のみ参照できる。
 *
 * NULL 行を実ユーザーに寄せるには scripts/backfill-tenant-ownership.ts を使う。
 */

/** userId 列を持つ行の最小形。 */
export interface OwnedRow {
  userId: string | null;
}

/**
 * 「自分の行 + 移行前の遺構 (userId=NULL)」を読む Prisma の where 断片。
 *
 * StyleProfile のように、移行前から全員に見えていたテーブルの参照に使う。
 * NULL 行を新たに公開するわけではない（移行前から全員に見えていた)。
 */
export function ownedOrLegacyWhere(userId: string): {
  OR: ({ userId: string } | { userId: null })[];
} {
  return { OR: [{ userId }, { userId: null }] };
}

/**
 * 「自分の行」だけを読む where 断片。admin のときは遺構 (NULL) も合流する。
 *
 * Banner のように、移行前から全員に見えていたことを引き継ぎたくない
 * テーブルの参照に使う。Asset の既存ルールと同じ考え方。
 */
export function ownedWhere(
  userId: string,
  isAdmin: boolean,
): { userId: string } | { OR: ({ userId: string } | { userId: null })[] } {
  return isAdmin ? ownedOrLegacyWhere(userId) : { userId };
}

/**
 * 行を変更・削除できるか。
 *
 * 自分の行は可。admin は加えて遺構 (userId=NULL) も可。
 * 他人の行は不可（admin であっても不可にする。管理操作は
 * 専用の admin エンドポイント経由に限る）。
 */
export function canMutateOwned(
  row: OwnedRow,
  userId: string,
  isAdmin: boolean,
): boolean {
  if (row.userId === userId) return true;
  if (isAdmin && row.userId === null) return true;
  return false;
}

/**
 * 行を参照できるか（StyleProfile の規則）。
 * 自分の行と遺構は可。他人の行は不可。
 */
export function canReadOwnedOrLegacy(row: OwnedRow, userId: string): boolean {
  return row.userId === userId || row.userId === null;
}
