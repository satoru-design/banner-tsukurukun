'use client';

import React, { useState } from 'react';
import { Link2, Loader2, Wand2, AlertTriangle } from 'lucide-react';
import {
  IRONCLAD_PATTERNS,
  IroncladBrief,
  IroncladPattern,
  IroncladSize,
  IRONCLAD_SIZE_CATEGORIES,
  SIZE_TO_API_IRONCLAD,
} from '@/lib/prompts/ironclad-banner';
import { AssetLibrary, Asset } from './AssetLibrary';
import { WinningBannerLibrary } from './WinningBannerLibrary';

type Props = {
  brief: IroncladBrief;
  onChangeBrief: (b: IroncladBrief) => void;
  productAsset: Asset | null;
  onChangeProductAsset: (a: Asset | null) => void;
  badge1Asset: Asset | null;
  onChangeBadge1Asset: (a: Asset | null) => void;
  badge2Asset: Asset | null;
  onChangeBadge2Asset: (a: Asset | null) => void;
  /** Phase A.8: 勝ちバナー参照を有効化するか */
  useWinningRef: boolean;
  onChangeUseWinningRef: (v: boolean) => void;
  onNext: () => void;
};


export function IroncladBriefForm({
  brief,
  onChangeBrief,
  productAsset,
  onChangeProductAsset,
  badge1Asset,
  onChangeBadge1Asset,
  badge2Asset,
  onChangeBadge2Asset,
  useWinningRef,
  onChangeUseWinningRef,
  onNext,
}: Props) {
  const canProceed = Boolean(
    brief.pattern &&
      brief.product.trim() &&
      brief.target.trim() &&
      brief.purpose.trim() &&
      brief.sizes.length > 0,
  );

  const toggleSize = (s: IroncladSize) => {
    const has = brief.sizes.includes(s);
    const nextSizes = has ? brief.sizes.filter((x) => x !== s) : [...brief.sizes, s];
    onChangeBrief({ ...brief, sizes: nextSizes });
  };

  const [lpUrl, setLpUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleAnalyzeLp = async () => {
    const url = lpUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url)) {
      setAnalyzeError('http:// または https:// で始まる URL を入力してください');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/analyze-lp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const insights = json.insights ?? {};
      const product = insights.inferred_product_name ?? '';
      const target = insights.inferred_target_demographic ?? '';
      const purposeParts = [
        insights.main_appeal,
        insights.worldview ? `（世界観: ${insights.worldview}）` : '',
        insights.insight ? `インサイト: ${insights.insight}` : '',
      ].filter(Boolean);
      onChangeBrief({
        ...brief,
        product: product || brief.product,
        target: target || brief.target,
        purpose: purposeParts.join(' / ') || brief.purpose,
      });
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white">STEP 1. ブリーフ入力</h2>
        <p className="text-sm text-slate-400 mt-1">
          パターンと商材情報を入力してください。次の画面で AI が コピー・デザイン要件の候補を自動生成します。
        </p>
      </div>

      <div className="border border-sky-700/50 rounded-lg p-4 bg-sky-950/20 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-sky-300">LP URL から自動抽出（任意）</h3>
        </div>
        <p className="text-xs text-slate-400">
          商材 LP の URL を貼ると AI が読み込んで「商材 / ターゲット / 目的」を自動入力します（既存の入力は上書き）。
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://example.com/products/xxx"
            value={lpUrl}
            onChange={(e) => setLpUrl(e.target.value)}
            disabled={analyzing}
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAnalyzeLp}
            disabled={analyzing || !lpUrl.trim()}
            className="flex items-center gap-1 px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                解析中…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                解析して自動入力
              </>
            )}
          </button>
        </div>
        {analyzeError && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded px-2 py-1">
            <AlertTriangle className="w-3 h-3 mt-0.5" />
            {analyzeError}
          </div>
        )}
      </div>

      {/* Phase A.8: 勝ちバナー参照セクション */}
      <WinningBannerLibrary
        useWinningRef={useWinningRef}
        onChangeUseWinningRef={onChangeUseWinningRef}
      />

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
        <label className="block text-sm font-bold text-slate-200 mb-2">
          商材 *<span className="text-[11px] font-normal text-slate-400 ml-2">
            テキスト入力 or LP URL 貼り付け（どちらでも可）
          </span>
        </label>
        <input
          type="text"
          placeholder="例: 5 POINT DETOX / または LP URL"
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

      <div className="space-y-3">
        <label className="block text-sm font-bold text-slate-200">
          サイズ *（複数選択可・カテゴリ別。統一感のある複数バリエーションを一括生成）
        </label>

        {IRONCLAD_SIZE_CATEGORIES.map((cat) => {
          const anyCropInCat = cat.sizes.some((s) => SIZE_TO_API_IRONCLAD[s].needsCrop);
          return (
            <div
              key={cat.key}
              className="border border-slate-700 rounded-lg p-3 bg-slate-900/40 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-300">
                  {cat.emoji} {cat.label}
                </div>
                {anyCropInCat && (
                  <span className="text-[10px] text-amber-400 bg-amber-950/40 rounded px-2 py-0.5 border border-amber-800">
                    ⚠ 3:1超を含む（自動クロップ推奨）
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {cat.sizes.map((s) => {
                  const meta = SIZE_TO_API_IRONCLAD[s];
                  const active = brief.sizes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSize(s)}
                      className={`px-2 py-2 rounded text-[11px] transition border text-left ${
                        active
                          ? 'bg-teal-500 text-white shadow border-teal-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                      }`}
                      title={meta.layoutHint}
                    >
                      <span className="mr-1">{active ? '✓' : '☐'}</span>
                      {s}
                      {meta.needsCrop && (
                        <span className="ml-1 text-amber-300" title="3:1を超えるため自動クロップが必要">
                          ✂
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {brief.sizes.length === 0 && (
          <p className="text-xs text-amber-400">少なくとも1つ選択してください</p>
        )}
        {brief.sizes.some((s) => SIZE_TO_API_IRONCLAD[s].needsCrop) && (
          <p className="text-xs text-amber-300 bg-amber-950/30 rounded px-2 py-1 border border-amber-900">
            ✂ マーク付きサイズはアスペクト比制限により 3:1 で生成されます。
            最終サイズに合わせた手動クロップが必要です。
          </p>
        )}
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
