/**
 * LP Maker Pro 2.0 — Brief ウィザード STEP2（Client Component）。
 *
 * ターゲット / 顧客の悩み を入力する。
 * 必須項目: target, customerPain。
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
  const canNext = !!(brief.target && brief.customerPain);

  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 2: ターゲットとペイン</h2>

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
          顧客の悩み・購入障壁 <span className="text-red-400">*</span>
        </span>
        <textarea
          value={brief.customerPain ?? ''}
          onChange={(e) => onChange({ ...brief, customerPain: e.target.value })}
          placeholder="例: 過去のダイエットで体調を崩した経験あり / 高価な商品で失敗したくない / 続けられるか不安 / 効果を実感できるか半信半疑"
          rows={3}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
        <span className="text-xs text-slate-500">課題セクション・FAQ の精度が劇的に上がります</span>
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
