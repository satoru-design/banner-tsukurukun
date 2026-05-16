import type { ProblemProps } from '@/lib/lp/types';

export function ProblemPreview({ props }: { props: ProblemProps }) {
  return (
    <section className="bg-slate-900 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {props.headline}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {props.items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-800 rounded-lg p-6 border border-slate-700"
            >
              <h3 className="text-lg font-bold text-amber-300 mb-3">
                {item.title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
