import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '勝ちバナー作る君 — 1 ブリーフで 17 サイズ一括生成 | autobanner.jp',
  description:
    'EC サイトのバナー制作時間を 1/10 に。AI が勝ちバナーを学習し、17 サイズを 90 秒で一括生成します。3 セッション無料体験。',
  openGraph: {
    title: '勝ちバナー作る君 — 1 ブリーフで 17 サイズ一括生成',
    description:
      'AI が勝ちバナーを学習し、17 サイズを 90 秒で一括生成。EC のバナー制作時間を 1/10 に。',
    url: 'https://autobanner.jp/lp01',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '勝ちバナー作る君 — 1 ブリーフで 17 サイズ一括生成',
    description: 'AI バナー一括生成ツール。3 セッション無料体験。',
    images: ['/og-image.png'],
  },
};

export default function Lp01Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
