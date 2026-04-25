'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import type { IroncladBrief, IroncladBaseMaterials } from '@/lib/prompts/ironclad-banner';

export interface IroncladSuggestions {
  copies: [string[], string[], string[], string[]];
  designRequirements: [string[], string[], string[], string[]];
  ctas: string[];
  tones: string[];
  cautions: string[];
}

export interface IroncladSelections {
  copies: [string, string, string, string];
  designRequirements: [string, string, string, string];
  cta: string;
  tone: string;
  caution: string;
}

type Props = {
  brief: IroncladBrief;
  /** Phase A.8: 勝ちバナー参照を有効化するか */
  useWinningRef: boolean;
  selections: IroncladSelections;
  onChangeSelections: (s: IroncladSelections) => void;
  suggestions: IroncladSuggestions | null;
  onChangeSuggestions: (s: IroncladSuggestions | null) => void;
  onBack: () => void;
  onNext: (materials: Omit<IroncladBaseMaterials, 'productImageUrl' | 'badgeImageUrl1' | 'badgeImageUrl2'>) => void;
};

export function IroncladSuggestSelector({
  brief,
  useWinningRef,
  selections,
  onChangeSelections,
  suggestions,
  onChangeSuggestions,
  onBack,
  onNext,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase A.9: スロットの ON/OFF（OFF時は空文字で送信され、生成バナーに含まれない）
  // メインコピー(copies[0]) と designRequirements / tone / caution はトグル対象外（必須）
  const [enabledSlots, setEnabledSlots] = useState({
    sub: true,        // copies[1]
    target: true,     // copies[2]
    authority: true,  // copies[3]
    cta: true,
  });

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ironclad-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...brief, useWinningRef }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      onChangeSuggestions(json.suggestions as IroncladSuggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 親が保持している suggestions が空の場合のみ初回生成する。
    // STEP 3 → STEP 2 に戻った場合は親が前回のサジェストを保持しているので再生成しない。
    if (suggestions) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase A.9: ON スロットのみ必須化
  // メインコピー(copies[0]) と designRequirements[0] と tone は常に必須
  // CTA は enabledSlots.cta=true のときのみ必須
  // copies[1〜3] は対応するトグルがONのときのみ必須
  const canProceed = Boolean(
    selections.copies[0] &&
      selections.designRequirements[0] &&
      selections.tone &&
      (!enabledSlots.cta || selections.cta) &&
      (!enabledSlots.sub || selections.copies[1]) &&
      (!enabledSlots.target || selections.copies[2]) &&
      (!enabledSlots.authority || selections.copies[3]),
  );

  // Phase A.9: トグルOFF切替時にそのスロットの選択値を空文字にリセット
  // OFF→ONでは復元しない（ユーザーが選び直す）
  const setSlotEnabled = (slot: keyof typeof enabledSlots, enabled: boolean) => {
    setEnabledSlots((prev) => ({ ...prev, [slot]: enabled }));
    if (!enabled) {
      if (slot === 'sub') {
        const next = [...selections.copies] as typeof selections.copies;
        next[1] = '';
        onChangeSelections({ ...selections, copies: next });
      } else if (slot === 'target') {
        const next = [...selections.copies] as typeof selections.copies;
        next[2] = '';
        onChangeSelections({ ...selections, copies: next });
      } else if (slot === 'authority') {
        const next = [...selections.copies] as typeof selections.copies;
        next[3] = '';
        onChangeSelections({ ...selections, copies: next });
      } else if (slot === 'cta') {
        onChangeSelections({ ...selections, cta: '' });
      }
    }
  };

  const handleProceed = () => {
    onNext({
      pattern: brief.pattern,
      product: brief.product,
      target: brief.target,
      purpose: brief.purpose,
      copies: selections.copies,
      designRequirements: selections.designRequirements,
      cta: selections.cta,
      tone: selections.tone,
      caution: selections.caution,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">STEP 2. AIサジェスト選択</h2>
          <p className="text-sm text-slate-400 mt-1">
            AIが候補を生成します。各項目で 1 つ選ぶか、自由入力欄で上書きしてください。
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-2 rounded text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '生成中…' : '再生成'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded border border-red-700/50 bg-red-950/50 p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>サジェスト生成エラー: {error}</span>
        </div>
      )}

      {loading && !suggestions && (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          候補を生成中です…（10〜30秒）
        </div>
      )}

      {suggestions && (
        <div className="space-y-6">
          {[0, 1, 2, 3].map((i) => {
            const slotKey: 'sub' | 'target' | 'authority' | null =
              i === 1 ? 'sub' : i === 2 ? 'target' : i === 3 ? 'authority' : null;
            const toggleable = slotKey !== null;
            const enabled = slotKey ? enabledSlots[slotKey] : true;
            return (
              <SuggestField
                key={`copy-${i}`}
                label={`コピー${i + 1}${i === 0 ? '（メイン）' : i === 1 ? '（サブ）' : i === 2 ? '（ターゲット/価格訴求）' : '（権威/ダメ押し）'}`}
                candidates={suggestions.copies[i]}
                value={selections.copies[i]}
                onChange={(v) => {
                  const next = [...selections.copies] as typeof selections.copies;
                  next[i] = v;
                  onChangeSelections({ ...selections, copies: next });
                }}
                toggleable={toggleable}
                enabled={enabled}
                onToggleEnabled={slotKey ? (e) => setSlotEnabled(slotKey, e) : undefined}
              />
            );
          })}

          {[0, 1, 2, 3].map((i) => (
            <SuggestField
              key={`design-${i}`}
              label={`デザイン要件${i + 1}`}
              candidates={suggestions.designRequirements[i]}
              value={selections.designRequirements[i]}
              onChange={(v) => {
                const next = [...selections.designRequirements] as typeof selections.designRequirements;
                next[i] = v;
                onChangeSelections({ ...selections, designRequirements: next });
              }}
            />
          ))}

          <SuggestField
            label="CTA"
            candidates={suggestions.ctas}
            value={selections.cta}
            onChange={(v) => onChangeSelections({ ...selections, cta: v })}
            toggleable={true}
            enabled={enabledSlots.cta}
            onToggleEnabled={(e) => setSlotEnabled('cta', e)}
          />

          <SuggestField
            label="トーン"
            candidates={suggestions.tones}
            value={selections.tone}
            onChange={(v) => onChangeSelections({ ...selections, tone: v })}
          />

          <SuggestField
            label="注意事項"
            candidates={suggestions.cautions}
            value={selections.caution}
            onChange={(v) => onChangeSelections({ ...selections, caution: v })}
          />
        </div>
      )}

      <div className="flex justify-between pt-6 border-t border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
        >
          ← ブリーフに戻る
        </button>
        <button
          type="button"
          onClick={handleProceed}
          disabled={!canProceed}
          className="px-8 py-3 rounded-xl text-white font-bold bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次へ（生成画面）→
        </button>
      </div>
    </div>
  );
}

function SuggestField({
  label,
  candidates,
  value,
  onChange,
  toggleable = false,
  enabled = true,
  onToggleEnabled,
}: {
  label: string;
  candidates: string[];
  value: string;
  onChange: (v: string) => void;
  /** Phase A.9: トグル表示するか（true: スロット ON/OFF 切替UI表示） */
  toggleable?: boolean;
  /** Phase A.9: スロットが有効か。toggleable=true のときのみ意味を持つ */
  enabled?: boolean;
  /** Phase A.9: トグル変更ハンドラ */
  onToggleEnabled?: (next: boolean) => void;
}) {
  const isDisabled = toggleable && !enabled;

  return (
    <div
      className={`border border-slate-700 rounded-lg p-4 bg-slate-900/50 space-y-3 transition ${
        isDisabled ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-slate-200">{label}</label>
        {toggleable && (
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggleEnabled?.(e.target.checked)}
              className="w-3.5 h-3.5 accent-teal-500"
            />
            このスロットを使う
          </label>
        )}
      </div>

      {isDisabled ? (
        <div className="text-xs text-slate-500 italic py-3 text-center">
          このスロットは生成バナーに含めません
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {candidates.map((c, idx) => {
              const active = value === c;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChange(c)}
                  className={`text-left p-3 rounded border text-sm transition ${
                    active
                      ? 'border-teal-400 bg-teal-950/40 text-white ring-1 ring-teal-400/40'
                      : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 mr-2">[{String.fromCharCode(65 + idx)}]</span>
                  {c}
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">自由入力で上書き（候補を選ばず手入力する場合）</label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="候補にない場合はここに入力"
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
            />
          </div>
        </>
      )}
    </div>
  );
}
