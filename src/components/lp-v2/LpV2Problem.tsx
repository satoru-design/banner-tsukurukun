const PROBLEMS = [
  {
    num: '01',
    title: 'テンプレ作成に半日',
    desc: 'バナー1枚作るのに、ベース構成・配置・コピー検討で 4〜6 時間。検証回数を増やせない。',
  },
  {
    num: '02',
    title: 'サイズ違いを毎回追い発注',
    desc: 'Instagram / Display / リワード広告... サイズが違うたびにデザイナーへ依頼。納期が伸びる。',
  },
  {
    num: '03',
    title: '勝ちパターンが社内に蓄積されない',
    desc: '広告で成果が出たバナーがあっても、なぜ勝ったのか言語化できず再現できない。',
  },
];

export const LpV2Problem = () => {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-12">
          <div className="text-xs font-bold text-emerald-800 tracking-[0.18em] uppercase">
            Problems
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 leading-snug">
            あなたの広告クリエイティブ、
            <br className="md:hidden" />
            ここで止まっていませんか？
          </h2>
          <p className="text-sm text-slate-500 mt-4">
            EC・代理店の現場で繰り返される、3 つの停滞
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="border-l-2 border-emerald-700 pl-5">
              <div className="text-emerald-800 font-mono text-xs font-bold tabular-nums tracking-widest">
                {p.num}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-2">{p.title}</h3>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
