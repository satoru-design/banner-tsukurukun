import Link from 'next/link';

interface Props {
  href?: string;
  headline?: string;
  sub?: string;
}

export const LpV2InlineCta = ({
  href = '/signin?from=lp01_inline',
  headline = 'ここまで読んでくださった方へ、いちばん早い体験を。',
  sub = '業種を選ぶだけで、2 秒で AI 生成バナーが見られます。',
}: Props = {}) => {
  return (
    <section className="bg-emerald-900/[0.04] border-y border-emerald-800/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16 text-center">
        <h3 className="font-serif text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
          {headline}
        </h3>
        <p className="text-sm text-slate-700 mt-3">{sub}</p>
        <div className="mt-6 flex justify-center">
          <Link
            href={href}
            className="inline-flex items-center justify-center bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-8 py-4 rounded-[10px] transition-colors"
          >
            いますぐ無料で試してみる
          </Link>
        </div>
        <div className="text-[10px] text-slate-500 mt-4">
          ✓ クレカ不要　✓ Google ワンクリック　✓ いつでも解約
        </div>
      </div>
    </section>
  );
};
