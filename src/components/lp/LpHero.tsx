import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Phase A.15: LP Hero 共通コンポーネント
 * - /lp01 / /lp02 で props を切り替えて A/B 訴求
 */
interface Props {
  h1: string;
  h2: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryHref: string;
  visualSlot?: ReactNode; // ヒーロー右側の視覚要素
}

export const LpHero = ({
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
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-50 leading-tight">
            {h1}
          </h1>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed">{h2}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              ✓ クレカ不要
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              ✓ Google ワンクリック
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              ✓ いつでも解約
            </span>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
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
        </div>
        {visualSlot && (
          <div className="w-full">{visualSlot}</div>
        )}
      </div>
    </section>
  );
};
