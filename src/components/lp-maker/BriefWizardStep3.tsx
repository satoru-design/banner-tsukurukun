/**
 * LP Maker Pro 2.0 — Brief ウィザード STEP3（Client Component）。
 *
 * 価格 / オファー特典 / リスクリバーサル / 競合 LP URL を入力する。
 * 必須項目: price, offer, riskReversal。
 */
'use client';
import type { LpBrief } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  onChange: (b: Partial<LpBrief>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function BriefWizardStep3({ brief, onChange, onBack, onNext }: Props) {
  const canNext = !!(brief.price && brief.offer && brief.riskReversal);

  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 3: オファーと保証</h2>

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
          placeholder="例: 初回 70% OFF、送料無料、特典 e-book プレゼント"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          リスクリバーサル（保証・解約条件） <span className="text-red-400">*</span>
        </span>
        <textarea
          value={brief.riskReversal ?? ''}
          onChange={(e) => onChange({ ...brief, riskReversal: e.target.value })}
          placeholder="例: 14日間返金保証、解約金なし、いつでも休止可能、定期縛りなし"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
        <span className="text-xs text-slate-500">購入障壁を下げる保証文言。AI が勝手に書くと景表法リスクなので必須入力</span>
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          競合・参考 LP URL（任意・改行区切り）
        </span>
        <textarea
          value={brief.referenceLpUrls ?? ''}
          onChange={(e) => onChange({ ...brief, referenceLpUrls: e.target.value })}
          placeholder="https://competitor-a.com/product&#10;https://competitor-b.com/lp"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
        <span className="text-xs text-slate-500">比較表セクションの精度向上に使用</span>
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
