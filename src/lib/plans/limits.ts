/**
 * Phase A.11.0: プラン → 月次使用回数上限のマッピング。
 * 事業計画 v2 §2.1 のプラン構成に基づく。
 *
 * - free: 3 回（生涯ではなく月次。3回限定の挙動は Phase A.14 でグレーアウト実装）
 * - starter: 30 回/月
 * - pro: 100 回/月（超過は Phase A.14 でメータード課金）
 * - admin: 無制限（Number.POSITIVE_INFINITY）
 *
 * 不明な plan 値が来た場合は free 値にフォールバック。
 */
export const PLAN_USAGE_LIMITS: Record<string, number> = {
  free: 3,
  starter: 30,
  pro: 100,
  admin: Number.POSITIVE_INFINITY,
};

export function getUsageLimit(plan: string): number {
  return PLAN_USAGE_LIMITS[plan] ?? PLAN_USAGE_LIMITS.free;
}
