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

/**
 * Pay.jp 移管: LP 生成超過の単価（円）。Pro のみ（soft limit 20 本超で ¥980/本）。
 * Stripe では lpMetered price で課金していた分を、自前都度課金で再現する。
 */
export const LP_OVERAGE_RATE_JPY_PRO = 980;

export function getLpOverageRate(plan: string): number {
  return plan === 'pro' ? LP_OVERAGE_RATE_JPY_PRO : 0;
}
