/**
 * Pay.jp Plan ID マッピング（prices.ts の Pay.jp 版）
 *
 * Stripe は base + metered + lpMetered の 3-item subscription だったが、
 * Pay.jp サブスクは固定額のみ。超過従量課金は P5（自前集計 + 都度課金）で別途実装するため、
 * ここは「固定額 base plan の ID 許可リスト」だけを持つ。
 */

export type PlanKey = 'starter' | 'pro' | 'business';

export const getPayjpPlans = (): Record<PlanKey, string> => {
  const starter = process.env.PAYJP_PLAN_STARTER;
  const pro = process.env.PAYJP_PLAN_PRO;
  const business = process.env.PAYJP_PLAN_BUSINESS;
  if (!starter || !pro || !business) {
    throw new Error(
      'Missing Pay.jp Plan ID env vars (PAYJP_PLAN_STARTER / PAYJP_PLAN_PRO / PAYJP_PLAN_BUSINESS)'
    );
  }
  return { starter, pro, business };
};

export const isAllowedPayjpPlanId = (planId: string): boolean => {
  return Object.values(getPayjpPlans()).includes(planId);
};

export const getPlanKeyFromPayjpPlanId = (planId: string): PlanKey | null => {
  const plans = getPayjpPlans();
  if (planId === plans.starter) return 'starter';
  if (planId === plans.pro) return 'pro';
  if (planId === plans.business) return 'business';
  return null;
};
