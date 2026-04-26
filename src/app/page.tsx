'use client';

import React, { useEffect, useState } from 'react';
import { IroncladBriefForm } from '@/components/ironclad/IroncladBriefForm';
import {
  IroncladSuggestSelector,
  IroncladSelections,
  IroncladSuggestions,
} from '@/components/ironclad/IroncladSuggestSelector';
import { IroncladGenerateScreen } from '@/components/ironclad/IroncladGenerateScreen';
import { Asset } from '@/components/ironclad/AssetLibrary';
import type { IroncladBrief, IroncladBaseMaterials } from '@/lib/prompts/ironclad-banner';

type IroncladStep = 1 | 2 | 3;

const INITIAL_BRIEF: IroncladBrief = {
  pattern: '王道',
  product: '',
  target: '',
  purpose: '',
  sizes: ['Instagram (1080x1080)'],
};

const INITIAL_SELECTIONS: IroncladSelections = {
  copies: ['', '', '', ''],
  designRequirements: ['', '', '', ''],
  cta: '',
  tone: '',
  caution: '',
};

export default function IroncladPage() {
  const [step, setStep] = useState<IroncladStep>(1);
  const [brief, setBrief] = useState<IroncladBrief>(INITIAL_BRIEF);
  const [productAsset, setProductAsset] = useState<Asset | null>(null);
  const [badge1Asset, setBadge1Asset] = useState<Asset | null>(null);
  const [badge2Asset, setBadge2Asset] = useState<Asset | null>(null);
  const [useWinningRef, setUseWinningRef] = useState<boolean>(true); // Phase A.8: デフォルトON
  const [selections, setSelections] = useState<IroncladSelections>(INITIAL_SELECTIONS);
  const [suggestions, setSuggestions] = useState<IroncladSuggestions | null>(null);
  const [suggestionsSignature, setSuggestionsSignature] = useState<string>('');
  const [baseMaterials, setBaseMaterials] = useState<IroncladBaseMaterials | null>(null);

  // ブリーフの中核項目（パターン・商材・ターゲット・目的）が変わったら、
  // 前回のサジェストは文脈外になるため破棄して再生成させる。
  // 逆に STEP 3 ↔ STEP 2 の往復ではブリーフが変わらないので保持される。
  const currentSignature = `${brief.pattern}|${brief.product}|${brief.target}|${brief.purpose}`;
  useEffect(() => {
    if (suggestions && currentSignature !== suggestionsSignature) {
      setSuggestions(null);
      setSuggestionsSignature('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSignature]);

  const handleSuggestionsChange = (s: IroncladSuggestions | null) => {
    setSuggestions(s);
    setSuggestionsSignature(s ? currentSignature : '');
  };

  // 初回マウント時: 各タイプの最新アセット（= 最後に使ったもの）を自動選択
  useEffect(() => {
    const autoSelectLatest = async () => {
      try {
        const [productRes, badgeRes] = await Promise.all([
          fetch('/api/assets?type=product'),
          fetch('/api/assets?type=badge'),
        ]);
        if (productRes.ok) {
          const { assets } = await productRes.json();
          if (assets && assets.length > 0) setProductAsset(assets[0]);
        }
        if (badgeRes.ok) {
          const { assets } = await badgeRes.json();
          if (assets && assets.length > 0) {
            setBadge1Asset(assets[0]);
            if (assets.length > 1) setBadge2Asset(assets[1]);
          }
        }
      } catch (err) {
        console.warn('Failed to auto-select latest assets:', err);
      }
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void autoSelectLatest();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-teal-400">勝ちバナー</span>作る君
          </h1>
          <div className="flex items-center gap-2 text-xs">
            <StepIndicator current={step} step={1} label="お題" />
            <span className="text-slate-600">→</span>
            <StepIndicator current={step} step={2} label="素材" />
            <span className="text-slate-600">→</span>
            <StepIndicator current={step} step={3} label="完成" />
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        {step === 1 && (
          <IroncladBriefForm
            brief={brief}
            onChangeBrief={setBrief}
            productAsset={productAsset}
            onChangeProductAsset={setProductAsset}
            badge1Asset={badge1Asset}
            onChangeBadge1Asset={setBadge1Asset}
            badge2Asset={badge2Asset}
            onChangeBadge2Asset={setBadge2Asset}
            useWinningRef={useWinningRef}
            onChangeUseWinningRef={setUseWinningRef}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <IroncladSuggestSelector
            brief={brief}
            useWinningRef={useWinningRef}
            selections={selections}
            onChangeSelections={setSelections}
            suggestions={suggestions}
            onChangeSuggestions={handleSuggestionsChange}
            onBack={() => setStep(1)}
            onNext={(partial) => {
              setBaseMaterials({
                ...partial,
                productImageUrl: productAsset?.blobUrl,
                badgeImageUrl1: badge1Asset?.blobUrl,
                badgeImageUrl2: badge2Asset?.blobUrl,
              });
              setStep(3);
            }}
          />
        )}

        {step === 3 && baseMaterials && (
          <IroncladGenerateScreen
            baseMaterials={baseMaterials}
            sizes={brief.sizes}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  );
}

function StepIndicator({ current, step, label }: { current: IroncladStep; step: IroncladStep; label: string }) {
  const active = current === step;
  const done = current > step;
  return (
    <div
      className={`px-3 py-1 rounded-full border transition ${
        active
          ? 'bg-teal-500 text-white border-teal-500'
          : done
            ? 'bg-teal-900/40 text-teal-300 border-teal-700'
            : 'bg-slate-800 text-slate-400 border-slate-700'
      }`}
    >
      {step}. {label}
    </div>
  );
}
