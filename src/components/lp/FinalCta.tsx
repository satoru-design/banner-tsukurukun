import Link from 'next/link';

/**
 * Phase A.15: Final CTA セクション
 */
export const FinalCta = () => {
  return (
    <section className="relative bg-slate-900 border-t border-slate-800 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,_rgba(16,185,129,0.30),_transparent_55%)]"
      />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-5xl font-black text-slate-50 leading-tight">
          まずは <span className="text-emerald-400">3 セッション無料</span> で試してみる
        </h2>
        <p className="mt-5 text-lg text-slate-300">
          クレカ不要 / Google アカウントで 1 クリック開始 / 効果を試してから有料化
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signin"
            className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-4 rounded-lg shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02]"
          >
            今すぐ無料で試す
          </Link>
          <Link
            href="#pricing"
            className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-8 py-4 rounded-lg border border-slate-700 transition-all"
          >
            料金プランを見る
          </Link>
        </div>
      </div>
    </section>
  );
};
