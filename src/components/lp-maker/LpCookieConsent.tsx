'use client';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'lpmaker-cookie-consent-v1';

export function LpCookieConsent() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setShown(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setShown(false);
    // Sprint 3 CR C-5: AnalyticsInjector に同意成立を即時通知してタグを起動する。
    window.dispatchEvent(
      new CustomEvent('lpmaker-consent-changed', { detail: 'accepted' })
    );
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setShown(false);
    // 注: 厳密には GTM/GA4/Pixel の発火を declined 時に止める必要があるが、
    // Phase 1 では同意取得記録のみ。発火制御は Phase 2 で実装。
  }

  if (!shown) return null;

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
