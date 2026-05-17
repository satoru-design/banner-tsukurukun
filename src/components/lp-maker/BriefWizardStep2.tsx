/**
 * LP Maker Pro 2.0 — Brief ウィザード STEP2（Client Component）。
 *
 * ターゲット / 価格 / オファー特典 を入力する。
 * 必須項目: target, price, offer。
 */
'use client';
import type { LpBrief } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  onChange: (b: Partial<LpBrief>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function BriefWizardStep2({ brief, onChange, onBack, onNext }: Props) {
  const canNext = !!(brief.target && brief.price && brief.offer);

  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 2: ターゲットとオファー</h2>

      <label className="block">
        <span className="text-sm text-slate-300">
          ターゲット <span className="text-red-400">*</span>
        </span>
        <textarea
          value={brief.target ?? ''}
          onChange={(e) => onChange({ ...brief, target: e.target.value })}
          placeholder="例: 30〜40代の働く女性、ダイエットに何度も挫折経験あり、即効性と続けやすさを両立した方法を探している"
          rows={3}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          価格・料金 <span className="text-red-400">*</span>
        </span>
        <input
          type="text"
          value={brief.price ?? ''}
          onChange={(e) => onChange({ ...brief, price: e.target.value })}
          placeholder="例: 月額 3,980 円 / 買い切り 12,800 円"
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          オファー特典 <span className="text-red-400">*</span>
        </span>
        <textarea
          value={brief.offer ?? ''}
          onChange={(e) => onChange({ ...brief, offer: e.target.value })}
          placeholder="例: 初回 70% OFF、14日間返金保証、送料無料"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded"
        >
          ← 戻る
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded disabled:opacity-30 disabled:cursor-not-allowed"
        >
          次へ →
        </button>
      </div>
    </section>
  );
}
