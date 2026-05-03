'use client';

/**
 * Phase A.11.5: 履歴詳細の Client UI。
 * - ブリーフ全体表示
 * - 各サイズ画像グリッド + ★ トグル + 個別 DL + 削除
 * - 「同条件で再生成」「編集して再生成」ボタン
 * - 「一括 ZIP DL」（Pro+ のみ有効）
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Star, Download, Trash2, Sparkles, Pencil, Archive } from 'lucide-react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { downloadGenerationZip } from './zip-helper';

interface DetailImage {
  id: string;
  size: string;
  blobUrl: string;
  provider: string;
  isFavorite: boolean;
  favoritedAt: string | null;
  createdAt: string;
}

interface DetailDto {
  id: string;
  createdAt: string;
  briefSnapshot: {
    pattern: string;
    product: string;
    target: string;
    purpose: string;
    sizes: string[];
    copies: [string, string, string, string];
    designRequirements: [string, string, string, string];
    cta: string;
    tone: string;
    caution: string;
  };
  images: DetailImage[];
}

interface HistoryDetailProps {
  detail: DetailDto;
}

export function HistoryDetail({ detail: initialDetail }: HistoryDetailProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = sessionToCurrentUser(session);
  const [detail, setDetail] = useState(initialDetail);
  const [favError, setFavError] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Phase A.17.0: ZIP DL は Pro / Business / admin で利用可
  const isPro = user.plan === 'pro' || user.plan === 'business' || user.plan === 'admin';

  const handleFavoriteToggle = async (imageId: string, current: boolean) => {
    setFavError(null);
    try {
      const res = await fetch(`/api/history/image/${imageId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !current }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFavError(j.error || `HTTP ${res.status}`);
        return;
      }
      setDetail((prev) => ({
        ...prev,
        images: prev.images.map((img) =>
          img.id === imageId ? { ...img, isFavorite: !current } : img,
        ),
      }));
    } catch (e) {
      setFavError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleZipDownload = async () => {
    if (!isPro) return;
    setZipLoading(true);
    try {
      await downloadGenerationZip(detail.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setZipLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('この履歴を削除しますか？画像も完全に消去されます。')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/history/${detail.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `HTTP ${res.status}`);
        return;
      }
      router.push('/history');
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerateSame = () => {
    router.push(`/?regenerate=${detail.id}`);
  };

  const handleRegenerateEdit = () => {
    router.push(`/?prefill=${detail.id}`);
  };

  const handleImageDownload = (blobUrl: string, size: string) => {
    const link = document.createElement('a');
    link.href = blobUrl;
    const safe = size.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `${detail.briefSnapshot.product || 'banner'}_${safe}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const dateStr = new Date(detail.createdAt).toLocaleString('ja-JP');

  return (
    <div className="space-y-8">
      {/* ヘッダー操作 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">履歴詳細</h1>
          <div className="text-xs text-slate-500 mt-1">作成: {dateStr}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRegenerateSame}
            className="inline-flex items-center gap-1 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded transition"
          >
            <Sparkles className="w-4 h-4" />
            同条件で再生成
          </button>
          <button
            type="button"
            onClick={handleRegenerateEdit}
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            <Pencil className="w-4 h-4" />
            編集して再生成
          </button>
          <button
            type="button"
            onClick={handleZipDownload}
            disabled={!isPro || zipLoading}
            title={isPro ? '一括 ZIP ダウンロード' : 'ZIP DL は Pro プランで利用可能'}
            className={`inline-flex items-center gap-1 px-3 py-2 text-sm rounded transition ${
              isPro
                ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Archive className="w-4 h-4" />
            {zipLoading ? '生成中…' : '一括 ZIP DL'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            削除
          </button>
        </div>
      </div>

      {/* ブリーフ要約 */}
      <section className="bg-neutral-900/50 border border-slate-800 rounded-lg p-4 space-y-2 text-sm">
        <h2 className="text-base font-semibold text-teal-300 mb-2">ブリーフ</h2>
        <div><span className="text-slate-500 w-24 inline-block">パターン:</span> {detail.briefSnapshot.pattern}</div>
        <div><span className="text-slate-500 w-24 inline-block">商材:</span> {detail.briefSnapshot.product}</div>
        <div><span className="text-slate-500 w-24 inline-block">ターゲット:</span> {detail.briefSnapshot.target}</div>
        <div><span className="text-slate-500 w-24 inline-block">目的:</span> {detail.briefSnapshot.purpose}</div>
        <div><span className="text-slate-500 w-24 inline-block">CTA:</span> {detail.briefSnapshot.cta}</div>
        <div><span className="text-slate-500 w-24 inline-block">トーン:</span> {detail.briefSnapshot.tone}</div>
      </section>

      {favError && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded px-3 py-2">
          {favError}
        </div>
      )}

      {/* 画像グリッド */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {detail.images.map((img) => (
          <div
            key={img.id}
            className="bg-neutral-900/50 border border-slate-800 rounded-lg overflow-hidden"
          >
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.blobUrl}
                alt={img.size}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            <div className="p-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">{img.size}</span>
              <div className="flex items-center gap-2">
                {/* Phase A.11.5 fix: Instagram 風に下部配置。DL ボタン左横に並べる。
                    画像右上配置だと画像本体とかぶって視認性が悪かった。 */}
                <button
                  type="button"
                  onClick={() => handleFavoriteToggle(img.id, img.isFavorite)}
                  disabled={user.plan === 'free'}
                  aria-label={
                    user.plan === 'free'
                      ? 'お気に入りは Pro プランで開放'
                      : img.isFavorite
                        ? 'お気に入り解除'
                        : 'お気に入りに追加'
                  }
                  title={
                    user.plan === 'free'
                      ? 'お気に入りは Pro プランで開放'
                      : img.isFavorite
                        ? 'お気に入り解除'
                        : 'お気に入りに追加'
                  }
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                    img.isFavorite
                      ? 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  } ${user.plan === 'free' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Star className={`w-3 h-3 ${img.isFavorite ? 'fill-current' : ''}`} />
                  {img.isFavorite ? '解除' : 'お気に入り'}
                </button>
                <button
                  type="button"
                  onClick={() => handleImageDownload(img.blobUrl, img.size)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition"
                >
                  <Download className="w-3 h-3" />
                  DL
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
