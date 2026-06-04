'use client';

/**
 * Pay.jp 登録カード変更フォーム（Stripe Customer Portal のカード変更代替 / 移管 P4）
 *
 * payjp.js でカードを token 化 → /api/billing/payjp/card へ POST。
 * サーバーで customers.update(customerId, { card: token }) を実行する。
 */
import { useState } from 'react';
import { usePayjpCard } from '@/lib/billing/usePayjpCard';

interface Props {
  className?: string;
  onSuccess?: () => void;
}

export const PayjpCardUpdateForm = ({ className, onSuccess }: Props) => {
  const { mountRef, ready, error: cardError, createToken } = usePayjpCard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await createToken();
      const res = await fetch('/api/billing/payjp/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setDone(true);
      if (onSuccess) onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'カード更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return <p className="text-sm text-emerald-500">✓ カード情報を更新しました。</p>;
  }

  return (
    <div className={className}>
      <div ref={mountRef} className="border rounded px-3 py-3 mb-3 min-h-[44px] bg-white" />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!ready || loading}
        className="w-full bg-black text-white px-4 py-3 rounded font-bold disabled:opacity-50"
      >
        {loading ? '更新中...' : 'カードを更新する'}
      </button>
      {(error || cardError) && (
        <p className="text-red-500 text-sm mt-2">{error || cardError}</p>
      )}
    </div>
  );
};
