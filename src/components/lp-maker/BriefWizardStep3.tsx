/**
 * LP Maker Pro 2.0 — Brief ウィザード STEP3（Client Component）。
 *
 * 入力内容の確認 → AI 生成開始。submit 中は両ボタンを無効化し、
 * エラーは赤いバナーで表示する。
 */
'use client';
import type { LpBrief } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}

export function BriefWizardStep3({
  brief,
  submitting,
  error,
  onBack,
  onSubmit,
}: Props) {
  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 3: 確認 → AI 生成開始</h2>

      <div className="bg-slate-800 rounded p-4 space-y-2 text-sm">
        <p>
          <span className="text-slate-500">商品名:</span> {brief.productName}
        </p>
        {brief.lpUrl && (
          <p>
            <span className="text-slate-500">既存 LP:</span> {brief.lpUrl}
          </p>
        )}
        <p>
          <span className="text-slate-500">ターゲット:</span> {brief.target}
        </p>
        <p>
          <span className="text-slate-500">オファー:</span> {brief.offer}
        </p>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-4 text-sm">
        <p className="font-bold text-emerald-300 mb-1">AI 自動セクション選定</p>
        <p className="text-slate-300">
          ブリーフから業種・オファー特性を判断し、7〜9 セクションの最適な組合せを自動決定します。
          編集画面でいつでも変更可能です。
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 rounded p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          disabled={submitting}
          className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded disabled:opacity-50"
        >
          ← 戻る
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded disabled:opacity-50"
        >
          {submitting ? '生成中…（最大3分）' : '✨ AI で LP を生成する'}
        </button>
      </div>
    </section>
  );
}
