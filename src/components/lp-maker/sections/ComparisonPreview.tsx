import type { ComparisonProps } from '@/lib/lp/types';

export function ComparisonPreview({ props }: { props: ComparisonProps }) {
  return (
    <section className="bg-slate-900 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">
          {props.headline}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full bg-slate-800 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-700">
                <th className="text-left text-xs uppercase tracking-wide px-4 py-3 text-slate-400">
                  項目
                </th>
                {props.columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`text-center text-sm font-bold px-4 py-3 ${
                      idx === 0 ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rowLabels.map((label, rowIdx) => (
                <tr key={rowIdx} className="border-t border-slate-700">
                  <td className="text-sm font-bold text-slate-300 px-4 py-3">
                    {label}
                  </td>
                  {props.columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`text-sm px-4 py-3 text-center ${
                        colIdx === 0
                          ? 'text-emerald-300 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {col.rows[rowIdx]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
