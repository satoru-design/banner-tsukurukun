'use client';

import { useState } from 'react';

/**
 * Phase A.12 / A.17.0: ダウングレード（期末切替予約）ボタン
 *
 * - 引数なし: legacy 互換 = Pro → Starter
 * - targetPlan='pro': Business → Pro
 * - targetPlan='starter': Business → Starter または Pro → Starter（明示）
 *
 * - 確認ダイアログ後、POST /api/billing/downgrade を叩く
 * - 成功時は「YYYY/MM/DD から <targetPlan>」表示
 */
interface Props {
  targetPlan?: 'starter' | 'pro';
  label?: string;
  confirmMessage?: string;
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
};

export const DowngradeButton = ({ targetPlan, label, confirmMessage }: Props = {}) => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ scheduledFor: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetLabel = targetPlan ? PLAN_LABEL[targetPlan] ?? targetPlan : 'Starter';
  const buttonLabel = label ?? `${targetLabel} にダウングレードする`;
  const confirmText =
    confirmMessage ??
    `${targetLabel} へダウングレードします。次の請求日からの切替となり、それまでは現プランを引き続き使えます。よろしいですか？`;

  const onClick = async () => {
    if (!confirm(confirmText)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetPlan ? { targetPlan } : {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { scheduledFor: string };
      setDone(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <p className="text-sm text-emerald-400">
        ✓ {new Date(done.scheduledFor).toLocaleDateString('ja-JP')} から {targetLabel} に切り替わります。
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="text-sm text-slate-400 hover:text-white underline disabled:opacity-50"
      >
        {loading ? '処理中...' : buttonLabel}
      </button>
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  );
};
