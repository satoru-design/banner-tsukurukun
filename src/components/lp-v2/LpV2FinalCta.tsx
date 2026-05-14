import Link from 'next/link';

interface Props {
  primaryHref?: string;
}

export const LpV2FinalCta = ({
  primaryHref = '/signin?from=lp01_final',
}: Props = {}) => {
  return (
    <section className="bg-white border-t border-slate-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
        <h2 className="font-serif text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
          まずは <span className="text-emerald-900 italic">3 本まで無料</span>。
        </h2>
        <p className="mt-5 text-base sm:text-lg text-slate-700 leading-[1.85]">
          クレカ不要 / Google アカウントで 1 クリック開始 / 効果を試してから有料化。
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-10 py-4 rounded-[10px] transition-colors"
          >
            いますぐ無料で試してみる
          </Link>
        </div>
      </div>
    </section>
  );
};
