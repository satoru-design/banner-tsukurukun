'use client';

import { useState } from 'react';

/**
 * Phase A.12: Stripe Customer Portal を新規タブで開くボタン
 *
 * - 「お支払い情報を管理」として /account に配置
 * - 既存の subscribe 済ユーザー（plan starter/pro）のみ表示
 */
export const PortalButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
