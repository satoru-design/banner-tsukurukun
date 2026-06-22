'use client';

import { useEffect, useState } from 'react';
import { clientPaymentProvider } from '@/lib/billing/payment-provider.client';

/**
 * Phase A.19: Pro 7 日無料トライアル自動起動ページ
 *
 * 動線:
 *   LP の「Pro を 7 日間無料で始める」CTA
 *     → /signin?callbackUrl=/upgrade-trial-pro
 *     → Google OAuth 完了
 *     → このページに着地
 *     → useEffect で /api/billing/checkout-session に offer:'trial_7d' を投げ
 *     → 返ってきた Stripe Checkout URL に即リダイレクト
 *
 * 認証は middleware 側 (session 必須) で担保。
 */
export default function UpgradeTrialProPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const provider = clientPaymentProvider();

      // STORES 経路（請求書払い）
      if (provider === 'stores') {
        try {
          const res = await fetch('/api/billing/stores/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: 'pro' }),
          });
          const data = await res.json();
          if (data?.paymentUrl) {
            window.location.assign(data.paymentUrl);
            return;
          }
          setError(data?.error ?? `STORES Checkout 起動失敗 (${res.status})`);
        } catch (e) {
          console.error('[upgrade-trial-pro] STORES error:', e);
          setError('ネットワークエラーが発生しました。再読み込みしてください。');
        }
        return;
      }

      // Stripe 経路（ホスト型 Checkout）
      const proBaseId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE;
      if (!proBaseId) {
        setError('Pro Price ID が未設定です。お問い合わせください。');
        return;
      }
      try {
        const res = await fetch('/api/billing/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            basePriceId: proBaseId,
            offer: 'trial_7d',
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          setError(err?.error ?? `Stripe Checkout 起動失敗 (${res.status})`);
          return;
        }
        const { url } = await res.json();
        if (!url) {
          setError('Stripe からチェックアウト URL が返りませんでした。');
          return;
        }
        window.location.href = url;
      } catch (e) {
        console.error('[upgrade-trial-pro] error:', e);
        setError('ネットワークエラーが発生しました。再読み込みしてください。');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-xl font-bold">Pro 7 日間無料トライアルを起動中…</div>
        <div className="mt-3 text-sm text-slate-400">
          数秒で Stripe のお支払いページに移動します。
        </div>
        {error && (
          <div className="mt-6 p-4 rounded-lg bg-red-950/40 border border-red-700/50 text-sm text-red-300">
            <div className="font-bold mb-1">エラーが発生しました</div>
            <div>{error}</div>
            <a
              href="/account"
              className="inline-block mt-3 text-xs underline text-red-200 hover:text-white"
            >
              アカウントページに戻る
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
