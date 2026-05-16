import type { PricingProps } from '@/lib/lp/types';

export function PricingPreview({ props }: { props: PricingProps }) {
  return (
    <section className="bg-slate-900 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {props.headline}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {props.plans.map((plan, idx) => (
            <div
              key={idx}
              className={`bg-slate-800 rounded-lg p-6 border ${
                idx === 1
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'border-slate-700'
              }`}
            >
              <h3 className="text-lg font-bold text-emerald-300 mb-2">
                {plan.name}
              </h3>
              <p className="text-3xl font-black mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f, i) => (
                  <li
                    key={i}
                    className="text-xs text-slate-300 flex items-start gap-2"
                  >
                    <span className="text-emerald-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded"
              >
                {plan.ctaText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
