'use client';

import React from 'react';
import type { PriceBadge as PriceBadgeType, PriceBadgeShape } from '@/lib/banner-state';

const BADGE_STYLES: Record<PriceBadgeShape, string> = {
  'circle-red':
    'w-[120px] h-[120px] rounded-full bg-[#E63946] text-white flex flex-col items-center justify-center text-center font-black shadow-lg',
  'circle-gold':
    'w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#D4A017] to-[#8B6914] text-white flex flex-col items-center justify-center text-center font-black shadow-lg border-2 border-[#FFD700]',
  'rect-red':
    'px-6 py-3 rounded-xl bg-[#E63946] text-white font-black shadow-md -rotate-3',
  'ribbon-orange':
    'relative px-8 py-2 bg-[#FF6B35] text-white font-black shadow-md',
  'capsule-navy':
    'px-6 py-2 rounded-full bg-[#1D3557] text-white font-bold shadow-sm',
};

type Props = {
  badge: PriceBadgeType;
};

export function PriceBadge({ badge }: Props) {
  const base = BADGE_STYLES[badge.shape] ?? BADGE_STYLES['circle-red'];
  const style = { backgroundColor: badge.color || undefined };

  // emphasisNumber がある場合は数字部分を他のテキストと分離表示（ジャンプ率強調）
  if (badge.emphasisNumber) {
    const idx = badge.text.indexOf(badge.emphasisNumber);
    if (idx >= 0) {
      const before = badge.text.slice(0, idx);
      const after = badge.text.slice(idx + badge.emphasisNumber.length);
      return (
        <div className={base} style={style} data-testid="price-badge">
          {before && <span className="text-[14px] leading-none">{before}</span>}
          <span className="text-[32px] leading-none">{badge.emphasisNumber}</span>
          {after && <span className="text-[14px] leading-none">{after}</span>}
        </div>
      );
    }
    // Fallback: emphasisNumber not in text, render as single line
  }

  return (
    <div className={base} style={style} data-testid="price-badge">
      <span className="text-[16px] leading-tight">{badge.text}</span>
    </div>
  );
}
