'use client';

/**
 * Phase A.11.5: 履歴詳細の Client UI。
 * - ブリーフ全体表示
 * - 各サイズ画像グリッド + ★ トグル + 個別 DL + 削除
 * - 「同条件で再生成」「編集して再生成」ボタン
 * - 「一括 ZIP DL」（Pro+ のみ有効）
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Star, Download, Trash2, Sparkles, Pencil, Archive, Film, Loader2, AlertTriangle } from 'lucide-react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { downloadGenerationZip } from './zip-helper';
import { VideoGenerationDialog } from '@/components/video/VideoGenerationDialog';

interface DetailImage {
  id: string;
  size: string;
  blobUrl: string;
  provider: string;
  isFavorite: boolean;
  favoritedAt: string | null;
  createdAt: string;
}

interface DetailVideo {
  id: string;
  status: string;
  provider: string;
  aspectRatio: string;
  durationSeconds: number;
  blobUrl: string | null;
  inputImageUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
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
  videos: DetailVideo[];
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
  // Phase B.1: 動画生成ダイアログ
  const [videoDialogImage, setVideoDialogImage] = useState<DetailImage | null>(null);

  // Phase B.3: pending/processing 動画は 15 秒毎にポーリングして status 更新
  useEffect(() => {
    const inFlight = detail.videos.filter(
      (v) => v.status === 'pending' || v.status === 'processing',
    );
    if (inFlight.length === 0) return;
    const timer = setInterval(async () => {
      const updates = await Promise.all(
        inFlight.map(async (v) => {
          try {
            const r = await fetch(`/api/generate-video/${v.id}`);
            if (!r.ok) return null;
            return (await r.json()) as DetailVideo;
          } catch {
            return null;
          }
        }),
      );
      setDetail((prev) => ({
        ...prev,
        videos: prev.videos.map((v) => {
          const u = updates.find((x): x is DetailVideo => !!x && x.id === v.id);
          return u ? { ...v, ...u } : v;
        }),
      }));
    }, 15_000);
    return () => clearInterval(timer);
  }, [detail.videos]);

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
                {/* Phase B.1 ベータ: 動画化は admin 限定 (品質検証中) */}
                {user.plan === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setVideoDialogImage(img)}
                    title="この画像を動画化 (β: admin限定)"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
                  >
                    <Film className="w-3 h-3" />
                    動画化 β
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Phase B.3: 動画グリッド (admin 同時生成 or 動画化βで作成された GenerationVideo) */}
      {detail.videos.length > 0 && (
        <section className="mt-8">
          <h3 className="flex items-center gap-2 text-lg font-bold text-amber-200 mb-3">
            <Film className="w-5 h-5" />
            動画 ({detail.videos.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {detail.videos.map((v) => (
              <div
                key={v.id}
                className="bg-neutral-900/50 border border-slate-800 rounded-lg overflow-hidden"
              >
                {v.status === 'done' && v.blobUrl ? (
                  <video
                    src={v.blobUrl}
                    controls
                    className="w-full h-auto"
                    preload="metadata"
                  />
                ) : v.status === 'failed' ? (
                  <div className="aspect-[9/16] flex items-center justify-center bg-rose-950/40 text-rose-300 p-6 text-center">
                    <div>
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-xs">{v.errorMessage || '生成失敗'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[9/16] flex flex-col items-center justify-center bg-slate-900/60 text-slate-300 p-6">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-300 mb-3" />
                    <p className="text-xs">
                      {v.status === 'pending' ? '順番待ち' : '生成中'} ({v.provider})
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      通常 1〜2 分で完成します
                    </p>
                  </div>
                )}
                <div className="p-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    {v.aspectRatio} / {v.durationSeconds}s / {v.provider}
                  </span>
                  {v.status === 'done' && v.blobUrl && (
                    <a
                      href={v.blobUrl}
                      download
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition"
                    >
                      <Download className="w-3 h-3" />
                      MP4
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Phase B.1: 動画生成ダイアログ */}
      {videoDialogImage && (
        <VideoGenerationDialog
          isOpen={true}
          onClose={() => setVideoDialogImage(null)}
          generationId={detail.id}
          inputImageUrl={videoDialogImage.blobUrl}
          imageSizeLabel={videoDialogImage.size}
        />
      )}
    </div>
  );
}
