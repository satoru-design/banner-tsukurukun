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
 * Phase A.17.1: V2 Hero モバイル最適化
 *
 * Clarity データで「過去 3 日モバイルの 53% が FV 5% 未満で離脱」を確認。
 * 原因: 旧 LP は visualSlot が hidden lg:block でモバイル非表示、
 *       V2 もデフォルト順だと TryInLp が FV 外。
 *
 * 対策:
 * - モバイルでは visualSlot (TryInLp) を上に、テキストを下に入れ替え
 * - モバイル余白を圧縮 (py-10) して TryInLp が確実に FV に入る
 * - H1 をモバイルではコンパクトに
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-700/30 bg-emerald-700/5 text-[11px] sm:text-xs font-bold text-emerald-800 tracking-wide">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-700"
            />
            EC 広告バナー量産 SaaS
          </div>
          <h1 className="mt-4 text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.25] tracking-tight">
            {h1}
          </h1>
          <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-slate-600 leading-relaxed">
            {h2}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center text-[11px] font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
              ✓ クレカ不要
            </span>
            <span className="inline-flex items-center text-[11px] font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
              ✓ Google ワンクリック
            </span>
            <span className="inline-flex items-center text-[11px] font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
              ✓ いつでも解約
            </span>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
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
      </div>
    </section>
  );
};
