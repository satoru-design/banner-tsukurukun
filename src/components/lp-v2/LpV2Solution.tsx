const STEPS = [
  { num: '01', title: 'お題を書く', desc: '商材 / ターゲット / LP URL を 1 分で入力。' },
  { num: '02', title: '素材を整える', desc: '商品画像・認証バッジ・勝ちバナーをアップロード。' },
  { num: '03', title: 'AI が生成', desc: '勝ちバナー学習 AI が17 サイズを 90 秒で一括生成。' },
  { num: '04', title: '完成・配信', desc: 'そのまま広告配信。あなたは戦略に集中できます。' },
];

export const LpV2Solution = () => {
  return (
    <section className="bg-stone-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-12">
          <div className="text-xs font-bold text-emerald-800 tracking-[0.18em] uppercase">
            How it works
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 leading-snug">
            ブリーフから完成まで
            <span className="text-emerald-800"> 最短 90 秒</span>
          </h2>
          <p className="text-sm text-slate-500 mt-4">
            4 ステップで「テンプレ作成 0 時間」を実現
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative">
              <div className="bg-white border border-slate-200 rounded-xl p-6 h-full">
                <div className="text-emerald-800 font-mono text-xs font-bold tabular-nums tracking-widest">
                  {s.num}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-3">{s.title}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{s.desc}</p>
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
