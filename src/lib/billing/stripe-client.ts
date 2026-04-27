import Stripe from 'stripe';

/**
 * Phase A.12: Stripe SDK インスタンス（server only）
 *
 * - STRIPE_ENABLED=false の場合は null を返す（L1 ロールバック用）
 * - apiVersion は SDK 同梱の最新を使用（明示しない）
 */

export const isStripeEnabled = (): boolean => {
  return process.env.STRIPE_ENABLED === 'true' && !!process.env.STRIPE_SECRET_KEY;
};

let cachedClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!isStripeEnabled()) {
    throw new Error('Stripe is disabled (STRIPE_ENABLED!=true or STRIPE_SECRET_KEY missing)');
  }
  if (!cachedClient) {
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }
  return cachedClient;
};
