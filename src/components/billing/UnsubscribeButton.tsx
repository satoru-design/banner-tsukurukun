'use client';

/**
 * Phase A.17.0: 退会ボタン
 *
 * - 確認モーダル → /api/billing/cancel POST → 結果表示
 * - 期末まで現プラン利用可、その後 Free に降格
 * - subscription を持たないユーザー（free / admin）には表示しない
 */
import { useState } from 'react';
import { LogOut } from 'lucide-react';

interface Props {
  hasSubscription: boolean;
}

export function UnsubscribeButton({ hasSubscription }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ cancelAt: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!hasSubscription) return null;

  const handleClick = async () => {
    if (
      !confirm(
        '退会します。\n\n' +
          '・本サービスの退会とプランの解除を行います\n' +
          '・翌月からの課金は発生しません\n' +
          '・今月末まで現プランを利用いただけます\n\n' +
          'よろしいですか？',
      )
    )
      return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { cancelAt: string | null };
      setDone(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '退会処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    const dateLabel = done.cancelAt
      ? new Date(done.cancelAt).toLocaleDateString('ja-JP')
      : '今月末';
    return (
      <p className="text-sm text-emerald-400">
        ✓ 退会を受け付けました。{dateLabel} まで現プランをご利用いただけます。
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm rounded transition disabled:opacity-50"
      >
        <LogOut className="w-4 h-4" />
        {loading ? '処理中...' : '退会する'}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
