/**
 * LP Maker Pro 2.0 — Brief ウィザード STEP2（Client Component）。
 *
 * 素材選択 UI。Phase 1 では autobanner.jp /ironclad の Asset 選択画面を
 * 統合せず、最小実装（スキップ可能）にとどめる。
 */
'use client';
import type { LpBrief } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  onChange: (b: Partial<LpBrief>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function BriefWizardStep2({ onBack, onNext }: Props) {
  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 2: 素材（任意）</h2>
      <p className="text-sm text-slate-400">
        商品画像 / ロゴ / 認証バッジは autobanner.jp の素材ライブラリと共有します。
        Phase 1 では素材アップロードはスキップ可能です（KV 画像は AI 自動生成）。
      </p>
      <p className="text-sm text-emerald-400">
        ※ Phase 1 では素材選択 UI は最小実装。autobanner.jp /ironclad の Asset 選択画面を
        Phase 2 で統合予定。
      </p>
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded"
        >
          ← 戻る
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded"
        >
          次へ →
        </button>
      </div>
    </section>
  );
}
