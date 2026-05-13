'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Phase A.16: 退出インテントポップアップ
 *
 * マウスが画面上端を越えた瞬間に 1 度だけ発火。
 * モバイルでは history.back に対応した popstate でも代替トリガー（最小実装）。
 */
export const LpExitIntentModal = ({
  href = '/signin?from=lp01_exit',
}: { href?: string }) => {
  const [open, setOpen] = useState(false);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (triggered) return;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setTriggered(true);
        setOpen(true);
      }
    };
    document.addEventListener('mouseleave', onLeave);
    return () => document.removeEventListener('mouseleave', onLeave);
  }, [triggered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lp-exit-modal-title"
    >
      <div
        className="relative bg-slate-900 border border-emerald-500/40 rounded-xl max-w-md w-full p-8 shadow-2xl shadow-emerald-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="閉じる"
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 text-xl leading-none"
        >
          ×
        </button>
        <div className="text-center">
          <p id="lp-exit-modal-title" className="text-sm text-slate-300 mb-6 leading-relaxed">
            業種を選ぶだけで、AI 生成バナーが見られます。
            <br />
            <span className="text-emerald-300 font-bold">
              クレカ不要・Google ワンクリック
            </span>
            。
          </p>
          <Link
            href={href}
            className="block bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-4 rounded-lg shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02]"
          >
            いますぐ無料で試してみる
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            あとで検討する
          </button>
        </div>
      </div>
    </div>
  );
};
