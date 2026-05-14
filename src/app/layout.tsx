import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Noto_Serif_JP, Noto_Sans_JP } from "next/font/google";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth/auth";
import { Suspense } from "react";
import { PaymentFailedBanner } from "@/components/billing/PaymentFailedBanner";
import "./globals.css";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? '';

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: '勝ちバナー作る君',
  description: 'AI バナー一括生成ツール。1 ブリーフで 17 サイズ一括生成。',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  url: 'https://autobanner.jp/',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'JPY' },
    { '@type': 'Offer', name: 'Starter', price: '3980', priceCurrency: 'JPY' },
    { '@type': 'Offer', name: 'Pro', price: '14800', priceCurrency: 'JPY' },
  ],
  publisher: {
    '@type': 'Organization',
    name: '株式会社 4th Avenue Lab',
  },
} as const;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Phase A.18: LP 用の Editorial × Modern フォント
// Anthropic 公式 frontend-design skill 推奨 (Fraunces=Editorial serif)
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
});

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-display-jp",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-body-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://autobanner.jp'),
  title: {
    default: '勝ちバナー作る君 — 1 ブリーフで 17 サイズ一括生成',
    template: '%s | 勝ちバナー作る君',
  },
  description:
    'EC サイトのバナー制作時間を 1/10 に。AI が勝ちバナーを学習し、17 サイズを 90 秒で一括生成します。3 セッション無料体験。',
  openGraph: {
    title: '勝ちバナー作る君 — テンプレを作る時間、もう要りません',
    description:
      'ブリーフ → 17 サイズ一括生成。1/10 の時間で勝ちバナーを作れる AI ツール。',
    url: 'https://autobanner.jp/',
    siteName: '勝ちバナー作る君',
    images: ['/og-image.png'],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '勝ちバナー作る君',
    description: 'AI バナー一括生成ツール。3 セッション無料体験。',
    images: ['/og-image.png'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Phase A.11.1: SSR で session を取得し SessionProvider に渡す（フラッシュ回避）
  const session = await auth();
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${notoSerifJP.variable} ${notoSansJP.variable} h-full antialiased`}
    >
      {GTM_ID ? (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      ) : null}
      <body className="min-h-full flex flex-col">
        {GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        ) : null}
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="afterInteractive"
        >
          {JSON.stringify(STRUCTURED_DATA)}
        </Script>
        <Suspense fallback={null}>
          <PaymentFailedBanner />
        </Suspense>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
