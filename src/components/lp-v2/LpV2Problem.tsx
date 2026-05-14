const PROBLEMS = [
  {
    num: '01',
    title: '1 本作るのに 4〜6 時間',
    desc: 'ベース構成・配置・コピー検討に追われ、検証回数は週 1〜2 回が限界。',
  },
  {
    num: '02',
    title: 'サイズ違いで、毎回数日待ち',
    desc: 'Instagram / Display / リワード… サイズが違うたびにデザイナーへ依頼。納期に間に合わない。',
  },
  {
    num: '03',
    title: '勝った理由を、社内に残せない',
    desc: '成果バナーがあっても、なぜ勝ったのか言語化できず、翌月にはまた手探り。',
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
            「サイズ展開で 1 日が終わった」を、
            <br className="md:hidden" />
            もう繰り返したくない。
          </h2>
          <p className="text-sm text-slate-600 mt-4 max-w-2xl">
            EC マーケと代理店の現場で、最も時間を奪う「3 つの定型」。
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
