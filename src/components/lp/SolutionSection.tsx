/**
 * Phase A.15: 4 ステップ図解（お題 → 素材 → AI → 完成）
 */
const STEPS = [
  {
    num: '01',
    title: 'お題を書く',
    desc: '商材 / ターゲット / LP URL を1分で入力。',
  },
  {
    num: '02',
    title: '素材を整える',
    desc: '商品画像・認証バッジ・勝ちバナーをアップロード。',
  },
  {
    num: '03',
    title: 'AI が生成',
    desc: '勝ちバナー学習 AI が17 サイズを 90 秒で一括生成。',
  },
  {
    num: '04',
    title: '完成・配信',
    desc: 'そのまま広告配信。あなたは戦略に集中できます。',
  },
];

export const SolutionSection = () => {
  return (
    <section className="bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-50 text-center">
          ブリーフから完成まで <span className="text-emerald-400">90 秒</span>
        </h2>
        <p className="text-slate-400 text-center mt-3">
          4 ステップで「テンプレ作成 0 時間」を実現
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full">
                <div className="text-emerald-400 font-mono text-sm font-bold">{s.num}</div>
                <h3 className="text-lg font-bold text-slate-100 mt-2">{s.title}</h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{s.desc}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-emerald-500/40"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
