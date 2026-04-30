import Link from 'next/link';

/**
 * Phase A.15: LP 共通フッター
 * - 会社情報 + プライバシーポリシー + 利用規約 + 問合せ + Twitter（最小限）
 */
export const LpFooter = () => {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-sm text-slate-400">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="font-bold text-slate-200 mb-2">勝ちバナー作る君</div>
            <p className="text-xs leading-relaxed">
              EC サイトのバナー制作時間を 1/10 に。<br />
              AI が勝ちバナーを学習して 17 サイズを 90 秒で一括生成します。
            </p>
          </div>
          <div>
            <div className="font-bold text-slate-200 mb-2">運営</div>
            <p className="text-xs leading-relaxed">
              株式会社 4th Avenue Lab<br />
              インボイス登録番号: T8010901045333
            </p>
          </div>
          <div>
            <div className="font-bold text-slate-200 mb-2">リンク</div>
            <ul className="space-y-1 text-xs">
              <li>
                <Link href="/contact" className="hover:text-emerald-300 transition-colors">
                  お問合せ・大規模利用相談
                </Link>
              </li>
              <li>
                <Link href="/lp01" className="hover:text-emerald-300 transition-colors">
                  サービス概要
                </Link>
              </li>
              <li>
                <Link href="/legal/tokutei" className="hover:text-emerald-300 transition-colors">
                  特定商取引法に基づく表記
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-emerald-300 transition-colors">
                  利用規約
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="hover:text-emerald-300 transition-colors">
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <a
                  href="https://twitter.com/strkk_co"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-300 transition-colors"
                >
                  X (Twitter)
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-8 pt-4 text-xs text-slate-500 text-center">
          © {new Date().getFullYear()} 株式会社 4th Avenue Lab. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
