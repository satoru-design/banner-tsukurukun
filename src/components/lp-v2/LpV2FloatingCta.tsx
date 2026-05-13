'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export const LpV2FloatingCta = ({ href = '/signin?from=lp01_floating' }: { href?: string }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-40 transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_24px_rgba(15,23,42,0.08)] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="hidden sm:block flex-1">
            <div className="text-sm font-bold text-slate-900">
              いますぐ無料で 17 サイズを受け取る
            </div>
            <div className="text-[10px] text-slate-500">
              クレカ不要 / Google アカウントで 1 クリック開始
            </div>
          </div>
          <Link
            href={href}
            className="flex-1 sm:flex-none text-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-3 rounded-md shadow-sm transition-all"
          >
            いますぐ無料で試してみる
          </Link>
        </div>
      </div>
    </div>
  );
};
