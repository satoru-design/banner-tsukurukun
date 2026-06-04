import Payjp from 'payjp';

/**
 * Pay.jp SDK インスタンス（server only）
 *
 * Stripe からの移管 P1。stripe-client.ts と同じ「フラグでガード + キャッシュ」方式。
 * - PAYMENT_PROVIDER=payjp かつ PAYJP_SECRET_KEY がある時のみ有効。
 * - これにより Stripe(凍結) → Pay.jp の切替・ロールバックを env だけで行える。
 *
 * 検証済み: payjp npm v3.1.2（2026-04-28 更新・現役）。CommonJS ファクトリ形式。
 */

export type PaymentProvider = 'stripe' | 'payjp';

export const getPaymentProvider = (): PaymentProvider => {
  return process.env.PAYMENT_PROVIDER === 'payjp' ? 'payjp' : 'stripe';
};

export const isPayjpEnabled = (): boolean => {
  return getPaymentProvider() === 'payjp' && !!process.env.PAYJP_SECRET_KEY;
};

// Payjp の戻り型は SDK が型を提供。インスタンス型を ReturnType で受ける。
let cachedClient: ReturnType<typeof Payjp> | null = null;

export const getPayjpClient = (): ReturnType<typeof Payjp> => {
  if (!isPayjpEnabled()) {
    throw new Error('Pay.jp is disabled (PAYMENT_PROVIDER!=payjp or PAYJP_SECRET_KEY missing)');
  }
  if (!cachedClient) {
    cachedClient = Payjp(process.env.PAYJP_SECRET_KEY!);
  }
  return cachedClient;
};
