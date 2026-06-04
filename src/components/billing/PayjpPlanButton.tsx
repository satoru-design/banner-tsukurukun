'use client';

/**
 * Pay.jp プラン購入/アップグレードボタン（移管 P7）
 *
 * Pay.jp はホスト型 Checkout が無いため、CheckoutButton（Stripe リダイレクト）の代替。
 * 現在のプランで挙動を分岐する（二重課金防止のため重要）:
 * - 未契約（free/admin）: モーダルでカード入力 → 新規サブスク作成（/api/billing/payjp/subscribe）
 * - 既契約（starter/pro/business）: 即時アップグレード（/api/billing/payjp/change-plan）
 *   ※ 新規 subscribe を呼ぶと 2 本目のサブスクができ二重課金になるため必ず change-plan
 */
import { useState } from 'react';
import { PayjpCheckoutForm } from './PayjpCheckoutForm';
import type { PlanKey } from '@/lib/billing/payjp-plans';

interface Props {
  targetPlan: PlanKey;
  currentPlan: string;
  label: string;
  className?: string;
  offer?: 'trial_7d';
}

const PAID_PLANS = ['starter', 'pro', 'business'];

export const PayjpPlanButton = ({ targetPlan, currentPlan, label, className, offer }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSubscription = PAID_PLANS.includes(currentPlan);

  // 既契約 → 即時アップグレード（change-plan）
  const onUpgrade = async () => {
    if (
      !confirm(
        `${targetPlan} にアップグレードします。日割りで即時切替となります。よろしいですか？`
      )
    )
      return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/payjp/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlan }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      window.location.href = '/account?payjp=upgraded';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップグレードに失敗しました');
      setLoading(false);
    }
  };

  if (hasSubscription) {
    return (
      <div>
        <button
          type="button"
          onClick={onUpgrade}
          disabled={loading}
          className={
            className ??
            'w-full bg-black text-white px-4 py-3 rounded font-bold disabled:opacity-50'
          }
        >
          {loading ? '処理中...' : label}
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  // 未契約 → カード入力モーダル
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'w-full bg-black text-white px-4 py-3 rounded font-bold disabled:opacity-50'
        }
      >
        {label}
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
              <h3 className="text-lg font-bold text-white">{targetPlan} プランに申し込む</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <PayjpCheckoutForm plan={targetPlan} label="この内容で申し込む" offer={offer} />
            <p className="text-xs text-slate-500 mt-3">
              カード情報は決済代行（Pay.jp）で安全に処理され、当社サーバーには保存されません。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
