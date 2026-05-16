import type { FeaturesProps } from '@/lib/lp/types';

export function FeaturesPreview({ props }: { props: FeaturesProps }) {
  return (
    <section className="bg-slate-900 text-slate-100 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {props.headline}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {props.items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-800 rounded-lg p-5 border border-slate-700"
            >
              {item.iconHint && (
                <div className="text-emerald-400 text-2xl mb-3">★</div>
              )}
              <h3 className="font-bold text-emerald-300 mb-2">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
