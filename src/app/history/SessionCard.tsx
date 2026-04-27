'use client';

/**
 * Phase A.11.5: 履歴一覧の 1 セッションカード。
 *
 * - 通常表示: サムネ + ブリーフ要約 + 詳細リンク
 * - ロック表示: 鍵アイコン + ぼかしサムネ + クリックでモーダル
 */
import Link from 'next/link';
import { Lock } from 'lucide-react';

interface BriefSummary {
  pattern: string;
  product: string;
  target: string;
  purpose: string;
}

interface SessionImage {
  id: string;
  size: string;
  blobUrl: string;
  isFavorite: boolean;
}

interface SessionCardProps {
  id: string;
  createdAt: string;
  brief: BriefSummary;
  images: SessionImage[];
  locked: boolean;
  onLockClick: () => void;
}

export function SessionCard({
  id,
  createdAt,
  brief,
  images,
  locked,
  onLockClick,
}: SessionCardProps) {
  const dateStr = new Date(createdAt).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const summary = `${brief.product} / ${brief.target} / ${brief.purpose}`;
  const visibleThumbs = images.slice(0, 3);
  const extraCount = Math.max(0, images.length - 3);

  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockClick}
        className="w-full text-left bg-neutral-900/50 border border-slate-800 rounded-lg p-4 hover:bg-neutral-900 transition"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="text-xs text-slate-500">{dateStr}</div>
          <Lock className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-sm text-slate-300 mb-3 truncate">{summary}</div>
        <div className="flex gap-2">
          {visibleThumbs.map((img) => (
            <div
              key={img.id}
              className="w-16 h-16 bg-slate-800 rounded relative overflow-hidden flex items-center justify-center"
            >
              <Lock className="w-6 h-6 text-slate-600" />
            </div>
          ))}
          {extraCount > 0 && (
            <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-500 text-xs">
              +{extraCount}
            </div>
          )}
        </div>
        <div className="text-xs text-amber-400 mt-3">クリックして Pro で解除</div>
      </button>
    );
  }

  return (
    <Link
      href={`/history/${id}`}
      className="block bg-neutral-900/50 border border-slate-800 rounded-lg p-4 hover:bg-neutral-900 transition"
    >
      <div className="text-xs text-slate-500 mb-2">{dateStr}</div>
      <div className="text-sm text-slate-200 mb-3 truncate">{summary}</div>
      <div className="flex gap-2">
        {visibleThumbs.map((img) => (
          <div
            key={img.id}
            className="w-16 h-16 bg-slate-800 rounded overflow-hidden relative"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.blobUrl}
              alt={img.size}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {img.isFavorite && (
              <div className="absolute top-0 right-0 text-amber-300 text-xs px-1">
                ★
              </div>
            )}
          </div>
        ))}
        {extraCount > 0 && (
          <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-400 text-xs">
            +{extraCount}
          </div>
        )}
      </div>
    </Link>
  );
}
