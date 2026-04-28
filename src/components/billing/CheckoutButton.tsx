'use client';

/**
 * Phase A.12 Task 11: Stripe Checkout 起動ボタン。
 *
 * POST /api/billing/checkout-session を呼び出し、
 * レスポンスの url へリダイレクトする。
 */
import { useState } from 'react';

interface Props {
  basePriceId: string;
  label: string;
  promo?: string;
  className?: string;
}

export const CheckoutButton = ({ basePriceId, label, promo, className }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
