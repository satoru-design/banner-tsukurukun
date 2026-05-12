/**
 * Phase A.16: 数値プルーフセクション
 *
 * Hero 直後に配置し「これは本物のツール」という信用を一段強める。
 * 全ての数字は実態に基づくもののみ（景表法・誠実性配慮）。
 */
const STATS = [
  {
    number: '90秒',
    suffix: '',
    label: 'で 17 サイズを一括生成',
    sub: 'ブリーフ投入から完成バナー到着まで',
  },
  {
    number: '1/10',
    suffix: '',
    label: 'にバナー制作時間を圧縮',
    sub: '従来の外注・内製ワークフロー比',
  },
  {
    number: '1',
    suffix: 'クリック',
    label: 'で無料体験スタート',
    sub: 'クレカ不要・Google で即開始',
  },
];

export const NumericProofSection = () => {
  return (
    <section className="relative bg-gradient-to-b from-slate-950 to-slate-900 border-y border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="px-4">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl sm:text-6xl font-black text-emerald-400 leading-none tracking-tight">
                  {s.number}
                </span>
                {s.suffix && (
                  <span className="text-2xl font-black text-emerald-400 leading-none">
                    {s.suffix}
                  </span>
                )}
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-100 mt-3">
                {s.label}
              </div>
              <div className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
