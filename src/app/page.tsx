'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
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
  additionalPatterns: [],
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
  // Phase A.11.2: 訪問済みの最大ステップを記録。ステップ表示クリック時のジャンプ可否判定に使う。
  const [maxVisitedStep, setMaxVisitedStep] = useState<IroncladStep>(1);
  const [brief, setBrief] = useState<IroncladBrief>(INITIAL_BRIEF);
  const [productAsset, setProductAsset] = useState<Asset | null>(null);
  const [badge1Asset, setBadge1Asset] = useState<Asset | null>(null);
  const [badge2Asset, setBadge2Asset] = useState<Asset | null>(null);
  const [useWinningRef, setUseWinningRef] = useState<boolean>(true); // Phase A.8: デフォルトON
  const [selections, setSelections] = useState<IroncladSelections>(INITIAL_SELECTIONS);
  const [suggestions, setSuggestions] = useState<IroncladSuggestions | null>(null);
  const [suggestionsSignature, setSuggestionsSignature] = useState<string>('');
  const [baseMaterials, setBaseMaterials] = useState<IroncladBaseMaterials | null>(null);

  // ブリーフの中核項目（商材・ターゲット・目的）が変わったら、
  // 前回のサジェストは文脈外になるため破棄して再生成させる。
  // 逆に STEP 3 ↔ STEP 2 の往復ではブリーフが変わらないので保持される。
  // Phase A.16: pattern は visual-only に再定義したため signature から除外。
  // 代表 pattern を変更しても STEP2 の suggestions は破棄されない。
  const currentSignature = `${brief.product}|${brief.target}|${brief.purpose}`;
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

  // Phase A.11.2: step が更新されたら maxVisitedStep も追従させる
  useEffect(() => {
    setMaxVisitedStep((prev) => (step > prev ? step : prev));
  }, [step]);

  // Phase A.11.2: ヘッダーのステップ表示クリックで訪問済みステップにジャンプ
  const handleJumpToStep = (target: IroncladStep) => {
    if (target <= maxVisitedStep) setStep(target);
  };

  // Phase A.11.5: ?regenerate=<id> または ?prefill=<id> で履歴から復元
  const searchParams = useSearchParams();
  useEffect(() => {
    const regenerateId = searchParams.get('regenerate');
    const prefillId = searchParams.get('prefill');
    const targetId = regenerateId || prefillId;
    if (!targetId) return;

    (async () => {
      try {
        const res = await fetch(`/api/history/${targetId}/regenerate`, {
          method: 'POST',
        });
        if (!res.ok) {
          console.warn('failed to load regenerate target');
          return;
        }
        const { briefSnapshot } = await res.json();
        // brief を復元
        setBrief({
          pattern: briefSnapshot.pattern,
          additionalPatterns: [], // 履歴復元では常に代表 pattern 1 個のみ（追加は再選択させる）
          product: briefSnapshot.product,
          target: briefSnapshot.target,
          purpose: briefSnapshot.purpose,
          sizes: briefSnapshot.sizes ?? ['Instagram (1080x1080)'],
        });
        // selections を復元
        setSelections({
          copies: briefSnapshot.copies,
          designRequirements: briefSnapshot.designRequirements,
          cta: briefSnapshot.cta,
          tone: briefSnapshot.tone,
          caution: briefSnapshot.caution,
        });
        setSuggestionsSignature(
          `${briefSnapshot.product}|${briefSnapshot.target}|${briefSnapshot.purpose}`,
        );
        // useWinningRef も復元（snapshot に含まれている）
        if (typeof briefSnapshot.useWinningRef === 'boolean') {
          setUseWinningRef(briefSnapshot.useWinningRef);
        }
        // baseMaterials を復元（regenerate のみ Step 3 直行）
        if (regenerateId) {
          setBaseMaterials({
            pattern: briefSnapshot.pattern,
            product: briefSnapshot.product,
            target: briefSnapshot.target,
            purpose: briefSnapshot.purpose,
            copies: briefSnapshot.copies,
            designRequirements: briefSnapshot.designRequirements,
            cta: briefSnapshot.cta,
            tone: briefSnapshot.tone,
            caution: briefSnapshot.caution,
            productImageUrl: briefSnapshot.productImageUrl ?? undefined,
            badgeImageUrl1: briefSnapshot.badgeImageUrl1 ?? undefined,
            badgeImageUrl2: briefSnapshot.badgeImageUrl2 ?? undefined,
          });
          setStep(3);
          setMaxVisitedStep(3);
        } else {
          setStep(1);
        }
      } catch (err) {
        console.error('regenerate/prefill failed:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {/* Phase A.11.1: 共有 Header に置換。Step インジケータは中央スロットへ */}
      <Header
        rightSlot={
          <StepIndicatorRow
            current={step}
            maxVisited={maxVisitedStep}
            onJumpTo={handleJumpToStep}
          />
        }
      />

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
            patterns={[brief.pattern, ...(brief.additionalPatterns ?? [])]}
            sizes={brief.sizes}
            videoAspectRatios={brief.videoAspectRatios}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  );
}

/**
 * Phase A.11.1: 既存の StepIndicator を 3 連で並べる Row。Header の rightSlot に渡す。
 * モバイル幅では数字のみ（label を sm:inline で隠す）。
 */
function StepIndicatorRow({
  current,
  maxVisited,
  onJumpTo,
}: {
  current: IroncladStep;
  maxVisited: IroncladStep;
  onJumpTo: (target: IroncladStep) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <StepIndicator
        current={current}
        step={1}
        label="お題"
        enabled={1 <= maxVisited}
        onClick={() => onJumpTo(1)}
      />
      <span className="text-slate-600">→</span>
      <StepIndicator
        current={current}
        step={2}
        label="素材"
        enabled={2 <= maxVisited}
        onClick={() => onJumpTo(2)}
      />
      <span className="text-slate-600">→</span>
      <StepIndicator
        current={current}
        step={3}
        label="完成"
        enabled={3 <= maxVisited}
        onClick={() => onJumpTo(3)}
      />
    </div>
  );
}

function StepIndicator({
  current,
  step,
  label,
  enabled,
  onClick,
}: {
  current: IroncladStep;
  step: IroncladStep;
  label: string;
  enabled: boolean;
  onClick: () => void;
}) {
  const active = current === step;
  const done = current > step;
  // 現在ステップは disable（自分自身へのジャンプは無意味）。未到達ステップも disable。
  const isDisabled = active || !enabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={
        active
          ? `現在のステップ ${step}: ${label}`
          : enabled
            ? `ステップ ${step} へ戻る: ${label}`
            : `ステップ ${step} は未到達: ${label}`
      }
      className={`px-3 py-1 rounded-full border transition focus:outline-none focus:ring-2 focus:ring-teal-500 ${
        active
          ? 'bg-teal-500 text-white border-teal-500 cursor-default'
          : done
            ? 'bg-teal-900/40 text-teal-300 border-teal-700 hover:bg-teal-800/60 hover:text-teal-200 cursor-pointer'
            : enabled
              ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 cursor-pointer'
              : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
      }`}
    >
      <span>{step}.</span>
      <span className="hidden sm:inline ml-1">{label}</span>
    </button>
  );
}
