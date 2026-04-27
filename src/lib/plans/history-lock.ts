/**
 * Phase A.11.5: 履歴セッションのロック判定。
 *
 * ルール:
 * - 直近 N 件（N = getHistoryAccessLimit(plan)）はロックなし
 * - それ以前のセッションでも ★ お気に入り画像が 1 つでも含まれていればロックなし（救済枠）
 * - 上記以外はロック対象（一覧で blur サムネ + クリックで Pro 訴求モーダル）
 */

interface SessionLockInput {
  /** 配列の index = createdAt desc 順での順位（0 = 最新） */
  index: number;
  /** プラン別アクセス上限 */
  accessLimit: number;
  /** ★ お気に入り画像が含まれるか */
  hasFavorite: boolean;
}

export function computeLocked(input: SessionLockInput): boolean {
  const withinLimit = input.index < input.accessLimit;
  if (withinLimit) return false;
  if (input.hasFavorite) return false;
  return true;
}
