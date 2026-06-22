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
  const [notice, setNotice] = useState<string | null>(null);

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

  // STORES 経路（手動請求書払い）
  // STORES請求書決済には API が無いため自動発行できない。申請を記録して
  // 管理者へ Slack 通知し、入金確認後に管理者がプランを付与する。
  if (clientPaymentProvider() === 'stores' && plan) {
    const onClickStores = async () => {
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const res = await fetch('/api/billing/stores/request-upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        setNotice(data.message ?? 'ご請求書をお送りします。担当者より連絡いたします。');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div>
        <button
          type="button"
          onClick={onClickStores}
          disabled={loading || notice !== null}
          className={
            className ??
            'w-full bg-black text-white px-4 py-3 rounded font-bold disabled:opacity-50'
          }
        >
          {loading ? '読み込み中...' : label}
        </button>
        {notice && <p className="text-green-600 text-sm mt-2">{notice}</p>}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
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
