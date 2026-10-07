/**
 * テナント分離の共通ルール。
 *
 * StyleProfile と Banner には後から userId を足したため、
 * 移行前に作られた行は userId = NULL のまま残る。所有者を特定できないので、
 * NULL 行は Asset の既存ルールと同じく admin のみが触れる扱いにする。
 *
 * 当初は StyleProfile だけ「NULL 行は全ログインユーザーが参照できる」
 * （移行前と同じ見え方の維持）としていたが、それだと移行直後は
 * 既存の全プロファイルが NULL なので、他テナントの参照画像 URL や
 * ターゲット層が引き続き誰からでも読める。テナント分離を謳いながら
 * 既存データが丸ごと開いたままになるため、両テーブルとも
 * admin 限定に統一した。
 *
 * NULL 行を実ユーザーに寄せるには scripts/backfill-tenant-ownership.ts を使う。
 */

/** userId 列を持つ行の最小形。 */
export interface OwnedRow {
  userId: string | null;
}

/**
 * 「自分の行」を読む Prisma の where 断片。admin のときは移行前の
 * 遺構 (userId=NULL) も合流する。
 */
export function ownedWhere(
  userId: string,
  isAdmin: boolean,
): { userId: string } | { OR: ({ userId: string } | { userId: null })[] } {
  return isAdmin ? { OR: [{ userId }, { userId: null }] } : { userId };
}

/**
 * 行を参照・変更・削除できるか。
 *
 * 自分の行は可。admin は加えて遺構 (userId=NULL) も可。
 * 他人の行は不可（admin であっても不可にする。管理操作は
 * 専用の admin エンドポイント経由に限る）。
 *
 * 参照と変更で規則を分けない。分けると呼び出し側で取り違えたときに
 * 気づきにくいうえ、参照だけ緩める理由がこのドメインには無い。
 */
export function canAccessOwned(
  row: OwnedRow,
  userId: string,
  isAdmin: boolean,
): boolean {
  if (row.userId === userId) return true;
  if (isAdmin && row.userId === null) return true;
  return false;
}
