'use client';

import Link from 'next/link';
import { CheckoutButton } from '@/components/billing/CheckoutButton';

const STARTER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? '';
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE ?? '';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '¥0',
    period: '/月',
    desc: 'まずはお試しに',
    features: [
      '月 3 セッション無料',
      '1 サイズのみ',
      'PREVIEW 透かし入り',
      '勝ちバナー添付不可',
    ],
    cta: { type: 'free' as const },
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '¥3,980',
    period: '/月',
    desc: '個人事業主・スモールチーム向け',
    features: [
      '月 30 セッション',
      '5 サイズ（主要 SNS）',
      '透かしなし',
      'お気に入り 5 枚',
    ],
    cta: { type: 'paid' as const, priceId: STARTER_PRICE_ID, label: 'Starter にする' },
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '¥14,800',
    period: '/月',
    desc: '広告運用・代理店・本格利用',
    features: [
      '月 100 セッション + 超過 ¥80/回',
      '全 17 サイズ対応',
      'プロンプト閲覧',
      '勝ちバナー無制限',
      'お気に入り 50 枚',
    ],
    cta: { type: 'paid' as const, priceId: PRO_PRICE_ID, label: 'Pro にする' },
    popular: true,
  },
];

export const PricingSection = () => {
  return (
    <section id="pricing" className="bg-slate-900 border-y border-slate-800 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-50 text-center">
          料金プラン
        </h2>
        <p className="text-slate-400 text-center mt-3">
          まずは無料で試してから。すべてのプランで透かしなしの本生成が可能（Free 除く）
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={`relative rounded-xl p-6 border ${
                p.popular
                  ? 'bg-emerald-500/5 border-emerald-500/40 shadow-xl shadow-emerald-500/10'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full">
                  人気
                </span>
              )}
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-100">{p.name}</h3>
                <div className="mt-3">
                  <span className="text-3xl font-black text-slate-50">{p.price}</span>
                  <span className="text-sm text-slate-400 ml-1">{p.period}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">{p.desc}</p>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {p.cta.type === 'free' ? (
                  <Link
                    href="/signin"
                    className="block text-center bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-4 py-3 rounded-lg border border-slate-700 transition"
                  >
                    無料で試す
                  </Link>
                ) : p.cta.priceId ? (
                  <CheckoutButton
                    basePriceId={p.cta.priceId}
                    label={p.cta.label}
                    className={
                      p.popular
                        ? 'w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-3 rounded-lg transition'
                        : 'w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-4 py-3 rounded-lg border border-slate-700 transition'
                    }
                  />
                ) : (
                  <Link
                    href="/signin"
                    className="block text-center bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-4 py-3 rounded-lg border border-slate-700 transition"
                  >
                    ログインして選ぶ
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center text-sm text-slate-400">
          月 100 回以上のご利用や代理店契約は{' '}
          <Link href="/contact" className="text-emerald-300 hover:text-emerald-200 underline">
            個別商談（Plan C）
          </Link>{' '}
          でご相談ください
        </div>
      </div>
    </section>
  );
};
