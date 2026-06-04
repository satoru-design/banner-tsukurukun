'use client';

/**
 * Pay.jp カード入力フォーム（Stripe CheckoutButton の Pay.jp 版 / 移管 P2）
 *
 * Stripe はホスト型 Checkout へ飛ばしていたが、Pay.jp は payjp.js v2 で
 * カードを自前 UI で受け取り token 化 → /api/billing/payjp/subscribe へ POST する。
 * カード Element ロジックは usePayjpCard フックに集約（カード変更フォームと共有）。
 */
import { useState } from 'react';
import { usePayjpCard } from '@/lib/billing/usePayjpCard';
import type { PlanKey } from '@/lib/billing/payjp-plans';

interface Props {
  plan: PlanKey;
  label: string;
  offer?: 'trial_7d';
  className?: string;
  onSuccess?: () => void;
}

export const PayjpCheckoutForm = ({ plan, label, offer, className, onSuccess }: Props) => {
  const { mountRef, ready, error: cardError, createToken } = usePayjpCard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await createToken();
      const res = await fetch('/api/billing/payjp/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, token, offer }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      if (onSuccess) onSuccess();
      else window.location.href = '/account?payjp=success';
    } catch (e) {
      setError(e instanceof Error ? e.message : '決済に失敗しました');
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <div ref={mountRef} className="border rounded px-3 py-3 mb-3 min-h-[44px] bg-white" />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!ready || loading}
        className="w-full bg-black text-white px-4 py-3 rounded font-bold disabled:opacity-50"
      >
        {loading ? '処理中...' : label}
      </button>
      {(error || cardError) && (
        <p className="text-red-500 text-sm mt-2">{error || cardError}</p>
      )}
    </div>
  );
};
