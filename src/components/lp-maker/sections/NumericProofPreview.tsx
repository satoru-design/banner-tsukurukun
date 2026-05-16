import type { NumericProofProps } from '@/lib/lp/types';

export function NumericProofPreview({ props }: { props: NumericProofProps }) {
  return (
    <section className="bg-slate-950 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {props.items.map((item, idx) => (
            <div key={idx}>
              <p className="text-5xl sm:text-6xl font-black text-emerald-400">
                {item.number}
              </p>
              <p className="mt-3 text-sm font-bold text-slate-200">
                {item.label}
              </p>
              {item.note && (
                <p className="mt-1 text-xs text-slate-500">{item.note}</p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-[10px] text-slate-600">
          ※ 数値の出典・根拠は本サービス公開者の責任により表示されています
        </p>
      </div>
    </section>
  );
}
