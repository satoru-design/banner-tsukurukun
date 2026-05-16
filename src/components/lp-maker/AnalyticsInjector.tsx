'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';

/**
 * Sprint 3 CR C-5: Cookie consent gate された分析タグインジェクター。
 *
 * 仕様:
 *   - localStorage 'lpmaker-cookie-consent-v1' が 'accepted' になるまで何も render しない。
 *   - LpCookieConsent が 'accept' を押した瞬間 'lpmaker-consent-changed' CustomEvent を dispatch するので
 *     リアルタイムで再 render → タグが発火する。
 *   - 'declined' / NULL の状態では一切タグを発火しない（GDPR / 改正電気通信事業法 16 条の 3 対応）。
 *
 * Phase 1 では同意取得記録だけだったので Sprint 3 で本実装に格上げ。
 */
const STORAGE_KEY = 'lpmaker-cookie-consent-v1';

interface Props {
  config: {
    gtmId?: string;
    ga4Id?: string;
    clarityId?: string;
    pixelId?: string;
  };
}

/**
 * 分析タグ ID をインライン JS に埋め込む前のサニタイズ。
 * GTM (GTM-XXXX) / GA4 (G-XXXX) / Clarity / Pixel いずれも
 * 英数 + `-` + `_` のみ正当。それ以外は除去して XSS 経路を遮断する。
 */
function safeId(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '');
  return cleaned.length > 0 && cleaned.length <= 64 ? cleaned : null;
}

export function AnalyticsInjector({ config }: Props) {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = localStorage.getItem(STORAGE_KEY);
    if (c === 'accepted') setConsented(true);
    // accept ボタン押下のリアルタイム反映用
    function onConsent(e: Event) {
      if ((e as CustomEvent).detail === 'accepted') setConsented(true);
    }
    window.addEventListener('lpmaker-consent-changed', onConsent);
    return () => window.removeEventListener('lpmaker-consent-changed', onConsent);
  }, []);

  if (!consented) return null;

  const gtmId = safeId(config.gtmId);
  const ga4Id = safeId(config.ga4Id);
  const clarityId = safeId(config.clarityId);
  const pixelId = safeId(config.pixelId);

  return (
    <>
      {gtmId && (
        <Script
          id="gtm-injector"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
          }}
        />
      )}
      {ga4Id && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-injector"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${ga4Id}');`,
            }}
          />
        </>
      )}
      {clarityId && (
        <Script
          id="clarity-injector"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`,
          }}
        />
      )}
      {pixelId && (
        <Script
          id="pixel-injector"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${pixelId}');fbq('track', 'PageView');`,
          }}
        />
      )}
    </>
  );
}
