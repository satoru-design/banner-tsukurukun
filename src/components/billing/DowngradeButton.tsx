'use client';

import { useState } from 'react';

/**
 * Phase A.12: Pro → Starter ダウングレード（期末切替予約）ボタン
 *
 * - /account の Plan セクションに pro プラン時のみ表示
 * - 確認ダイアログ後、POST /api/billing/downgrade を叩く
 * - 成功時はそのままページに「YYYY/MM/DD から Starter」表示
 */
export const DowngradeButton = () => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ scheduledFor: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (
      !confirm(
        'Pro → Starter へダウングレードします。次の請求日からの切替となり、それまでは Pro 機能を引き続き使えます。よろしいですか？'
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/downgrade', { method: 'POST' });
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
        ✓ {new Date(done.scheduledFor).toLocaleDateString('ja-JP')} から Starter に切り替わります
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
        {loading ? '処理中...' : 'Starter にダウングレードする'}
      </button>
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  );
};
