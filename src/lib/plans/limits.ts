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

/**
 * Phase A.15 リスク監査対応: ハードキャップ（コスト暴走防止）
 * - Free: 3 回までは PREVIEW 透かし生成可能、それ以上はブロック（スパム防御）
 * - Pro:  500 回でハードブロック（チャージバック爆弾回避、超過は Plan C 案内）
 *
 * これらはユーザー上限超過時の app-level での絶対 stop 線。
 * USAGE_LIMIT_FREE / USAGE_LIMIT_PRO は「課金/透かしの境界」、
 * USAGE_HARDCAP_* は「絶対に生成させない閾値」という役割分担。
 */
export const USAGE_HARDCAP_FREE = 3; // Free は preview 含めて 3 回までで打ち止め
export const USAGE_HARDCAP_PRO = 500; // Pro は 500 回で打ち止め（500 × ¥80 = ¥40,000 の追加課金が上限）

export const PLAN_USAGE_LIMITS: Record<string, number> = {
  free: USAGE_LIMIT_FREE,
  starter: 30,
  pro: USAGE_LIMIT_PRO,
  admin: Number.POSITIVE_INFINITY,
};

/**
 * 絶対上限（ハードキャップ）。これを超えたら 429 で block する。
 * starter は USAGE_LIMIT そのものがハードキャップを兼ねる。
 * admin は無制限。
 */
export const PLAN_HARDCAP: Record<string, number> = {
  free: USAGE_HARDCAP_FREE,
  starter: 30,
  pro: USAGE_HARDCAP_PRO,
  admin: Number.POSITIVE_INFINITY,
};

export function getUsageLimit(plan: string): number {
  return PLAN_USAGE_LIMITS[plan] ?? PLAN_USAGE_LIMITS.free;
}

export function getHardcap(plan: string): number {
  return PLAN_HARDCAP[plan] ?? PLAN_HARDCAP.free;
}
