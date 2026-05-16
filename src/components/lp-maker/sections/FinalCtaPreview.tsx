import type { CtaProps } from '@/lib/lp/types';

export function FinalCtaPreview({ props }: { props: CtaProps }) {
  return (
    <section className="bg-gradient-to-br from-emerald-600 to-emerald-700 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-5xl font-black text-slate-950 mb-8">
          {props.headline}
        </h2>
        <button
          type="button"
          className="bg-slate-950 hover:bg-slate-800 text-emerald-400 font-bold text-lg px-10 py-5 rounded-lg shadow-2xl"
        >
          {props.buttonText}
        </button>
        {props.note && (
          <p className="mt-5 text-sm text-slate-950/80 font-bold">
            {props.note}
          </p>
        )}
      </div>
    </section>
  );
}
