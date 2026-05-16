import type { SolutionProps } from '@/lib/lp/types';

export function SolutionPreview({ props }: { props: SolutionProps }) {
  return (
    <section className="bg-slate-950 text-slate-100 py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-6">
          {props.headline}
        </h2>
        <p className="text-lg text-slate-300 leading-relaxed">
          {props.description}
        </p>
        {props.imageUrl && (
          <img
            src={props.imageUrl}
            alt=""
            className="mt-10 mx-auto rounded-lg max-w-2xl"
          />
        )}
      </div>
    </section>
  );
}
