/**
 * LP Maker Pro 2.0 — Brief ウィザード STEP1（Client Component）。
 *
 * 商品名 / 業種カテゴリ / USP（強み）を入力する。
 * 必須項目: productName, industryCategory, usp。
 */
'use client';
import type { LpBrief } from '@/lib/lp/types';
import { LP_INDUSTRY_CATEGORIES, LP_INDUSTRY_LABELS } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  onChange: (b: Partial<LpBrief>) => void;
  onNext: () => void;
}

export function BriefWizardStep1({ brief, onChange, onNext }: Props) {
  const canNext = !!(brief.productName && brief.industryCategory && brief.usp);

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
          業種カテゴリ <span className="text-red-400">*</span>
        </span>
        <select
          value={brief.industryCategory ?? ''}
          onChange={(e) =>
            onChange({
              ...brief,
              industryCategory:
                e.target.value === ''
                  ? undefined
                  : (e.target.value as typeof LP_INDUSTRY_CATEGORIES[number]),
            })
          }
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        >
          <option value="">選択してください</option>
          {LP_INDUSTRY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {LP_INDUSTRY_LABELS[c]}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">薬機/景表ガード + セクション選定で利用されます</span>
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          強み・USP <span className="text-red-400">*</span>
        </span>
        <textarea
          value={brief.usp ?? ''}
          onChange={(e) => onChange({ ...brief, usp: e.target.value })}
          placeholder="例: 業界初の独自処方で従来の3倍速で実感、累計5万本販売、医師監修"
          rows={3}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
        <span className="text-xs text-slate-500">他社との差別化ポイント</span>
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
