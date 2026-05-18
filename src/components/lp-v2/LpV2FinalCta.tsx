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
          まず <span className="text-emerald-900 italic">10 本</span>、作ってみてください。
        </h2>
        <p className="mt-5 text-base sm:text-lg text-slate-700 leading-[1.85]">
          30 秒で「これは使える」が、分かります。
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-10 py-4 rounded-[10px] transition-colors"
          >
            いますぐ無料で試してみる
          </Link>
          <Link
            href="/signin?from=lp01_final_trial&callbackUrl=%2Fupgrade-trial-pro"
            className="inline-flex items-center justify-center bg-white hover:bg-stone-50 text-emerald-900 font-bold px-10 py-4 rounded-[10px] border-2 border-emerald-800 transition-colors"
          >
            Pro を 7 日間 無料で始める
          </Link>
        </div>
        <p className="mt-5 text-[11px] text-slate-500">
          Pro Trial: 月 100 本＋全 17 サイズ＋プロンプト閲覧。7 日後に自動課金（途中解約 OK）。
        </p>
      </div>
    </section>
  );
};
