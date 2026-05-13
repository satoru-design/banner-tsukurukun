const STATS = [
  { number: '90秒', label: 'で 17 サイズを一括生成', sub: 'ブリーフ投入から完成バナー到着まで' },
  { number: '1/10', label: 'にバナー制作時間を圧縮', sub: '従来の外注・内製ワークフロー比' },
  { number: '1', suffix: 'クリック', label: 'で無料体験スタート', sub: 'クレカ不要・Google で即開始' },
];

export const LpV2NumericProof = () => {
  return (
    <section className="bg-stone-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="px-4">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl sm:text-6xl font-black text-emerald-800 leading-none tracking-tight tabular-nums">
                  {s.number}
                </span>
                {s.suffix && (
                  <span className="text-xl sm:text-2xl font-black text-emerald-800 leading-none">
                    {s.suffix}
                  </span>
                )}
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-900 mt-4">
                {s.label}
              </div>
              <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
