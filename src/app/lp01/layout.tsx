import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '勝ちバナー作る君 — EC バナーが 90 秒で 17 サイズ | autobanner.jp',
  description:
    'デザイナー不要。業種を選ぶだけで、AI が勝ちパターンを学習したバナーを 17 サイズに自動展開。クレカ不要・3 本まで無料で試せます。',
  openGraph: {
    title: '勝ちバナー作る君 — EC バナーが 90 秒で 17 サイズ',
    description:
      'デザイナー不要。業種を選ぶだけで、AI が勝ちバナーを 17 サイズに自動展開。EC のバナー制作時間を 1/10 に。',
    url: 'https://autobanner.jp/lp01',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '勝ちバナー作る君 — EC バナーが 90 秒で 17 サイズ',
    description: 'AI バナー一括生成ツール。クレカ不要・3 本まで無料で体験。',
    images: ['/og-image.png'],
  },
};

export default function Lp01Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
