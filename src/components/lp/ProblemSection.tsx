/**
 * Phase A.15: 「こんな経験ありませんか?」3 ペイン
 */
const PROBLEMS = [
  {
    icon: '⏳',
    title: 'テンプレ作成に半日',
    desc: 'バナー1枚作るのに、ベース構成・配置・コピー検討で 4〜6 時間。検証回数を増やせない。',
  },
  {
    icon: '📐',
    title: 'サイズ違いを毎回追い発注',
    desc: 'Instagram / Display / リワード広告... サイズが違うたびにデザイナーへ依頼。納期が伸びる。',
  },
  {
    icon: '🔬',
    title: '勝ちパターンが社内に蓄積されない',
    desc: '広告で成果が出たバナーがあっても、なぜ勝ったのか言語化できず再現できない。',
  },
];

export const ProblemSection = () => {
  return (
    <section className="bg-slate-900 border-y border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-50 text-center">
          あなたの広告クリエイティブ、
          <br className="md:hidden" />
          ここで止まっていませんか？
        </h2>
        <p className="text-slate-400 text-center mt-3">
          EC・代理店の現場で繰り返される、3 つの停滞
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROBLEMS.map((p) => (
            <div
              key={p.title}
              className="bg-slate-950 border border-slate-800 rounded-xl p-6"
            >
              <div className="text-4xl mb-3">{p.icon}</div>
              <h3 className="text-lg font-bold text-slate-100">{p.title}</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
