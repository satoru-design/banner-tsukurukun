const STEPS = [
  { num: '01', title: 'お題を書く', desc: '商材 / ターゲット / LP URL を 1 分で入力。' },
  { num: '02', title: '素材を整える', desc: '商品画像・認証バッジ・勝ちバナーをアップロード。' },
  { num: '03', title: 'AI が生成', desc: '勝ちバナー学習 AI が 17 サイズを 90 秒で一括生成。' },
  { num: '04', title: '完成・配信', desc: 'そのまま広告配信。あなたは戦略に集中できます。' },
];

export const LpV2Solution = () => {
  return (
    <section className="bg-stone-50 border-y border-slate-300/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-12">
          <div className="font-serif italic text-sm text-emerald-900">
            使い方は、4 つだけ
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-black text-slate-900 mt-2 leading-snug">
            4 ステップで、ブリーフから
            <br className="md:hidden" />
            <span className="text-emerald-900"> 90 秒</span>。
          </h2>
          <p className="text-sm text-slate-600 mt-4">
            お題を書いて、待つ。それだけ。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative">
              <div
                className={`bg-white border border-slate-300 ${
                  i === 0 ? 'rounded-[18px]' : i === 1 ? 'rounded-[14px]' : i === 2 ? 'rounded-[20px]' : 'rounded-[16px]'
                } p-6 h-full`}
              >
                <div className="font-serif italic text-emerald-800 text-sm font-bold">
                  {s.num}
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900 mt-3">{s.title}</h3>
                <p className="text-sm text-slate-700 mt-2 leading-[1.85]">{s.desc}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-emerald-700/40"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
