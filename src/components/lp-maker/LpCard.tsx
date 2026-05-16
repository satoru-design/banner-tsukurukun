/**
 * LP Maker Pro 2.0 — ダッシュボード用 LP カード（Server Component）。
 *
 * D2-T3: 1 つの LandingPage を要約表示し、編集画面へリンクする。
 */
import Link from 'next/link';
import type { LandingPage } from '@prisma/client';

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  published: '公開中',
  archived: 'アーカイブ',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-300',
  published: 'bg-emerald-500 text-slate-950',
  archived: 'bg-slate-800 text-slate-500',
};

export function LpCard({ lp }: { lp: LandingPage }) {
  return (
    <Link
      href={`/lp-maker/${lp.id}/edit`}
      className="block bg-slate-900 hover:bg-slate-800 rounded-lg p-5 border border-slate-800 hover:border-emerald-500/30 transition"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-slate-100 line-clamp-2">{lp.title}</h3>
        <span
          className={`text-xs px-2 py-1 rounded ${
            STATUS_COLORS[lp.status] ?? 'bg-slate-700'
          }`}
        >
          {STATUS_LABELS[lp.status] ?? lp.status}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        更新: {new Date(lp.updatedAt).toLocaleString('ja-JP')}
      </p>
      {lp.publishedAt && (
        <p className="text-xs text-emerald-400 mt-1">
          公開: {new Date(lp.publishedAt).toLocaleDateString('ja-JP')}
        </p>
      )}
    </Link>
  );
}
