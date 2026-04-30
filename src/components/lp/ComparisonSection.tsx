/**
 * Phase A.15: 3 列比較表（外注 / 内製テンプレ / 勝ちバナー作る君）
 */
const ROWS = [
  {
    label: '1 セッション当たりの時間',
    ext: '3〜5 営業日',
    int: '半日〜1 日',
    ours: '90 秒',
  },
  {
    label: '17 サイズ一括対応',
    ext: '× 都度依頼',
    int: '× 1 サイズずつ',
    ours: '◎ 一括',
  },
  {
    label: '1 セッション当たりのコスト',
    ext: '¥50,000〜',
    int: '人件費 ¥10,000〜',
    ours: '¥148〜（Pro）',
  },
  {
    label: '勝ちパターンの再現',
    ext: '×',
    int: '△ 属人化',
    ours: '◎ AI 学習',
  },
  {
    label: '修正・再生成',
    ext: '× 追加コスト',
    int: '○',
    ours: '◎ ワンクリック',
  },
];

export const ComparisonSection = () => {
  return (
    <section className="bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-50 text-center">
          外注 / 内製 / 勝ちバナー作る君
        </h2>
        <p className="text-slate-400 text-center mt-3">
          コスト・時間・再現性を、いまの選択肢と比べてみてください
        </p>
        <div className="mt-12 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-400 font-medium py-3 px-3 w-1/4">
                  比較項目
                </th>
                <th className="text-center text-slate-400 font-medium py-3 px-3 w-1/4">
                  外注（制作会社）
                </th>
                <th className="text-center text-slate-400 font-medium py-3 px-3 w-1/4">
                  内製（テンプレ）
                </th>
                <th className="text-center text-emerald-300 font-bold py-3 px-3 w-1/4 bg-emerald-500/5 rounded-t">
                  勝ちバナー作る君
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  className={
                    i % 2 === 0 ? 'bg-slate-900/40' : 'bg-transparent'
                  }
                >
                  <td className="text-slate-300 py-3 px-3 font-medium">{row.label}</td>
                  <td className="text-center text-slate-400 py-3 px-3">{row.ext}</td>
                  <td className="text-center text-slate-400 py-3 px-3">{row.int}</td>
                  <td className="text-center text-emerald-200 py-3 px-3 font-bold bg-emerald-500/5">
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
