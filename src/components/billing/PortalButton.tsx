'use client';

import { useState } from 'react';
import { clientPaymentProvider } from '@/lib/billing/payment-provider.client';
import { PayjpCardUpdateForm } from './PayjpCardUpdateForm';

/**
 * 「お支払い情報を管理」ボタン
 *
 * - Stripe: Customer Portal を開く（リダイレクト）
 * - Pay.jp（移管 P7）: ホスト型ポータルが無いため、カード変更モーダルを自前表示
 */
export const PortalButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Pay.jp 経路: カード変更モーダル
  if (clientPaymentProvider() === 'payjp') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border border-white/40 hover:border-white text-white px-4 py-2 rounded text-sm transition"
        >
          お支払いカードを変更 ▶
        </button>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="bg-slate-900 border border-white/10 rounded-lg p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">お支払いカードの変更</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
              <PayjpCardUpdateForm onSuccess={() => setTimeout(() => setOpen(false), 1500)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Stripe 経路: Customer Portal リダイレクト
  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        className="border border-white/40 hover:border-white text-white px-4 py-2 rounded text-sm disabled:opacity-50 transition"
      >
        {loading ? '読み込み中...' : 'お支払い情報を管理 ▶'}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
};
