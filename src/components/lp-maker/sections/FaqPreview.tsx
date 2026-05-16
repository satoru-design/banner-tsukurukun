import type { FaqProps } from '@/lib/lp/types';

export function FaqPreview({ props }: { props: FaqProps }) {
  return (
    <section className="bg-slate-950 text-slate-100 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">
          {props.headline}
        </h2>
        <div className="space-y-3">
          {props.items.map((item, idx) => (
            <details
              key={idx}
              className="bg-slate-900 rounded-lg p-5 border border-slate-800"
            >
              <summary className="font-bold cursor-pointer text-slate-200">
                Q. {item.question}
              </summary>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
