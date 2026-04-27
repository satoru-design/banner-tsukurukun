/**
 * Phase A.11.5: プラン → 履歴アクセス可能件数 / お気に入り上限のマッピング。
 *
 * - Free: 直近 10 セッションのみアクセス可（11 件目以降ロック）
 * - Starter: 直近 30 セッションのみアクセス可
 * - Pro / Plan C: 無制限（ロックなし）
 *
 * お気に入り上限:
 * - Free: 0 枚（使用不可、Pro 訴求）
 * - Starter: 5 枚
 * - Pro / Plan C: 無制限
 */

export const HISTORY_ACCESS_LIMITS: Record<string, number> = {
  free: 10,
  starter: 30,
  pro: Number.POSITIVE_INFINITY,
  admin: Number.POSITIVE_INFINITY,
};

export const FAVORITE_LIMITS: Record<string, number> = {
  free: 0,
  starter: 5,
  pro: Number.POSITIVE_INFINITY,
  admin: Number.POSITIVE_INFINITY,
};

export function getHistoryAccessLimit(plan: string): number {
  return HISTORY_ACCESS_LIMITS[plan] ?? HISTORY_ACCESS_LIMITS.free;
}

export function getFavoriteLimit(plan: string): number {
  return FAVORITE_LIMITS[plan] ?? FAVORITE_LIMITS.free;
}
