'use client';

/**
 * Cookie 同意状態の読み取り口。
 *
 * LpCookieConsent と AnalyticsInjector が同じ localStorage キーと
 * 同じ CustomEvent を見るため、購読ロジックをここに集約する。
 *
 * useEffect の中で setState する実装から useSyncExternalStore へ移した。
 * localStorage はサーバーに無いので、初回描画で読むと hydration 不一致に
 * なる。useSyncExternalStore はサーバー用スナップショットを別に取れるので、
 * 「サーバーでは何も確定していない」を表現したまま、ハイドレーション後に
 * 実際の保存値へ切り替えられる。
 */

export const CONSENT_STORAGE_KEY = 'lpmaker-cookie-consent-v1';
export const CONSENT_EVENT = 'lpmaker-consent-changed';

/**
 * サーバー描画中とハイドレーション中に返す番兵値。
 * 実際の保存値ではなく「まだ読めていない」を意味する。
 * 非空文字列なので、保存値が無い状態 (null) とは truthy 判定で区別できる。
 */
export const CONSENT_PENDING = '__pending__';

/**
 * accepted の CustomEvent を一度受け取ったか。
 *
 * AnalyticsInjector は従来から localStorage ではなくイベントの detail を
 * 直接信用して発火していた。同意ボタンは保存と dispatch の両方を行うので
 * 実運用では一致するが、挙動を変えないためこのフラグを保持する。
 * 一度 true になったら戻らない点も従来どおり。
 */
let acceptedViaEvent = false;

const listeners = new Set<() => void>();

function handleConsentEvent(e: Event) {
  if ((e as CustomEvent).detail === 'accepted') acceptedViaEvent = true;
  for (const listener of listeners) listener();
}

/** useSyncExternalStore の subscribe。購読者が居る間だけ window に繋ぐ。 */
export function subscribeConsent(onStoreChange: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener(CONSENT_EVENT, handleConsentEvent);
  }
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      window.removeEventListener(CONSENT_EVENT, handleConsentEvent);
    }
  };
}

/**
 * 保存されている同意値。未設定なら null。
 * プライベートモード等で localStorage が触れない場合も null にする。
 */
export function getStoredConsent(): string | null {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** サーバー描画とハイドレーション中の保存値スナップショット。 */
export function getPendingConsent(): string {
  return CONSENT_PENDING;
}

/**
 * 解析タグを発火してよいか。
 * 保存値が accepted、または accepted のイベントを受けた場合のみ true。
 */
export function getAnalyticsConsent(): boolean {
  return acceptedViaEvent || getStoredConsent() === 'accepted';
}

/** サーバー描画とハイドレーション中は常に未同意として扱う。 */
export function getAnalyticsConsentOnServer(): boolean {
  return false;
}

/** テスト用。モジュールに溜まったイベント由来の同意を初期化する。 */
export function resetConsentStoreForTest(): void {
  acceptedViaEvent = false;
}
