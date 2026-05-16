import type { HeroProps } from '@/lib/lp/types';

export function HeroPreview({ props }: { props: HeroProps }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-slate-50">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.20),_transparent_60%)]"
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
            {props.headline}
          </h1>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed">
            {props.subheadline}
          </p>
          <div className="mt-8">
            <button
              type="button"
              className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-4 rounded-lg shadow-lg shadow-emerald-500/20"
            >
              {props.ctaText}
            </button>
          </div>
        </div>
        {props.imageUrl && (
          <div className="relative">
            <img
              src={props.imageUrl}
              alt=""
              className="w-full h-auto rounded-lg shadow-2xl"
            />
          </div>
        )}
      </div>
    </section>
  );
}
