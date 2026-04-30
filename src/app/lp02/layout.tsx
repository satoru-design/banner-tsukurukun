import type { Metadata } from 'next';
import { LpAnalytics } from '@/components/lp/LpAnalytics';

export const metadata: Metadata = {
  title: '勝ちバナー作る君 — テンプレを作る時間、もう要りません | autobanner.jp',
  description:
    'ブリーフ → 完成まで 90 秒。1 ブリーフで 17 サイズ一括。あなたは戦略に集中できます。3 セッション無料体験。',
  openGraph: {
    title: 'テンプレを作る時間、もう要りません — 勝ちバナー作る君',
    description: 'ブリーフ → 17 サイズ一括生成。1/10 の時間で勝ちバナーを作れる AI ツール。',
    url: 'https://autobanner.jp/lp02',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'テンプレを作る時間、もう要りません',
    description: 'AI バナー一括生成。3 セッション無料体験。',
    images: ['/og-image.png'],
  },
};

export default function Lp02Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LpAnalytics />
    </>
  );
}
