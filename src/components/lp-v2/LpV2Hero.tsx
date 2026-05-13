import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  h1: string;
  h2: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryHref: string;
  visualSlot?: ReactNode;
}

/**
 * Phase A.17: V2 ホワイトテーマ Hero
 *
 * Point Pharma 流: 余白広め・小さいラベル・大きい見出し・落ち着いたバッジ。
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
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-700/30 bg-emerald-700/5 text-xs font-bold text-emerald-800 tracking-wide">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-700"
            />
            EC バナー量産 SaaS
          </div>
          <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.25] tracking-tight">
            {h1}
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed">
            {h2}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full">
              ✓ クレジットカード登録不要
            </span>
            <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full">
              ✓ Google ワンクリック開始
            </span>
            <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full">
              ✓ いつでも解約
            </span>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href={ctaPrimaryHref}
              className="inline-flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-7 py-4 rounded-md shadow-sm transition-all"
            >
              {ctaPrimaryLabel}
            </Link>
            <Link
              href={ctaSecondaryHref}
              className="inline-flex items-center justify-center bg-white hover:bg-slate-50 text-slate-900 font-bold px-7 py-4 rounded-md border border-slate-300 transition-all"
            >
              {ctaSecondaryLabel}
            </Link>
          </div>
        </div>
        {visualSlot && <div className="w-full">{visualSlot}</div>}
      </div>
    </section>
  );
};
