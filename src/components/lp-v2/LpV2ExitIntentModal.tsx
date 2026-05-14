'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export const LpV2ExitIntentModal = ({
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lp-exit-modal-title"
    >
      <div
        className="relative bg-white border border-slate-300 rounded-[22px] max-w-md w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="閉じる"
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 text-xl leading-none"
        >
          ×
        </button>
        <div className="text-center">
          <h3
            id="lp-exit-modal-title"
            className="font-serif text-xl font-black text-slate-900 mb-3"
          >
            無料で試してみませんか？
          </h3>
          <p className="text-sm text-slate-700 mb-6 leading-relaxed">
            <span className="text-emerald-900 font-bold">クレカ不要</span>・
            <span className="text-emerald-900 font-bold">Google アカウント</span>
            があれば使えます。
          </p>
          <Link
            href={href}
            className="block bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-6 py-4 rounded-[10px] transition-colors"
          >
            いますぐ無料で試してみる
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            あとで検討する
          </button>
        </div>
      </div>
    </div>
  );
};
