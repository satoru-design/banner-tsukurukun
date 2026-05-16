'use client';

import { useEffect } from 'react';

/**
 * Phase A.19: サインアップファネル計測
 *
 * 各ステップで GTM dataLayer にイベントを push し、
 * GA4 探索レポートで離脱箇所を可視化できるようにする。
 *
 * ファネル設計:
 *  1. page_view              : LP 着地 (GTM 自動)
 *  2. cta_click              : CTA 押下 → /signin 遷移 (現状は href ?from=xxx で代用)
 *  3. signin_landed          : /signin 到達 (from クエリ付き)
 *  4. signin_clicked         : Google ボタン押下
 *  5. signed_in              : OAuth 完了・ダッシュボード到達
 *  6. first_generation       : 初回バナー生成完了 (Phase 2 以降)
 *
 * `pending_signin` sessionStorage で 4→5 の連続性を判定。
 */
type FunnelEvent =
  | 'signin_landed'
  | 'signin_clicked'
  | 'signed_in'
  | 'first_generation';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

interface Props {
  event: FunnelEvent;
  /** 明示的に from を渡す場合（pending_signin から取り出す等） */
  from?: string;
  /** signed_in 用: sessionStorage の pending_signin を消費する */
  consumePendingSignin?: boolean;
}

export const LpFunnelTracker = ({ event, from, consumePendingSignin }: Props) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let resolvedFrom = from;

    if (consumePendingSignin) {
      const pending = window.sessionStorage.getItem('pending_signin');
      if (!pending) {
        // pending_signin が無い = 既存ユーザーのダッシュボード再訪
        // signed_in イベントは発火しない
        return;
      }
      resolvedFrom = pending;
      window.sessionStorage.removeItem('pending_signin');
    }

    if (!resolvedFrom) {
      // URL クエリから取得（signin_landed 等）
      const params = new URLSearchParams(window.location.search);
      resolvedFrom = params.get('from') ?? 'unknown';
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event,
      from: resolvedFrom,
      timestamp: Date.now(),
    });
  }, [event, from, consumePendingSignin]);

  return null;
};

/**
 * Google サインインボタン押下時に呼ぶヘルパー。
 * pending_signin を sessionStorage に保存し、
 * OAuth 完了後の ダッシュボード到達時に signed_in を発火させる。
 */
export const trackSigninClicked = (from: string) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem('pending_signin', from);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'signin_clicked',
    from,
    timestamp: Date.now(),
  });
};
