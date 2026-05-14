const GROUP_COMPANIES = [
  { name: '4th Avenue Lab', role: '本サービス運営 / D2C 商品企画・販売' },
  { name: 'INK YOU UP', role: 'Web マーケティング支援 / 広告運用' },
  { name: 'Quad', role: '採用支援 / AI・RPA 業務効率化' },
  { name: 'No.4 Group', role: 'グループ統括 / ハンズオン伴走支援' },
] as const;

export const LpV2AboutOperator = () => {
  return (
    <section className="bg-stone-50 border-y border-slate-300/70">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="mb-12">
          <div className="font-serif italic text-sm text-emerald-900">
            私たちのこと
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-black text-slate-900 mt-2 leading-snug">
            広告運用の現場で、
            <br className="sm:hidden" />
            自分たちが欲しかったツール。
          </h2>
        </div>

        {/* 代表挨拶: 左に写真、右にメッセージ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start mb-14">
          <div className="md:col-span-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lp/avatars/koike-satoru.jpg"
              alt="株式会社 4th Avenue Lab 代表取締役 小池 慧"
              className="w-full max-w-[280px] mx-auto md:mx-0 rounded-[20px] border border-slate-300 object-cover aspect-[4/5]"
              loading="lazy"
              decoding="async"
            />
            <div className="mt-4 text-center md:text-left">
              <div className="font-serif font-bold text-slate-900">小池 慧（Satoru Koike）</div>
              <div className="text-xs text-slate-600 mt-1">
                株式会社 4th Avenue Lab 代表取締役
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="font-serif italic text-emerald-900 text-base sm:text-lg leading-relaxed">
              「広告クリエイティブで、一番つらいのは、サイズ違いの量産でした。」
            </p>
            <div className="mt-6 space-y-4 text-sm sm:text-base text-slate-700 leading-[1.95]">
              <p>
                どこの現場でも、勝ちバナーが見つかってから、それを複数サイズに展開する作業に、毎月数百時間が消えていました。デザイナーへの依頼書、修正のやり取り、納期。本当はもっと、戦略と検証に時間を使いたかったと今でも後悔があります。
              </p>
              <p>
                「勝ちバナー作る君」は、自分たちの EC・物販チームが日々の運用で使うために作りました。
                <span className="font-bold text-slate-900">累計 100 社以上のマーケティング支援・3 億円超の広告運用</span>
                を通じて見えた「これさえあれば」を、ひとつのツールに詰めました。
              </p>
            </div>
          </div>
        </div>

        {/* グループ会社 */}
        <div>
          <div className="text-xs text-slate-600 mb-4 font-medium">運営グループ</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {GROUP_COMPANIES.map((co, i) => (
              <div
                key={co.name}
                className={`bg-white border border-slate-300 ${
                  i === 0 ? 'rounded-[16px]' : i === 1 ? 'rounded-[12px]' : i === 2 ? 'rounded-[18px]' : 'rounded-[14px]'
                } p-5 text-center hover:border-emerald-700/40 transition-colors`}
              >
                <div className="font-serif text-sm font-bold text-slate-900">
                  {co.name}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-600 mt-2 leading-relaxed">
                  {co.role}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
