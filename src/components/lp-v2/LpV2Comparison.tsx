const ROWS = [
  { label: '1 本あたりの制作時間', ext: '3〜5 営業日', int: '半日〜1 日', ours: '90 秒' },
  { label: '17 サイズ一括対応', ext: '× 都度依頼', int: '× 1 サイズずつ', ours: '◎ 一括' },
  { label: 'コスト構造', ext: '都度制作費が発生', int: '人件費・工数が累積', ours: 'サブスク内で完結' },
  { label: '勝ちパターンの再現', ext: '×', int: '△ 属人化', ours: '◎ AI 学習' },
  { label: '修正・再生成', ext: '× 追加コスト', int: '○', ours: '◎ ワンクリック' },
];

export const LpV2Comparison = () => {
  return (
    <section className="bg-stone-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="text-center mb-12">
          <div className="text-xs font-bold text-emerald-800 tracking-[0.18em] uppercase">
            Comparison
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
            外注 / 内製 / 勝ちバナー作る君
          </h2>
          <p className="text-sm text-slate-500 mt-4">
            コスト・時間・再現性を、いまの選択肢と比べてみてください
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm bg-white rounded-xl overflow-hidden border border-slate-200">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-slate-600 font-medium py-4 px-4 w-1/4">
                  比較項目
                </th>
                <th className="text-center text-slate-600 font-medium py-4 px-4 w-1/4">
                  外注（制作会社）
                </th>
                <th className="text-center text-slate-600 font-medium py-4 px-4 w-1/4">
                  内製（テンプレ）
                </th>
                <th className="text-center text-emerald-800 font-bold py-4 px-4 w-1/4 bg-emerald-700/5">
                  勝ちバナー作る君
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}
                >
                  <td className="text-slate-900 py-4 px-4 font-medium">{row.label}</td>
                  <td className="text-center text-slate-500 py-4 px-4">{row.ext}</td>
                  <td className="text-center text-slate-500 py-4 px-4">{row.int}</td>
                  <td className="text-center text-emerald-800 py-4 px-4 font-bold bg-emerald-700/5">
                    {row.ours}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
