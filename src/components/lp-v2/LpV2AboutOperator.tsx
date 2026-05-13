const GROUP_COMPANIES = [
  { name: '4th Avenue Lab', role: '本サービス運営 / D2C 商品企画・販売' },
  { name: 'INK YOU UP', role: 'Web マーケティング支援 / 広告運用' },
  { name: 'Quad', role: '採用支援 / AI・RPA 業務効率化' },
  { name: 'No.4 Group', role: 'グループ統括 / ハンズオン伴走支援' },
] as const;

export const LpV2AboutOperator = () => {
  return (
    <section className="bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-12">
          <div className="text-xs font-bold text-emerald-800 tracking-[0.18em] uppercase">
            About Us
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 leading-snug">
            広告運用の現場で生まれた、
            <br className="sm:hidden" />
            実務向けツールです
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-6 leading-relaxed max-w-3xl mx-auto">
            「勝ちバナー作る君」は、累計
            <span className="text-slate-900 font-bold"> 100 社以上 </span>
            のマーケティング支援・
            <span className="text-slate-900 font-bold"> 3 億円超 </span>
            の広告運用実績を持つ
            <br className="hidden sm:block" />
            <span className="text-slate-900 font-bold">株式会社 4th Avenue Lab</span>
            {' '}グループが、自社の現場で必要だった機能を製品化したものです。
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {GROUP_COMPANIES.map((co) => (
            <div
              key={co.name}
              className="bg-stone-50 border border-slate-200 rounded-lg p-5 text-center hover:border-emerald-700/30 transition-colors"
            >
              <div className="text-sm font-bold text-slate-900 tracking-tight">
                {co.name}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 mt-2 leading-relaxed">
                {co.role}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 mt-10">
          代表取締役 / 小池 慧（楽天・RIZAP・FreakOut・Creema を経て独立、ネクイノ マーケティング部 部長を歴任）
        </p>
      </div>
    </section>
  );
};
