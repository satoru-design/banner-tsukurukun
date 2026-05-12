/**
 * Phase A.17: 運営背景セクション
 *
 * 「AI が生成したサイトに見える」状態を打破するため、
 * 運営チームの実績・グループ会社で「人間が作ったビジネスツール」という文脈を提供する。
 *
 * 数字はすべて実態に基づくもののみ（誠実性ライン担保）。
 */
const GROUP_COMPANIES = [
  { name: '4th Avenue Lab', role: '本サービス運営 / D2C 商品企画・販売' },
  { name: 'INK YOU UP', role: 'Web マーケティング支援 / 広告運用' },
  { name: 'Quad', role: '採用支援 / AI・RPA 業務効率化' },
  { name: 'No.4 Group', role: 'グループ統括 / ハンズオン伴走支援' },
] as const;

export const LpAboutOperator = () => {
  return (
    <section className="bg-slate-900 border-y border-slate-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <span className="text-xs font-bold text-slate-400 tracking-[0.25em] uppercase">
            About Us
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-50 mt-3 leading-snug">
            広告運用の現場で生まれた、
            <br className="sm:hidden" />
            実務向けツールです
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mt-5 leading-relaxed max-w-3xl mx-auto">
            「勝ちバナー作る君」は、累計
            <span className="text-slate-100 font-bold"> 100 社以上 </span>
            のマーケティング支援・
            <span className="text-slate-100 font-bold"> 3 億円超 </span>
            の広告運用実績を持つ
            <br className="hidden sm:block" />
            <span className="text-slate-100 font-bold">株式会社 4th Avenue Lab</span>{' '}
            グループが、自社の現場で必要だった機能を製品化したものです。
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {GROUP_COMPANIES.map((co) => (
            <div
              key={co.name}
              className="bg-slate-950 border border-slate-800 rounded-lg p-4 sm:p-5 text-center hover:border-slate-700 transition-colors"
            >
              <div className="text-sm font-bold text-slate-100 tracking-tight">
                {co.name}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 mt-2 leading-relaxed">
                {co.role}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 mt-8">
          代表取締役 / 小池 慧（楽天・RIZAP・FreakOut・Creema を経て独立、ネクイノ マーケティング部 部長を歴任）
        </p>
      </div>
    </section>
  );
};
