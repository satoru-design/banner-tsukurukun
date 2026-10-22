'use client';
import { useState, useSyncExternalStore } from 'react';
import {
  CONSENT_EVENT,
  CONSENT_STORAGE_KEY as STORAGE_KEY,
  getPendingConsent,
  getStoredConsent,
  subscribeConsent,
} from './consent-store';

export function LpCookieConsent() {
  // 保存値の読み取りは useSyncExternalStore 経由。サーバー描画と
  // ハイドレーション中は番兵値 (truthy) が返るのでバナーは出ない。
  // ハイドレーション後に実際の値へ切り替わり、未設定ならバナーが出る。
  // 従来の useEffect + setState と同じ見え方になる。
  const storedConsent = useSyncExternalStore(
    subscribeConsent,
    getStoredConsent,
    getPendingConsent,
  );
  // このセッションで同意または拒否を押したか。decline はイベントを流さない
  // ため store からは観測できないので、従来どおりローカル state で閉じる。
  const [dismissed, setDismissed] = useState(false);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setDismissed(true);
    // Sprint 3 CR C-5: AnalyticsInjector に同意成立を即時通知してタグを起動する。
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'accepted' }));
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setDismissed(true);
    // 注: 厳密には GTM/GA4/Pixel の発火を declined 時に止める必要があるが、
    // Phase 1 では同意取得記録のみ。発火制御は Phase 2 で実装。
  }

  // 番兵値・accepted・declined はいずれも truthy なのでバナーを出さない。
  // null と空文字のときだけ出す。従来の `if (!consent) setShown(true)` と同じ。
  if (dismissed || storedConsent) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 z-50 shadow-2xl">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-300 flex-1">
          このサイトでは Cookie / アクセス解析タグ (GTM・GA4・Meta Pixel 等) を使用しています。
          これらは米国の事業者にデータが送信される場合があります。
          下記「同意する」を押すと有効化されます。
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={decline}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2"
          >
            拒否
          </button>
          <button
            type="button"
            onClick={accept}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-4 py-2 rounded"
          >
            同意する
          </button>
        </div>
      </div>
    </div>
  );
}
