/**
 * Phase A.12: Stripe Price ID マッピング
 *
 * - 本ファイルは Price ID を「許可リスト」として明示することで、
 *   Checkout API で任意 priceId を受け取って成立しないように防衛する
 */

export type PlanKey = 'starter' | 'pro';

export interface PlanPriceConfig {
  basePriceId: string;
  meteredPriceId?: string;
}

export const getPlanPrices = (): Record<PlanKey, PlanPriceConfig> => {
  const starter = process.env.STRIPE_PRICE_STARTER;
  const proBase = process.env.STRIPE_PRICE_PRO_BASE;
  const proMetered = process.env.STRIPE_PRICE_PRO_METERED;
  if (!starter || !proBase) {
    throw new Error(
      'Missing Stripe Price ID env vars (STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO_BASE)'
    );
  }
  return {
    starter: { basePriceId: starter },
    pro: { basePriceId: proBase, meteredPriceId: proMetered || undefined },
  };
};

export const isAllowedBasePriceId = (priceId: string): boolean => {
  const config = getPlanPrices();
  return priceId === config.starter.basePriceId || priceId === config.pro.basePriceId;
};

export const getPlanFromPriceId = (priceId: string): PlanKey | null => {
  const config = getPlanPrices();
  if (priceId === config.starter.basePriceId) return 'starter';
  if (priceId === config.pro.basePriceId) return 'pro';
  return null;
};
