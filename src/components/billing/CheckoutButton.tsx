'use client';

/**
 * Phase A.12 Task 11: 決済起動ボタン。
 *
 * - Stripe: POST /api/billing/checkout-session → 返却 url へリダイレクト（ホスト型 Checkout）
 * - Pay.jp（移管 P7）: PayjpPlanButton に委譲（カード入力モーダル or 即時アップグレード）
 *
 * provider は NEXT_PUBLIC_PAYMENT_PROVIDER で判定。Pay.jp 利用時は `plan`/`currentPlan` 必須。
 */
import { useState } from 'react';
import { clientPaymentProvider } from '@/lib/billing/payment-provider.client';
import { PayjpPlanButton } from './PayjpPlanButton';
import type { PlanKey } from '@/lib/billing/payjp-plans';

interface Props {
  basePriceId: string;
  label: string;
  promo?: string;
  className?: string;
  /** Pay.jp 用: 対象プラン。provider=payjp のとき必須。 */
  plan?: PlanKey;
  /** Pay.jp 用: 現在のプラン（新規 subscribe か即時 upgrade かの判定）。 */
  currentPlan?: string;
  offer?: 'trial_7d';
}

export const CheckoutButton = ({
  basePriceId,
  label,
  promo,
  className,
  plan,
  currentPlan,
  offer,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pay.jp 経路
  if (clientPaymentProvider() === 'payjp' && plan) {
    return (
      <PayjpPlanButton
        targetPlan={plan}
        currentPlan={currentPlan ?? 'free'}
        label={label}
        className={className}
        offer={offer}
      />
    );
  }

  // Stripe 経路（ホスト型 Checkout）
  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basePriceId, promo }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={
          className ??
          'w-full bg-black text-white px-4 py-3 rounded font-bold disabled:opacity-50'
        }
      >
        {loading ? '読み込み中...' : label}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};
