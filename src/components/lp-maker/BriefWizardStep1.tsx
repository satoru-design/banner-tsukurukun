/**
 * LP Maker Pro 2.0 — Brief ウィザード STEP1（Client Component）。
 *
 * 商品名 / 既存 LP URL / ターゲット / オファーを入力する。
 * 必須項目: productName, target, offer。
 */
'use client';
import type { LpBrief } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  onChange: (b: Partial<LpBrief>) => void;
  onNext: () => void;
}

export function BriefWizardStep1({ brief, onChange, onNext }: Props) {
  const canNext = !!(brief.productName && brief.target && brief.offer);

  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 1: 商材を教えてください</h2>

      <label className="block">
        <span className="text-sm text-slate-300">既存 LP URL（任意）</span>
        <input
          type="url"
          value={brief.lpUrl ?? ''}
          onChange={(e) => onChange({ ...brief, lpUrl: e.target.value })}
          placeholder="https://example.com/product"
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
        <span className="text-xs text-slate-500">入力すると商品情報を自動分析します</span>
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          商品名 / サービス名 <span className="text-red-400">*</span>
        </span>
        <input
          type="text"
          value={brief.productName ?? ''}
          onChange={(e) => onChange({ ...brief, productName: e.target.value })}
          placeholder="例: 5 Point Detox"
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

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
          オファー <span className="text-red-400">*</span>
        </span>
        <textarea
          value={brief.offer ?? ''}
          onChange={(e) => onChange({ ...brief, offer: e.target.value })}
          placeholder="例: 初回限定オファー + 14日間返金保証 + 送料無料"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <div className="flex justify-end pt-4">
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
