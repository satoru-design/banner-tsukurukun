const PROBLEMS = [
  {
    num: '01',
    title: 'テンプレ作成に半日',
    desc: 'バナー 1 枚作るのに、ベース構成・配置・コピー検討で 4〜6 時間。検証回数を増やせない。',
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
        <div className="mb-12">
          <div className="font-serif italic text-sm text-emerald-900">
            現場で起きていること
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-black text-slate-900 mt-2 leading-snug">
            あなたの広告クリエイティブ、
            <br className="md:hidden" />
            ここで止まっていませんか？
          </h2>
          <p className="text-sm text-slate-600 mt-4 max-w-2xl">
            EC・代理店の現場で繰り返される、3 つの停滞。私たちも、ずっとそうでした。
          </p>
        </div>
        {/* 非対称配置: 01 大カード + 02/03 縦並び */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-3 border border-slate-300 rounded-[18px] p-7 bg-stone-50">
            <div className="font-serif italic text-emerald-800 text-base font-bold">
              {PROBLEMS[0].num}
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-2">
              {PROBLEMS[0].title}
            </h3>
            <p className="text-sm text-slate-700 mt-3 leading-[1.85]">{PROBLEMS[0].desc}</p>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 gap-6">
            {PROBLEMS.slice(1).map((p) => (
              <div
                key={p.title}
                className="border-l-2 border-emerald-800 pl-5 py-2"
              >
                <div className="font-serif italic text-emerald-800 text-sm font-bold">
                  {p.num}
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900 mt-1">{p.title}</h3>
                <p className="text-sm text-slate-700 mt-2 leading-[1.85]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
