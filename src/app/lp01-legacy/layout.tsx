import type { Metadata } from 'next';

/**
 * Phase A.16: lp01 旧版（A/B テスト B バリアント）
 *
 * middleware で `/lp01` への 50% 流入を rewrite 経由でこのルートに振り分ける。
 * 直接アクセスも可能（`?v=b` 強制 or 動作確認用）。
 */
export const metadata: Metadata = {
  title: '勝ちバナー作る君 — 1 ブリーフで 17 サイズ一括生成 | autobanner.jp',
  description:
    'EC サイトのバナー制作時間を 1/10 に。AI が勝ちバナーを学習し、17 サイズを 90 秒で一括生成します。3 本まで無料体験。',
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
    description: 'AI バナー一括生成ツール。3 本まで無料体験。',
    images: ['/og-image.png'],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function Lp01LegacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
