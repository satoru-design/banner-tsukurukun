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
  selections: IroncladSelections;
  onChangeSelections: (s: IroncladSelections) => void;
  onBack: () => void;
  onNext: (materials: Omit<IroncladBaseMaterials, 'productImageUrl' | 'badgeImageUrl1' | 'badgeImageUrl2'>) => void;
};

export function IroncladSuggestSelector({
  brief,
  selections,
  onChangeSelections,
  onBack,
  onNext,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<IroncladSuggestions | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ironclad-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSuggestions(json.suggestions as IroncladSuggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canProceed = Boolean(
    selections.copies[0] &&
      selections.designRequirements[0] &&
      selections.cta &&
      selections.tone,
  );

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
            Gemini 2.5 Pro が候補を生成します。各項目で 1 つ選ぶか、自由入力欄で上書きしてください。
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
          Gemini が候補を生成中です…（10〜30秒）
        </div>
      )}

      {suggestions && (
        <div className="space-y-6">
          {[0, 1, 2, 3].map((i) => (
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
            />
          ))}

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
}: {
  label: string;
  candidates: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/50 space-y-3">
      <label className="block text-sm font-bold text-slate-200">{label}</label>

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
    </div>
  );
}
