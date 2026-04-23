'use client';

import React from 'react';
import { IRONCLAD_PATTERNS, IroncladBrief, IroncladPattern } from '@/lib/prompts/ironclad-banner';
import { AssetLibrary, Asset } from './AssetLibrary';

type Props = {
  brief: IroncladBrief;
  onChangeBrief: (b: IroncladBrief) => void;
  productAsset: Asset | null;
  onChangeProductAsset: (a: Asset | null) => void;
  badge1Asset: Asset | null;
  onChangeBadge1Asset: (a: Asset | null) => void;
  badge2Asset: Asset | null;
  onChangeBadge2Asset: (a: Asset | null) => void;
  onNext: () => void;
};

const SIZE_OPTIONS: IroncladBrief['size'][] = [
  'Instagram (1080x1080)',
  'FB/GDN (1200x628)',
  'Stories (1080x1920)',
];

export function IroncladBriefForm({
  brief,
  onChangeBrief,
  productAsset,
  onChangeProductAsset,
  badge1Asset,
  onChangeBadge1Asset,
  badge2Asset,
  onChangeBadge2Asset,
  onNext,
}: Props) {
  const canProceed = Boolean(
    brief.pattern && brief.product.trim() && brief.target.trim() && brief.purpose.trim(),
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white">STEP 1. ブリーフ入力</h2>
        <p className="text-sm text-slate-400 mt-1">
          パターンと商材情報を入力してください。次の画面で AI が コピー・デザイン要件の候補を自動生成します。
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">パターン *</label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {IRONCLAD_PATTERNS.map((p) => {
            const active = brief.pattern === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChangeBrief({ ...brief, pattern: p as IroncladPattern })}
                className={`px-2 py-2 rounded text-xs transition ${
                  active
                    ? 'bg-teal-500 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">商材 *</label>
        <input
          type="text"
          placeholder="例: 5 POINT DETOX（デトックスドリンク）"
          value={brief.product}
          onChange={(e) => onChangeBrief({ ...brief, product: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">ターゲット *</label>
        <input
          type="text"
          placeholder="例: 40代女性、体重が落ちにくくなってきた、忙しくて運動する時間がない"
          value={brief.target}
          onChange={(e) => onChangeBrief({ ...brief, target: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">目的・コンセプト *</label>
        <textarea
          placeholder="例: 16日間の短期集中デトックスで体重2kg減を訴求。朝1杯の手軽さと累計実績による信頼感を両立"
          value={brief.purpose}
          onChange={(e) => onChangeBrief({ ...brief, purpose: e.target.value })}
          className="w-full h-20 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">サイズ *</label>
        <div className="grid grid-cols-3 gap-2">
          {SIZE_OPTIONS.map((s) => {
            const active = brief.size === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChangeBrief({ ...brief, size: s })}
                className={`px-3 py-2 rounded text-xs transition ${
                  active ? 'bg-teal-500 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <AssetLibrary
        assetType="product"
        selectedId={productAsset?.id ?? null}
        onSelect={onChangeProductAsset}
        label="🧴 商品画像（任意）"
      />

      <AssetLibrary
        assetType="badge"
        selectedId={badge1Asset?.id ?? null}
        onSelect={onChangeBadge1Asset}
        label="🏅 認証バッジ 1（任意）"
      />

      <AssetLibrary
        assetType="badge"
        selectedId={badge2Asset?.id ?? null}
        onSelect={onChangeBadge2Asset}
        label="🏆 認証バッジ 2（任意）"
      />

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="px-8 py-3 rounded-xl text-white font-bold shadow-lg transition bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次へ（AIサジェスト生成）→
        </button>
      </div>
    </div>
  );
}
