import type { VoiceProps } from '@/lib/lp/types';

export function VoicePreview({ props }: { props: VoiceProps }) {
  return (
    <section className="bg-slate-950 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {props.headline}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {props.items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900 rounded-lg p-5 border border-slate-800"
            >
              <p className="text-sm text-slate-200 leading-relaxed">
                「{item.quote}」
              </p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">{item.author}</p>
                {item.proofBadge && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">
                    {item.proofBadge}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
