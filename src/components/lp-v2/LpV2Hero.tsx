import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  h1: ReactNode;
  h2: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryHref: string;
  visualSlot?: ReactNode;
}

/**
 * Phase A.18: V3 Editorial Hero
 *
 * 改修:
 * - 見出しに Fraunces (serif) を適用、手書き SVG 下線で人間味
 * - 英語ラベル撤去・日本語小ラベル化
 * - shadow 全撤去 (border のみ)
 * - 角丸を rounded-[14px] 等で不揃い化
 */
export const LpV2Hero = ({
  h1,
  h2,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  ctaPrimaryHref,
  ctaSecondaryHref,
  visualSlot,
}: Props) => {
  return (
    <section className="relative bg-white">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        {/* visualSlot: mobile では先頭、desktop では右側 */}
        {visualSlot && (
          <div className="order-1 lg:order-2 w-full">{visualSlot}</div>
        )}

        {/* テキストブロック: mobile では下、desktop では左 */}
        <div className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-800/40 bg-white text-[11px] sm:text-xs font-bold text-emerald-900">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-700"
            />
            EC 広告バナーを、量産する SaaS です
          </div>
          <h1 className="mt-5 font-serif text-[1.7rem] sm:text-4xl lg:text-[3rem] font-black text-slate-900 leading-[1.35] tracking-tight">
            {h1}
          </h1>
          <p className="mt-5 sm:mt-6 text-sm sm:text-lg text-slate-700 leading-[1.85]">
            {h2}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center text-[11px] font-medium text-slate-700 border border-slate-300 px-2.5 py-1 rounded-[20px]">
              ✓ クレカ不要
            </span>
            <span className="inline-flex items-center text-[11px] font-medium text-slate-700 border border-slate-300 px-2.5 py-1 rounded-[20px]">
              ✓ Google ワンクリック
            </span>
            <span className="inline-flex items-center text-[11px] font-medium text-slate-700 border border-slate-300 px-2.5 py-1 rounded-[20px]">
              ✓ いつでも解約
            </span>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href={ctaPrimaryHref}
              className="inline-flex items-center justify-center bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-7 py-4 rounded-[10px] transition-all"
            >
              {ctaPrimaryLabel}
            </Link>
            <Link
              href={ctaSecondaryHref}
              className="inline-flex items-center justify-center bg-white hover:bg-stone-50 text-slate-900 font-medium px-7 py-4 rounded-[10px] border border-slate-400 transition-all"
            >
              {ctaSecondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
