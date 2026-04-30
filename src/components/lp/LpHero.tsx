import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Phase A.15: LP Hero 共通コンポーネント
 * - /lp01 / /lp02 で props を切り替えて A/B 訴求
 */
interface Props {
  variantBadge: string; // "機能訴求" / "時短訴求" 等の小さなバッジ
  h1: string;
  h2: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryHref: string;
  visualSlot?: ReactNode; // ヒーロー右側の視覚要素
}

export const LpHero = ({
  variantBadge,
  h1,
  h2,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  ctaPrimaryHref,
  ctaSecondaryHref,
  visualSlot,
}: Props) => {
  return (
    <section className="relative overflow-hidden">
      {/* radial highlight */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.20),_transparent_60%)]"
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1 mb-4">
            {variantBadge}
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-50 leading-tight">
            {h1}
          </h1>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed">{h2}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href={ctaPrimaryHref}
              className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-4 rounded-lg shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              {ctaPrimaryLabel}
            </Link>
            <Link
              href={ctaSecondaryHref}
              className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-6 py-4 rounded-lg border border-slate-700 transition-all"
            >
              {ctaSecondaryLabel}
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            クレジットカード登録不要 / Google アカウントで 1 クリック開始
          </p>
        </div>
        <div className="hidden lg:block">{visualSlot}</div>
      </div>
    </section>
  );
};
