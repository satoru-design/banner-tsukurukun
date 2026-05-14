import Link from 'next/link';

export const LpV2Header = () => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-300/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span
            aria-hidden
            className="inline-block w-1 h-5 bg-emerald-800 rounded-sm"
          />
          <span className="font-serif font-bold text-slate-900 tracking-tight">
            勝ちバナー作る君
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/signin"
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5"
          >
            ログイン
          </Link>
        </nav>
      </div>
    </header>
  );
};
