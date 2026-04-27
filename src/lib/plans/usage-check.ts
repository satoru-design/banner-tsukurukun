/**
 * Phase A.11.3: 使用回数上限到達判定ヘルパー。
 *
 * クライアント (pre-check) と API gate の両方から呼ぶことで、判定ロジックを DRY 化。
 * lazy reset 考慮: usageResetAt を過ぎていれば 0 として扱う（生成許可）。
 */

interface UsageCheckInput {
  /** 現在の使用回数 */
  usageCount: number;
  /** 月次上限。Infinity（admin）の場合は常に false */
  usageLimit: number;
  /** リセット予定日時。null or 過去なら effectiveCount=0 として扱う */
  usageResetAt: Date | null;
}

/**
 * 効果的な使用回数（lazy reset 考慮）を返す。
 * usageResetAt が null または 過去なら 0、未来なら usageCount をそのまま返す。
 */
export function effectiveUsageCount(input: UsageCheckInput, now: Date = new Date()): number {
  if (!input.usageResetAt) return input.usageCount;
  if (now >= input.usageResetAt) return 0;
  return input.usageCount;
}

/**
 * 上限到達判定。admin (usageLimit=Infinity) は常に false。
 */
export function isUsageLimitReached(input: UsageCheckInput, now: Date = new Date()): boolean {
  if (!Number.isFinite(input.usageLimit)) return false;
  return effectiveUsageCount(input, now) >= input.usageLimit;
}
