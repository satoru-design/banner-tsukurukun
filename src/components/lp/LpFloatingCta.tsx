'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Phase A.16: 画面下部フローティング CTA
 *
 * - スクロールが 400px を超えたら表示
 * - 離脱方向（画面下端まで）でも常時可視 → モバイル LP の必勝パターン
 */
export const LpFloatingCta = ({ href = '/signin?from=lp01_floating' }: { href?: string }) => {
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
      <div className="bg-slate-950/95 backdrop-blur-md border-t border-emerald-500/40 shadow-2xl shadow-emerald-500/20 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="hidden sm:block flex-1">
            <div className="text-sm font-bold text-slate-100">
              いますぐ無料で 17 サイズを受け取る
            </div>
            <div className="text-[10px] text-slate-400">
              クレカ不要 / Google アカウントで 1 クリック開始
            </div>
          </div>
          <Link
            href={href}
            className="flex-1 sm:flex-none text-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-3 rounded-lg shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02]"
          >
            いますぐ無料で試してみる
          </Link>
        </div>
      </div>
    </div>
  );
};
