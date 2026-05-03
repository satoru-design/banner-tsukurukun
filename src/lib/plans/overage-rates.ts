/**
 * Phase A.17.0: plan → メータード超過単価（円）
 *
 * 表示用定数（Stripe 側の Price で実際の課金単価が決まるため、
 * このマッピングはあくまで UI 表示用）。
 */
export const PLAN_OVERAGE_RATE_JPY: Record<string, number> = {
  pro: 80,
  business: 40,
};

export function getOverageRate(plan: string): number {
  return PLAN_OVERAGE_RATE_JPY[plan] ?? 0;
}
