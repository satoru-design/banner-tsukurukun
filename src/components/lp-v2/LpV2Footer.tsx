import Link from 'next/link';

export const LpV2Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-sm text-slate-600">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="inline-block w-1 h-5 bg-emerald-700 rounded-sm" />
              <span className="font-bold text-slate-900 tracking-tight">勝ちバナー作る君</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mt-3">
              EC サイトのバナー制作時間を 1/10 に。
              <br />
              AI が勝ちバナーを学習して 17 サイズを 90 秒で一括生成します。
            </p>
          </div>
          <div>
            <div className="font-bold text-slate-900 mb-3">運営</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              株式会社 4th Avenue Lab
              <br />
              インボイス登録番号: T8010901045333
            </p>
          </div>
          <div>
            <div className="font-bold text-slate-900 mb-3">リンク</div>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/contact" className="text-slate-500 hover:text-emerald-800 transition-colors">
                  お問合せ・大規模利用相談
                </Link>
              </li>
              <li>
                <Link href="/lp01" className="text-slate-500 hover:text-emerald-800 transition-colors">
                  サービス概要
                </Link>
              </li>
              <li>
                <Link href="/legal/tokutei" className="text-slate-500 hover:text-emerald-800 transition-colors">
                  特定商取引法に基づく表記
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-slate-500 hover:text-emerald-800 transition-colors">
                  利用規約
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-slate-500 hover:text-emerald-800 transition-colors">
                  プライバシーポリシー
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200 mt-8 pt-4 text-xs text-slate-400 text-center">
          © {new Date().getFullYear()} 株式会社 4th Avenue Lab. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
