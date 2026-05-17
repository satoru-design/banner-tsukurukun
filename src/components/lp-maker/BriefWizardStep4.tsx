/**
 * LP Maker Pro 2.0 — Brief ウィザード STEP4（Client Component）。
 *
 * CTA タイプ / 実績数値 / 権威付け / ブランドトーン + 入力サマリ + 生成ボタン。
 * 必須項目: ctaType。
 */
'use client';
import type { LpBrief } from '@/lib/lp/types';
import {
  LP_CTA_TYPES,
  LP_CTA_LABELS,
  LP_TONES,
  LP_TONE_LABELS,
  LP_INDUSTRY_LABELS,
} from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  onChange: (b: Partial<LpBrief>) => void;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}

export function BriefWizardStep4({
  brief,
  onChange,
  submitting,
  error,
  onBack,
  onSubmit,
}: Props) {
  const canSubmit = !!brief.ctaType;

  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 4: 信頼とクロージング</h2>

      <label className="block">
        <span className="text-sm text-slate-300">
          CTA タイプ <span className="text-red-400">*</span>
        </span>
        <select
          value={brief.ctaType ?? ''}
          onChange={(e) =>
            onChange({
              ...brief,
              ctaType:
                e.target.value === ''
                  ? undefined
                  : (e.target.value as typeof LP_CTA_TYPES[number]),
            })
          }
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        >
          <option value="">選択してください</option>
          {LP_CTA_TYPES.map((c) => (
            <option key={c} value={c}>
              {LP_CTA_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          実績数値・社会的証明（任意）
        </span>
        <textarea
          value={brief.proofMetrics ?? ''}
          onChange={(e) => onChange({ ...brief, proofMetrics: e.target.value })}
          placeholder="例: 累計 5 万本販売、導入企業 300 社、利用者満足度 92%、リピート率 85%"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
        <span className="text-xs text-slate-500">numeric_proof / voice セクションで使用。AI 捏造防止のため実数値を入力推奨</span>
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          権威付け（任意・受賞・メディア・監修）
        </span>
        <textarea
          value={brief.authority ?? ''}
          onChange={(e) => onChange({ ...brief, authority: e.target.value })}
          placeholder="例: グッドデザイン賞 2024、TBS『林修の今でしょ講座』掲載、監修:○○大学医学部 山田教授"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          ブランドトーン（任意）
        </span>
        <select
          value={brief.tone ?? ''}
          onChange={(e) =>
            onChange({
              ...brief,
              tone:
                e.target.value === ''
                  ? undefined
                  : (e.target.value as typeof LP_TONES[number]),
            })
          }
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        >
          <option value="">未指定（信頼感がデフォルト）</option>
          {LP_TONES.map((t) => (
            <option key={t} value={t}>
              {LP_TONE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <div className="bg-slate-800 rounded p-4 space-y-1 text-xs text-slate-400">
        <p>
          <span className="text-slate-500">商品:</span> {brief.productName}
          {brief.industryCategory && ` (${LP_INDUSTRY_LABELS[brief.industryCategory]})`}
        </p>
        {brief.usp && (
          <p>
            <span className="text-slate-500">USP:</span> {brief.usp.slice(0, 70)}
            {brief.usp.length > 70 ? '…' : ''}
          </p>
        )}
        <p>
          <span className="text-slate-500">ターゲット:</span> {brief.target?.slice(0, 70)}
          {(brief.target?.length ?? 0) > 70 ? '…' : ''}
        </p>
        {brief.customerPain && (
          <p>
            <span className="text-slate-500">悩み:</span> {brief.customerPain.slice(0, 70)}
            {brief.customerPain.length > 70 ? '…' : ''}
          </p>
        )}
        <p>
          <span className="text-slate-500">価格:</span> {brief.price}
        </p>
        <p>
          <span className="text-slate-500">オファー:</span> {brief.offer?.slice(0, 70)}
          {(brief.offer?.length ?? 0) > 70 ? '…' : ''}
        </p>
        {brief.riskReversal && (
          <p>
            <span className="text-slate-500">保証:</span> {brief.riskReversal.slice(0, 70)}
            {brief.riskReversal.length > 70 ? '…' : ''}
          </p>
        )}
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
          disabled={submitting || !canSubmit}
          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded disabled:opacity-50"
        >
          {submitting ? '生成中…（最大3分）' : '✨ AI で LP を生成する'}
        </button>
      </div>
    </section>
  );
}
