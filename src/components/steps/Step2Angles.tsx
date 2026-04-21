// src/components/steps/Step2Angles.tsx
'use client';

import React from 'react';
import { Type } from "lucide-react";

type Variation = {
  strategy?: { angle?: string; target_insight?: string };
  copy?: { main_copy?: string; sub_copy?: string; cta_text?: string };
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
      <div className="grid md:grid-cols-2 gap-6 mt-4">
        {variations.map((v, i) => (
          <div key={i} className="p-6 rounded-xl border-2 border-neutral-700 bg-neutral-800 hover:border-teal-500 transition-all group relative">
            <h3 className="font-black text-xl text-emerald-400 mb-4">{v.strategy?.angle}</h3>
            <div className="space-y-4 mb-4">
              <div>
                 <label className="text-xs text-neutral-500 font-bold block mb-1">メインコピー</label>
                 <p className="font-bold text-white text-lg">{v.copy?.main_copy}</p>
              </div>
              <div>
                 <label className="text-xs text-neutral-500 font-bold block mb-1">サブコピー</label>
                 <p className="text-sm text-neutral-300">{v.copy?.sub_copy}</p>
              </div>
            </div>
            <button onClick={() => onSelectAngle(i)} className="w-full bg-neutral-700 group-hover:bg-teal-600 text-white font-bold p-3 rounded-lg flex items-center justify-center gap-2">
               このアングルを使って次へ進む
            </button>
          </div>
        ))}
      </div>
      <button onClick={onBack} className="mt-4 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 rounded text-white font-bold">Step 1に戻る</button>
    </div>
  );
}
