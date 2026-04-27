'use client';

/**
 * Phase A.11.5: /history のクライアント側リスト。
 * - GET /api/history で取得
 * - フィルタ「全て / お気に入りのみ」
 * - ロック行クリックで UpgradeLockModal 表示
 * - フッターに「他 N 件ロック中」バナー
 */
import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { SessionCard } from './SessionCard';
import { UpgradeLockModal } from './UpgradeLockModal';

interface SessionDto {
  id: string;
  createdAt: string;
  brief: { pattern: string; product: string; target: string; purpose: string };
  images: { id: string; size: string; blobUrl: string; isFavorite: boolean }[];
  locked: boolean;
  hasFavorite: boolean;
}

interface ListResponse {
  sessions: SessionDto[];
  nextCursor: string | null;
  lockedCount: number;
  plan: string;
}

export function HistoryList() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/history?limit=50');
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as ListResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="text-slate-400 text-sm">読み込み中…</div>;
  }
  if (error) {
    return <div className="text-red-400 text-sm">エラー: {error}</div>;
  }
  if (!data || data.sessions.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-12 text-center">
        まだ履歴がありません。バナーを生成してみましょう。
      </div>
    );
  }

  const visible =
    filter === 'favorites'
      ? data.sessions.filter((s) => s.hasFavorite)
      : data.sessions;

  return (
    <div className="space-y-6">
      {/* フィルタ */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-xs rounded-full border transition ${
            filter === 'all'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          全て
        </button>
        <button
          type="button"
          onClick={() => setFilter('favorites')}
          className={`px-3 py-1 text-xs rounded-full border transition ${
            filter === 'favorites'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          ★ お気に入りのみ
        </button>
      </div>

      {/* セッションリスト */}
      <div className="space-y-3">
        {visible.map((s) => (
          <SessionCard
            key={s.id}
            id={s.id}
            createdAt={s.createdAt}
            brief={s.brief}
            images={s.images}
            locked={s.locked}
            onLockClick={() => setModalOpen(true)}
          />
        ))}
      </div>

      {/* フッターバナー: ロック中件数表示 */}
      {data.lockedCount > 0 && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 hover:bg-amber-900/40 transition text-left"
        >
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-amber-400" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-300">
                🔒 他 {data.lockedCount} 件ロック中
              </div>
              <div className="text-xs text-amber-400/80 mt-1">
                Pro プランで全件アクセス可能になります
              </div>
            </div>
            <span className="text-xs text-amber-400 underline">
              アップグレード →
            </span>
          </div>
        </button>
      )}

      <UpgradeLockModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        plan={data.plan}
        lockedCount={data.lockedCount}
      />
    </div>
  );
}
