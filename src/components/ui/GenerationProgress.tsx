'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Props = {
  /** 期待される所要時間（秒）。進捗バーのフィル速度の基準として使用。 */
  estimatedSeconds?: number;
  /** 見出しテキスト。省略時は "生成中…"。 */
  label?: string;
  /** コンパクト表示（カード内など小さい領域向け）。 */
  compact?: boolean;
};

/**
 * AI 生成処理の進捗を視覚的に伝えるコンポーネント。
 * 実際のサーバー側進捗は取れないため、経過時間ベースで 0〜95% まで加速度的にフィルし、
 * 推定時間超過後は不定進捗（縞アニメ）に切り替える。
 */
export function GenerationProgress({
  estimatedSeconds = 45,
  label = '生成中…',
  compact = false,
}: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const ratio = Math.min(elapsed / estimatedSeconds, 1);
  // 進捗は 95% で一旦止める（完了はサーバー応答で切り替わるため）
  const progressPct = Math.min(ratio * 95, 95);
  const overtime = elapsed >= estimatedSeconds;

  if (compact) {
    return (
      <div className="w-full px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            {label}
          </span>
          <span className="text-slate-500 tabular-nums">
            {Math.floor(elapsed)}s
          </span>
        </div>
        <ProgressBar progressPct={progressPct} indeterminate={overtime} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4 py-6 space-y-3">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-200">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{label}</span>
      </div>
      <ProgressBar progressPct={progressPct} indeterminate={overtime} />
      <div className="text-center text-xs text-slate-500 tabular-nums">
        {overtime
          ? `${Math.floor(elapsed)} 秒経過・もう少々お待ちください`
          : `${Math.floor(elapsed)} 秒経過`}
      </div>
    </div>
  );
}

function ProgressBar({
  progressPct,
  indeterminate,
}: {
  progressPct: number;
  indeterminate: boolean;
}) {
  if (indeterminate) {
    return (
      <div className="relative w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-sky-400 to-transparent"
          style={{
            animation: 'gp-slide 1.6s ease-in-out infinite',
          }}
        />
        <style jsx>{`
          @keyframes gp-slide {
            0% {
              left: -33%;
            }
            100% {
              left: 100%;
            }
          }
        `}</style>
      </div>
    );
  }
  return (
    <div className="relative w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-teal-400 transition-[width] duration-300 ease-out"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  );
}
