import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'お問合せ・大規模利用相談 | 勝ちバナー作る君',
  description:
    '月 100 枚を超える利用 / 代理店契約 / カスタム機能などのご要望はこちら。2 営業日以内に返信します。',
  robots: {
    index: false,
    follow: true,
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
