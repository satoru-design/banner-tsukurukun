import Link from 'next/link';

interface Props {
  primaryHref?: string;
}

export const LpV2FinalCta = ({
  primaryHref = '/signin?from=lp01_final',
}: Props = {}) => {
  return (
    <section className="bg-emerald-700/5 border-t border-emerald-700/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">
          まずは <span className="text-emerald-800">3 本まで無料</span> で試してみる
        </h2>
        <p className="mt-5 text-base sm:text-lg text-slate-600">
          クレカ不要 / Google アカウントで 1 クリック開始 / 効果を試してから有料化
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-10 py-4 rounded-md shadow-sm transition-all"
          >
            いますぐ無料で試してみる
          </Link>
        </div>
      </div>
    </section>
  );
};
