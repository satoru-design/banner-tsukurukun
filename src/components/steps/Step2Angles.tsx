// src/components/steps/Step2Angles.tsx
'use client';

import React from 'react';
import { Type } from "lucide-react";

type Variation = {
  strategy?: { angle?: string; angle_id?: string; angle_label?: string; target_insight?: string };
  copy?: { main_copy?: string; sub_copy?: string; cta_text?: string; emphasis_ratio?: '2x' | '3x' };
  priceBadge?: unknown;
  ctaTemplate?: { id: string; text: string; arrow: boolean };
  urgency?: 'low' | 'high';
  design_specs?: Record<string, unknown>;
};

type Props = {
  variations: Variation[];
  onSelectAngle: (index: number) => void;
  onBack: () => void;
};

export function Step2Angles(props: Props) {
  const { variations, onSelectAngle, onBack } = props;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
         <Type className="text-teal-400" /> 広告コピーの選択
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {variations.map((v, idx) => (
          <button
            key={v.strategy?.angle_id ?? idx}
            type="button"
            onClick={() => onSelectAngle(idx)}
            className="p-4 rounded-xl border border-slate-700 hover:border-sky-400 bg-slate-900/40 text-left transition-all"
            data-testid={`angle-card-${v.strategy?.angle_id ?? idx}`}
          >
            <div className="text-xs text-sky-400 mb-1">
              {v.strategy?.angle_label ?? v.strategy?.angle_id ?? `Angle ${idx + 1}`}
            </div>
            <div className="font-bold text-sm mb-1 leading-tight">
              {v.copy?.main_copy?.replace(/<\/?mark>/g, '') ?? ''}
            </div>
            <div className="text-xs text-slate-400 leading-tight">
              {v.copy?.sub_copy ?? ''}
            </div>
          </button>
        ))}
      </div>
      <button onClick={onBack} className="mt-4 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 rounded text-white font-bold">Step 1に戻る</button>
    </div>
  );
}
