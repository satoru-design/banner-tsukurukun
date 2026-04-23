'use client';

import React, { useState } from 'react';
import { Download, Sparkles, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import type { IroncladMaterials } from '@/lib/prompts/ironclad-banner';

type Props = {
  materials: IroncladMaterials;
  onBack: () => void;
};

export function IroncladGenerateScreen({ materials, onBack }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setImageUrl(null);
    try {
      const res = await fetch('/api/ironclad-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materials),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setImageUrl(json.imageUrl);
      setPromptPreview(json.promptPreview ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (materials.product || 'banner').replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龥]/g, '_').slice(0, 30);
    link.download = `ironclad_${safeName}_${ts}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">STEP 3. 生成</h2>
          <p className="text-sm text-slate-400 mt-1">
            選択した材料を鉄板プロンプトにまとめて gpt-image-2 に投げます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className="flex items-center gap-1 px-3 py-2 rounded text-xs bg-slate-700 hover:bg-slate-600"
        >
          {showPrompt ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showPrompt ? 'プロンプトを隠す' : 'プロンプトを見る'}
        </button>
      </div>

      <MaterialsSummary materials={materials} />

      {showPrompt && promptPreview && (
        <div className="border border-slate-700 rounded-lg p-4 bg-slate-950/50">
          <h3 className="text-xs font-bold text-teal-300 mb-2">鉄板プロンプト（実際にAPIに渡される内容）</h3>
          <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
{promptPreview}
          </pre>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded border border-red-700/50 bg-red-950/50 p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>生成エラー: {error}</span>
        </div>
      )}

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 hover:opacity-90 disabled:opacity-40 shadow-xl hover:scale-[1.02] transition-transform"
        >
          <Sparkles className={`w-5 h-5 ${generating ? 'animate-pulse' : ''}`} />
          {generating ? 'gpt-image-2 で生成中…（30〜60秒）' : 'バナーを生成する'}
        </button>
      </div>

      {imageUrl && (
        <div className="border border-teal-700/50 rounded-lg p-4 bg-slate-950/50 space-y-3">
          <h3 className="text-sm font-bold text-teal-300">生成結果</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Generated banner"
            className="w-full max-w-2xl mx-auto rounded shadow-2xl"
          />
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
            >
              <Download className="w-4 h-4" />
              ダウンロード
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="flex items-center gap-1 px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
            >
              <Sparkles className="w-4 h-4" />
              もう1枚生成
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-start pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
        >
          ← サジェスト選択に戻る
        </button>
      </div>
    </div>
  );
}

function MaterialsSummary({ materials }: { materials: IroncladMaterials }) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/50 space-y-2 text-xs">
      <h3 className="text-sm font-bold text-teal-300 mb-3">選択した材料</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
        <KV label="パターン" value={materials.pattern} />
        <KV label="サイズ" value={materials.size} />
        <KV label="商材" value={materials.product} />
        <KV label="ターゲット" value={materials.target} />
        <KV label="目的" value={materials.purpose} />
        <KV label="トーン" value={materials.tone} />
      </div>
      <div className="pt-2 border-t border-slate-800">
        <div className="text-slate-500 mb-1">コピー</div>
        <ul className="space-y-0.5 text-slate-300">
          {materials.copies.filter(Boolean).map((c, i) => (
            <li key={i}>・{c}</li>
          ))}
        </ul>
      </div>
      <div className="pt-2 border-t border-slate-800">
        <div className="text-slate-500 mb-1">デザイン要件</div>
        <ul className="space-y-0.5 text-slate-300">
          {materials.designRequirements.filter(Boolean).map((d, i) => (
            <li key={i}>・{d}</li>
          ))}
        </ul>
      </div>
      <div className="pt-2 border-t border-slate-800">
        <KV label="CTA" value={materials.cta} />
        {materials.caution && <KV label="注意" value={materials.caution} />}
      </div>
      {(materials.productImageUrl || materials.badgeImageUrl1 || materials.badgeImageUrl2) && (
        <div className="pt-2 border-t border-slate-800">
          <div className="text-slate-500 mb-1">添付素材</div>
          <div className="flex flex-wrap gap-2">
            {materials.productImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={materials.productImageUrl}
                alt="product"
                className="w-16 h-16 object-cover rounded border border-slate-700"
              />
            )}
            {materials.badgeImageUrl1 && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={materials.badgeImageUrl1}
                alt="badge1"
                className="w-16 h-16 object-cover rounded border border-slate-700"
              />
            )}
            {materials.badgeImageUrl2 && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={materials.badgeImageUrl2}
                alt="badge2"
                className="w-16 h-16 object-cover rounded border border-slate-700"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
