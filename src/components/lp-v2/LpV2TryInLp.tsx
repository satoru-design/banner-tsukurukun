'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

/**
 * Phase A.17: V2 ホワイトテーマ TryInLp
 *
 * 業種選択 → 2s 疑似ローディング → ぼかしマスク + CTA。
 * Point Pharma 風: 白基調・深緑アクセント・絵文字なし・余白広め。
 */
const PRESETS = [
  { key: 'cosmetics', label: '化粧品・スキンケア', headline: '敏感肌のための保湿美容液' },
  { key: 'supplement', label: '健康食品・サプリ', headline: '腸活サプリ Five Point' },
  { key: 'apparel', label: 'アパレル D2C', headline: '夏限定・涼感 T シャツ' },
  { key: 'saas', label: 'サブスク・SaaS', headline: '月額 980 円〜の新しいツール' },
  { key: 'food', label: '食品・グルメ', headline: 'シェフ監修ミールキット' },
  { key: 'education', label: '教育・スクール', headline: '子ども向けプログラミング' },
] as const;

const LOADING_STEPS = [
  '商品情報を解析中...',
  '勝ちパターンを学習中...',
  'コピーを最適化中...',
  '17 サイズに展開中...',
] as const;

type Phase = 'idle' | 'loading' | 'result';

export const LpV2TryInLp = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (phase !== 'loading') return;
    let s = 0;
    const interval = window.setInterval(() => {
      s += 1;
      if (s >= LOADING_STEPS.length) {
        window.clearInterval(interval);
        window.setTimeout(() => setPhase('result'), 250);
      } else {
        setStep(s);
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [phase]);

  const onSelect = (key: string) => {
    setSelectedKey(key);
    setStep(0);
    setPhase('loading');
  };

  const selectedLabel = PRESETS.find((p) => p.key === selectedKey)?.label ?? '';

  if (phase === 'result') {
    return (
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="text-center text-sm text-emerald-800 font-bold">
          生成完了：{selectedLabel}
        </div>
        <MaskedPreview />
        <p className="text-center text-[11px] text-slate-500 leading-relaxed">
          ※ 表示中はサンプル例です。ご登録後、あなたの商品情報をもとに AI が同等品質で生成します。
        </p>
      </div>
    );
  }

  if (phase === 'loading') {
    const progress = Math.min(((step + 1) / LOADING_STEPS.length) * 100, 100);
    return (
      <div className="w-full max-w-md mx-auto py-16 space-y-6">
        <div className="text-center text-sm text-emerald-800 font-bold">
          {selectedLabel} 向けに生成中
        </div>
        <div className="space-y-3 max-w-xs mx-auto">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-700 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-sm text-slate-600 text-center min-h-[1.5em]">
            {LOADING_STEPS[step]}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-stone-50 border border-slate-200 rounded-2xl p-4 sm:p-6">
      <div className="text-center mb-4">
        <div className="text-[10px] sm:text-xs font-bold text-emerald-800 tracking-[0.18em] uppercase">
          Live Preview
        </div>
        <div className="text-sm sm:text-base font-bold text-slate-900 mt-1.5">
          業種を選んで 30 秒体験
        </div>
        <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
          17 サイズ・勝ちパターン学習を、その場でプレビュー
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((preset, i) => (
          <button
            key={preset.key}
            onClick={() => onSelect(preset.key)}
            className="text-left rounded-lg border border-slate-200 bg-white hover:border-emerald-700/50 hover:bg-emerald-700/5 px-2.5 py-2.5 transition-all cursor-pointer"
          >
            <div className="flex items-start gap-2.5">
              <span
                className="shrink-0 text-[10px] font-mono font-bold text-emerald-700/70 mt-0.5 tabular-nums"
                aria-hidden
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {preset.label}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  {preset.headline}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const MaskedPreview = () => {
  const BANNER_BASE = '/lp/banners';
  return (
    <div className="relative">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BANNER_BASE}/instagram-1080.png`} alt="" aria-hidden className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="col-span-1 flex flex-col gap-3 justify-center">
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BANNER_BASE}/yda-600x314.png`} alt="" aria-hidden className="w-full h-auto block" loading="lazy" decoding="async" />
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BANNER_BASE}/display-336x280.png`} alt="" aria-hidden className="w-full h-auto block" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BANNER_BASE}/display-pc-728x90.png`} alt="" aria-hidden className="w-full h-auto block" loading="lazy" decoding="async" />
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BANNER_BASE}/display-sp-320x100.png`} alt="" aria-hidden className="w-full h-auto block" loading="lazy" decoding="async" />
        </div>
      </div>
      <div className="absolute inset-0 backdrop-blur-md bg-white/55 rounded-xl flex flex-col items-center justify-center gap-4 p-6">
        <svg aria-hidden width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-800">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div className="text-sm text-slate-900 text-center font-bold leading-relaxed">
          全 17 サイズの完成バナーを
          <br />Google でログインして受け取る
        </div>
        <Link
          href="/signin?from=lp01_try"
          className="inline-flex items-center justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-3 rounded-md shadow-sm transition-all"
        >
          いますぐ無料で試してみる
        </Link>
        <div className="text-[10px] text-slate-700 text-center">
          ✓ クレカ不要　✓ ワンクリック　✓ いつでも解約
        </div>
      </div>
    </div>
  );
};
