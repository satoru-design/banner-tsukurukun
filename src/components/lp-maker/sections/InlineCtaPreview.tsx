import type { CtaProps } from '@/lib/lp/types';

export function InlineCtaPreview({ props }: { props: CtaProps }) {
  return (
    <section className="bg-emerald-500/10 border-y border-emerald-500/30 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-lg sm:text-xl font-bold text-slate-100 mb-5">
          {props.headline}
        </p>
        <button
          type="button"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-lg"
        >
          {props.buttonText}
        </button>
        {props.note && (
          <p className="mt-3 text-xs text-slate-400">{props.note}</p>
        )}
      </div>
    </section>
  );
}
