/**
 * クライアント側の決済プロバイダ判定（移管 P7）
 *
 * サーバーの PAYMENT_PROVIDER と同期させるため NEXT_PUBLIC_PAYMENT_PROVIDER を使う。
 * 両者は必ず同じ値にすること（env 契約参照）。
 */
export type PaymentProviderClient = 'stripe' | 'payjp' | 'stores';

export const clientPaymentProvider = (): PaymentProviderClient => {
  const p = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER;
  if (p === 'payjp') return 'payjp';
  if (p === 'stores') return 'stores';
  return 'stripe';
};
