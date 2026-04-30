/**
 * Phase A.11.0: プラン → 月次使用回数上限のマッピング。
 * 事業計画 v2 §2.1 のプラン構成に基づく。
 *
 * - free: 3 回（生涯ではなく月次。4 回目以降は Phase A.14 で PREVIEW 透かしモード）
 * - starter: 30 回/月
 * - pro: 100 回/月（超過は Phase A.14 でメータード課金 ¥80/回）
 * - admin: 無制限（Number.POSITIVE_INFINITY）
 *
 * 不明な plan 値が来た場合は free 値にフォールバック。
 */

/**
 * Phase A.14: 月次生成上限定数
 * - Free: 3 回（4 回目以降は PREVIEW 透かしモード）
 * - Pro: 100 回（101 回目以降は Stripe meterEvents で ¥80/回課金）
 */
export const USAGE_LIMIT_FREE = 3;
export const USAGE_LIMIT_PRO = 100;

export const PLAN_USAGE_LIMITS: Record<string, number> = {
  free: USAGE_LIMIT_FREE,
  starter: 30,
  pro: USAGE_LIMIT_PRO,
  admin: Number.POSITIVE_INFINITY,
};

export function getUsageLimit(plan: string): number {
  return PLAN_USAGE_LIMITS[plan] ?? PLAN_USAGE_LIMITS.free;
}
