import Link from 'next/link';

/**
 * Phase A.16: ページ中盤に挟む中間 CTA バナー
 *
 * 機能セクションを読んだ後の "判断モード" のユーザーを掬う。
 * ファネル上部の Hero CTA / 末尾の FinalCta とは異なる「価値理解後の即試し」訴求。
 */
interface Props {
  href?: string;
  headline?: string;
  sub?: string;
}

export const LpInlineCta = ({
  href = '/signin?from=lp01_inline',
  headline = 'ここまで読んだあなたに、いちばん早い体験を。',
  sub = '業種を選ぶだけで、2 秒で AI 生成バナーが見られます。',
}: Props = {}) => {
  return (
    <section
      aria-label="無料体験 CTA"
      className="relative bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-emerald-500/10 border-y border-emerald-500/25"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12 text-center">
        <h3 className="text-xl sm:text-2xl font-black text-slate-100 leading-snug">
          {headline}
        </h3>
        <p className="text-sm text-slate-300 mt-3">{sub}</p>
        <div className="mt-6 flex justify-center">
          <Link
            href={href}
            className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-8 py-4 rounded-lg shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02]"
          >
            いますぐ無料で試してみる
          </Link>
        </div>
        <div className="text-[10px] text-slate-400 mt-4">
          ✓ クレカ不要　✓ Google ワンクリック　✓ いつでも解約
        </div>
      </div>
    </section>
  );
};
