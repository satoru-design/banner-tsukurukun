import Link from 'next/link';

/**
 * Phase A.15-16: LP 共通ヘッダー
 * - ロゴ + signin 導線のみ（ダーク基調、最小構成）
 * - compact=true で「無料で試す」ボタンを非表示にする（lp01 はフローティング CTA に集約）
 */
interface Props {
  compact?: boolean;
}

export const LpHeader = ({ compact = false }: Props) => {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xl">🏆</span>
          <span className="font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
            勝ちバナー作る君
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/signin"
            className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5"
          >
            ログイン
          </Link>
          {!compact && (
            <Link
              href="/signin"
              className="text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-1.5 rounded transition-colors"
            >
              無料で試す
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
