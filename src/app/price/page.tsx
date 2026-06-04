import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '料金表 | autobanner.jp',
  description:
    'autobanner.jp（AIバナー自動生成SaaS）の料金表。月額プランは Starter ¥4,980 / Pro ¥14,800 / Business ¥39,800（すべて税込）。Free（¥0）の無料体験あり。',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://autobanner.jp/price' },
};

interface Plan {
  name: string;
  price: string;
  unit?: string;
  accent: string;
  badge?: string;
  rows: { label: string; value: string }[];
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '¥0',
    accent: 'text-slate-300 border-slate-700',
    rows: [
      { label: '月間生成枚数', value: '10 枚（透かし入り）' },
      { label: '対応サイズ', value: '主要のみ' },
      { label: '上限', value: '15 枚' },
      { label: '対象', value: 'お試し' },
    ],
  },
  {
    name: 'Starter',
    price: '¥4,980',
    unit: '/ 月',
    accent: 'text-sky-300 border-sky-700/50',
    rows: [
      { label: '月間生成枚数', value: '30 枚' },
      { label: '対応サイズ', value: '5 サイズ' },
      { label: '上限', value: '30 枚' },
      { label: '対象', value: '個人・副業' },
    ],
  },
  {
    name: 'Pro',
    price: '¥14,800',
    unit: '/ 月',
    accent: 'text-teal-300 border-teal-700/50',
    badge: '人気',
    rows: [
      { label: '月間生成枚数', value: '100 枚' },
      { label: '対応サイズ', value: '全 17 サイズ' },
      { label: '上限', value: '500 枚' },
      { label: '対象', value: 'マーケター・小規模チーム' },
    ],
  },
  {
    name: 'Business',
    price: '¥39,800',
    unit: '/ 月',
    accent: 'text-emerald-300 border-emerald-700/50',
    badge: '最上位',
    rows: [
      { label: '月間生成枚数', value: '1,000 枚' },
      { label: '対応サイズ', value: '全 17 サイズ' },
      { label: '上限', value: '3,000 枚' },
      { label: '対象', value: '代理店・中堅EC' },
    ],
  },
];

const OVERAGE = [
  { item: 'バナー生成 超過分（上限超）', plan: 'Pro', price: '¥80 / 枚' },
  { item: 'バナー生成 超過分（上限超）', plan: 'Business', price: '¥40 / 枚' },
  { item: 'LP生成 超過分（月20本超）', plan: 'Pro', price: '¥980 / 本' },
];

export default function PricePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-5 py-14">
        <header className="border-b-2 border-teal-600 pb-6 mb-10">
          <p className="text-sm font-bold tracking-wider text-teal-400">
            autobanner.jp（AIバナー自動生成SaaS）
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black">料金表</h1>
          <p className="mt-3 text-sm text-slate-400">
            価格はすべて税込・月額 ／ 運営: 株式会社4th Avenue Lab
          </p>
        </header>

        <div className="rounded-lg border border-teal-800/50 bg-teal-950/30 px-5 py-4 text-sm text-teal-100 mb-10">
          本サービスの商材（月額サブスクリプションプラン）の単価は{' '}
          <b>最低 ¥4,980（Starter）〜 最高 ¥39,800（Business）</b> です。Free（¥0）は無料体験枠です。
          各プランの利用上限を超えた分のみ、下記②の従量課金（都度課金）が発生します。
        </div>

        <h2 className="text-lg font-bold mb-4">① 月額プラン（主要商材）</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl border bg-slate-900/60 p-5 ${p.accent}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold">{p.name}</h3>
                {p.badge && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white">
                    {p.badge}
                  </span>
                )}
              </div>
              <div className="mb-4">
                <span className="text-2xl font-extrabold text-white">{p.price}</span>
                {p.unit && <span className="ml-1 text-xs text-slate-400">{p.unit}</span>}
              </div>
              <dl className="space-y-2 text-sm">
                {p.rows.map((r) => (
                  <div key={r.label} className="flex justify-between gap-2">
                    <dt className="text-slate-400">{r.label}</dt>
                    <dd className="text-right text-slate-200">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <h2 className="text-lg font-bold mb-4">
          ② 従量課金（オプション・各プラン上限超過分のみ／都度課金）
        </h2>
        <div className="overflow-x-auto mb-10">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-200">
                <th className="border border-slate-700 px-4 py-3 text-left">項目</th>
                <th className="border border-slate-700 px-4 py-3">対象プラン</th>
                <th className="border border-slate-700 px-4 py-3">単価（税込）</th>
              </tr>
            </thead>
            <tbody>
              {OVERAGE.map((o, i) => (
                <tr key={i} className="bg-slate-900/40">
                  <td className="border border-slate-800 px-4 py-3 text-left text-slate-200">
                    {o.item}
                  </td>
                  <td className="border border-slate-800 px-4 py-3 text-center text-slate-300">
                    {o.plan}
                  </td>
                  <td className="border border-slate-800 px-4 py-3 text-center font-semibold text-white">
                    {o.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500 leading-7 border-t border-slate-800 pt-6">
          <p>※ 従量課金は各月額プランの利用上限を超えた場合にのみ、当月分をまとめて請求します（任意・オプション）。</p>
          <p>※ お支払いは毎月の自動課金（申込日と同日）。決済代行サービスとして PAY.JP を利用します。</p>
          <p>※ 解約はマイページからいつでも可能。日割り返金は行いません。</p>
          <p className="mt-3 text-slate-400">
            株式会社4th Avenue Lab ／{' '}
            <Link href="/" className="underline hover:text-slate-200">
              autobanner.jp
            </Link>{' '}
            ／{' '}
            <Link href="/legal/tokutei" className="underline hover:text-slate-200">
              特定商取引法に基づく表記
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
