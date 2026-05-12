'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

/**
 * Phase A.16: In-LP Try（Preset 選択 → 疑似ローディング 2s → マスク付きプレビュー）
 *
 * 目的: サインアップ前にバナー完成イメージを体験させ CVR を 2-3x に。
 * 設計: API コール 0・Bot 攻撃面なし・全クライアントサイド完結。
 *
 * 倫理ライン: 表示中は「サンプル例」と必ず注記し、誤認誘引を回避する。
 */

const PRESETS = [
  {
    key: 'cosmetics',
    emoji: '🧴',
    label: '化粧品・スキンケア',
    headline: '敏感肌のための保湿美容液',
    sub: '30 日返金保証',
  },
  {
    key: 'supplement',
    emoji: '💊',
    label: '健康食品・サプリ',
    headline: '腸活サプリ Five Point',
    sub: '初回 50% OFF',
  },
  {
    key: 'apparel',
    emoji: '👕',
    label: 'アパレル D2C',
    headline: '夏限定・涼感 T シャツ',
    sub: '3 枚で送料無料',
  },
  {
    key: 'saas',
    emoji: '💻',
    label: 'サブスク・SaaS',
    headline: '月額 980 円〜の新しいツール',
    sub: '無料トライアル受付中',
  },
  {
    key: 'food',
    emoji: '🍽️',
    label: '食品・グルメ',
    headline: 'シェフ監修ミールキット',
    sub: '2 食 1,000 円',
  },
  {
    key: 'education',
    emoji: '🎓',
    label: '教育・スクール',
    headline: '子ども向けプログラミング',
    sub: '無料体験申込受付中',
  },
] as const;

const LOADING_STEPS = [
  '商品情報を解析中...',
  '勝ちパターンを学習中...',
  'コピーを最適化中...',
  '17 サイズに展開中...',
] as const;

type Phase = 'idle' | 'loading' | 'result';

export const LpTryInLp = () => {
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
        <div className="text-center text-sm text-emerald-300 font-bold">
          ✨ 生成完了：{selectedLabel}
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
        <div className="text-center text-sm text-emerald-300 font-bold">
          {selectedLabel} 向けに生成中
        </div>
        <div className="space-y-3 max-w-xs mx-auto">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-sm text-slate-300 text-center min-h-[1.5em]">
            {LOADING_STEPS[step]}
          </div>
        </div>
      </div>
    );
  }

  // idle
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-4">
        <div className="text-sm font-bold text-emerald-300">
          🎯 業種を選ぶだけで、いますぐ体験
        </div>
        <div className="text-xs text-slate-400 mt-1">
          17 サイズ・勝ちパターン学習を、その場でプレビュー
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            onClick={() => onSelect(preset.key)}
            className="text-left rounded-lg border border-slate-700/60 bg-slate-900/60 hover:bg-slate-800 hover:border-emerald-500/60 px-3 py-3 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl shrink-0" aria-hidden>
                {preset.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-100 truncate">
                  {preset.label}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
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
          <div className="col-span-2 aspect-square rounded-xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-emerald-500/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BANNER_BASE}/instagram-1080.png`}
              alt=""
              aria-hidden
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="col-span-1 flex flex-col gap-3 justify-center">
            <div className="rounded-xl overflow-hidden border border-slate-700/60 shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BANNER_BASE}/yda-600x314.png`}
                alt=""
                aria-hidden
                className="w-full h-auto block"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-700/60 shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BANNER_BASE}/display-336x280.png`}
                alt=""
                aria-hidden
                className="w-full h-auto block"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-700/60 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BANNER_BASE}/display-pc-728x90.png`}
            alt=""
            aria-hidden
            className="w-full h-auto block"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="rounded-lg overflow-hidden border border-slate-700/60 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BANNER_BASE}/display-sp-320x100.png`}
            alt=""
            aria-hidden
            className="w-full h-auto block"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
      {/* ぼかしマスク + 中央 CTA */}
      <div className="absolute inset-0 backdrop-blur-md bg-slate-950/40 rounded-xl flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-4xl" aria-hidden>
          🔒
        </div>
        <div className="text-sm text-slate-100 text-center font-bold leading-relaxed">
          全 17 サイズの完成バナーを
          <br />
          Google でログインして受け取る
        </div>
        <Link
          href="/signin?from=lp01_try"
          className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-lg shadow-xl shadow-emerald-500/40 transition-all hover:scale-[1.03]"
        >
          いますぐ無料で試してみる
        </Link>
        <div className="text-[10px] text-slate-200 text-center">
          ✓ クレカ不要　✓ ワンクリック　✓ いつでも解約
        </div>
      </div>
    </div>
  );
};
