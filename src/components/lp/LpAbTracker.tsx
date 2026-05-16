'use client';

import { useEffect } from 'react';

/**
 * Phase A.16: A/B variant を GTM/GA4 dataLayer に送るトラッカー
 *
 * - `variant` props で明示（middleware による rewrite を信頼）
 * - cookie 値とも突合（不一致なら cookie 側を優先送信）
 * - dataLayer に `ab_lp01_view` イベントと `ab_lp01_variant` カスタムディメンション
 */
interface Props {
  variant: 'a' | 'b';
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export const LpAbTracker = ({ variant }: Props) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // cookie から実際の値を読み取り、props と突合
    const cookieMatch = document.cookie.match(/(?:^|;\s*)ab_lp01=([^;]+)/);
    const cookieVariant = cookieMatch?.[1];
    const resolved = cookieVariant === 'a' || cookieVariant === 'b' ? cookieVariant : variant;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'ab_lp01_view',
      ab_lp01_variant: resolved,
    });
  }, [variant]);

  return null;
};
