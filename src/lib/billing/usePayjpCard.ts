'use client';

/**
 * payjp.js v2 のカード Element を扱う共有フック（移管 P4）
 *
 * 決済フォーム（新規サブスク）とカード変更フォームで共通利用する。
 * - script を 1 度だけ読み込み
 * - Payjp(公開鍵) 初期化 → elements().create('card') → mount
 * - createToken() で token を返す
 *
 * ⚠️ 3DS（本番必須）: 日本はカード登録時の本人認証義務化済み。
 *    本番投入前に createToken の three_d_secure フローを公式 docs で確認して組み込むこと。
 */
import { useEffect, useRef, useState } from 'react';

type PayjpCardElement = { mount: (selector: string | HTMLElement) => void };
type PayjpElements = { create: (type: 'card', options?: unknown) => PayjpCardElement };
type PayjpToken = { id: string; error?: { message?: string } };
type PayjpInstance = {
  elements: () => PayjpElements;
  createToken: (
    el: PayjpCardElement,
    options?: unknown
  ) => Promise<PayjpToken & { error?: { message?: string } }>;
};
declare global {
  interface Window {
    Payjp?: (publicKey: string) => PayjpInstance;
  }
}

const PAYJP_SCRIPT_SRC = 'https://js.pay.jp/v2/pay.js';

const loadPayjpScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.Payjp) return resolve();
    const existing = document.querySelector(`script[src="${PAYJP_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('payjp.js load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = PAYJP_SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('payjp.js load failed'));
    document.head.appendChild(s);
  });

export interface UsePayjpCardResult {
  /** card element の mount 先 ref を貼る div に渡す */
  mountRef: React.RefObject<HTMLDivElement | null>;
  ready: boolean;
  error: string | null;
  /** token を生成。失敗時は Error throw。 */
  createToken: () => Promise<string>;
}

export const usePayjpCard = (): UsePayjpCardResult => {
  const mountRef = useRef<HTMLDivElement>(null);
  const payjpRef = useRef<PayjpInstance | null>(null);
  const cardElementRef = useRef<PayjpCardElement | null>(null);
  const [ready, setReady] = useState(false);
  // 公開鍵未設定は初期 state で判定（effect 内の同期 setState を避ける）
  const [error, setError] = useState<string | null>(
    process.env.NEXT_PUBLIC_PAYJP_PUBLIC_KEY
      ? null
      : '決済設定が未完了です（公開鍵未設定）'
  );

  useEffect(() => {
    let cancelled = false;
    const pk = process.env.NEXT_PUBLIC_PAYJP_PUBLIC_KEY;
    if (!pk) return;
    loadPayjpScript()
      .then(() => {
        if (cancelled || !window.Payjp || !mountRef.current) return;
        const payjp = window.Payjp(pk);
        const card = payjp.elements().create('card');
        card.mount(mountRef.current);
        payjpRef.current = payjp;
        cardElementRef.current = card;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('決済フォームの読み込みに失敗しました');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createToken = async (): Promise<string> => {
    if (!payjpRef.current || !cardElementRef.current) {
      throw new Error('決済フォームが未準備です');
    }
    // TODO(3DS): 本番では three_d_secure フローを挟む
    const result = await payjpRef.current.createToken(cardElementRef.current);
    if (result.error || !result.id) {
      throw new Error(result.error?.message ?? 'カード情報を確認してください');
    }
    return result.id;
  };

  return { mountRef, ready, error, createToken };
};
