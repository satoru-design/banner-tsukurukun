'use client';

import React, { useState } from 'react';
import { IroncladBriefForm } from '@/components/ironclad/IroncladBriefForm';
import {
  IroncladSuggestSelector,
  IroncladSelections,
} from '@/components/ironclad/IroncladSuggestSelector';
import { Asset } from '@/components/ironclad/AssetLibrary';
import type { IroncladBrief, IroncladMaterials } from '@/lib/prompts/ironclad-banner';

type IroncladStep = 1 | 2 | 3;

const INITIAL_BRIEF: IroncladBrief = {
  pattern: '王道',
  product: '',
  target: '',
  purpose: '',
  size: 'Instagram (1080x1080)',
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
  const [selections, setSelections] = useState<IroncladSelections>(INITIAL_SELECTIONS);
  const [materials, setMaterials] = useState<IroncladMaterials | null>(null);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-teal-400">Ironclad</span> Banner Studio
          </h1>
          <div className="flex items-center gap-2 text-xs">
            <StepIndicator current={step} step={1} label="ブリーフ" />
            <span className="text-slate-600">→</span>
            <StepIndicator current={step} step={2} label="サジェスト選択" />
            <span className="text-slate-600">→</span>
            <StepIndicator current={step} step={3} label="生成" />
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
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <IroncladSuggestSelector
            brief={brief}
            selections={selections}
            onChangeSelections={setSelections}
            onBack={() => setStep(1)}
            onNext={(partial) => {
              setMaterials({
                ...partial,
                productImageUrl: productAsset?.blobUrl,
                badgeImageUrl1: badge1Asset?.blobUrl,
                badgeImageUrl2: badge2Asset?.blobUrl,
              });
              setStep(3);
            }}
          />
        )}

        {step === 3 && materials && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">STEP 3. 生成</h2>
              <p className="text-sm text-slate-400 mt-1">
                （Stage D で実装予定）鉄板プロンプトを組み立てて gpt-image-2 で生成します。
              </p>
            </div>
            <pre className="text-xs bg-slate-900 border border-slate-700 rounded p-4 whitespace-pre-wrap">
{JSON.stringify(materials, null, 2)}
            </pre>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2 rounded bg-slate-700 hover:bg-slate-600"
            >
              ← 戻る
            </button>
          </div>
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
