import Link from 'next/link';

interface Props {
  href?: string;
  headline?: string;
  sub?: string;
}

export const LpV2InlineCta = ({
  href = '/signin?from=lp01_inline',
  headline = 'ここまで読んだあなたに、いちばん早い体験を。',
  sub = '業種を選ぶだけで、2 秒で AI 生成バナーが見られます。',
}: Props = {}) => {
  return (
    <section className="bg-emerald-700/5 border-y border-emerald-700/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-16 text-center">
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
          {headline}
        </h3>
        <p className="text-sm text-slate-600 mt-3">{sub}</p>
        <div className="mt-6 flex justify-center">
          <Link
            href={href}
            className="inline-flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-8 py-4 rounded-md shadow-sm transition-all"
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
