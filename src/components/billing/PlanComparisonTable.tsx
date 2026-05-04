'use client';

/**
 * Phase A.17.0: /account のプラン比較テーブル
 *
 * カード型から freee 会計風の比較テーブルに刷新:
 * - 現在のプラン列を強調（左右ボーダー + 「利用中」リボン）
 * - 13 行の機能比較で差分を一覧
 * - 最下段に CTA ボタン（行内なので高さ揃う）
 * - mobile は horizontal scroll で潰さない
 */
import { Fragment } from 'react';
import type { CurrentUser } from '@/lib/auth/get-current-user';
import { CheckoutButton } from './CheckoutButton';
import { DowngradeButton } from './DowngradeButton';

type PlanKey = 'starter' | 'pro' | 'business';

interface PlanCol {
  key: PlanKey;
  name: string;
  emoji: string;
  price: string;
  priceIdEnv: 'NEXT_PUBLIC_STRIPE_PRICE_STARTER' | 'NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE' | 'NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE';
  rank: number;
  badge?: string;
  color: 'sky' | 'teal' | 'emerald';
}

const PLANS: PlanCol[] = [
  {
    key: 'starter',
    name: 'Starter',
    emoji: '🌱',
    price: '¥3,980',
    priceIdEnv: 'NEXT_PUBLIC_STRIPE_PRICE_STARTER',
    rank: 1,
    color: 'sky',
  },
  {
    key: 'pro',
    name: 'Pro',
    emoji: '💼',
    price: '¥14,800',
    priceIdEnv: 'NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE',
    rank: 2,
    badge: 'おすすめ',
    color: 'teal',
  },
  {
    key: 'business',
    name: 'Business',
    emoji: '🚀',
    price: '¥39,800',
    priceIdEnv: 'NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE',
    rank: 3,
    badge: 'NEW',
    color: 'emerald',
  },
];

interface Row {
  category?: string;
  label: string;
  values: [string, string, string]; // [starter, pro, business]
}

const ROWS: Row[] = [
  // 料金
  { category: '料金', label: '月額（税込）', values: ['¥3,980', '¥14,800', '¥39,800'] },
  { label: '超過課金', values: ['なし', '¥80 / 枚', '¥40 / 枚'] },
  { label: '利用上限', values: ['30 枚', '500 枚', '3,000 枚'] },

  // 生成
  { category: '生成', label: '月の枚数', values: ['30', '100', '1,000'] },
  { label: '対応サイズ', values: ['5（主要 SNS）', '全 17 サイズ', '全 17 サイズ'] },
  { label: '複数スタイル並列', values: ['—', '✓', '✓ 最大 6'] },
  { label: '透かしなし', values: ['✓', '✓', '✓'] },

  // 機能
  { category: '機能', label: '勝ちバナー添付', values: ['—', '無制限', '無制限'] },
  { label: 'プロンプト閲覧', values: ['—', '✓', '✓'] },
  { label: 'お気に入り保持', values: ['5 枚', '50 枚', '無制限'] },
  { label: '一括 ZIP DL', values: ['—', '✓', '✓'] },

  // Business 限定（順次提供）
  { category: 'Business 限定（順次提供）', label: 'クライアント別フォルダ', values: ['—', '—', '🔜'] },
  { label: '拡張 Brand Kit', values: ['—', '—', '🔜'] },
];

const COLOR = {
  sky: {
    bgCol: 'bg-sky-500/10',
    bgCell: 'bg-sky-500/[0.04]',
    border: 'border-sky-500',
    badge: 'bg-sky-500',
    button: 'bg-sky-600 hover:bg-sky-700',
    text: 'text-sky-300',
  },
  teal: {
    bgCol: 'bg-teal-500/10',
    bgCell: 'bg-teal-500/[0.04]',
    border: 'border-teal-500',
    badge: 'bg-teal-500',
    button: 'bg-teal-600 hover:bg-teal-700',
    text: 'text-teal-300',
  },
  emerald: {
    bgCol: 'bg-emerald-500/10',
    bgCell: 'bg-emerald-500/[0.04]',
    border: 'border-emerald-500',
    badge: 'bg-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    text: 'text-emerald-300',
  },
};

interface Props {
  user: CurrentUser;
}

export function PlanComparisonTable({ user }: Props) {
  // env から取得した priceId map（NEXT_PUBLIC_ なのでブラウザ側からも参照可）
  const priceIds: Record<PlanKey, string | undefined> = {
    starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
    pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE,
    business: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE,
  };

  const userRank: Record<string, number> = { free: 0, starter: 1, pro: 2, business: 3, admin: 99 };
  const currentRank = userRank[user.plan] ?? 0;

  const renderCTA = (p: PlanCol) => {
    const isCurrent = user.plan === p.key;
    const colors = COLOR[p.color];

    if (isCurrent) {
      return (
        <div className="text-center text-sm font-bold text-white py-3">
          利用中
        </div>
      );
    }

    if (user.plan === 'admin') {
      const priceId = priceIds[p.key];
      if (!priceId) return null;
      return (
        <CheckoutButton
          basePriceId={priceId}
          label={`${p.name} を試す`}
          className={`w-full ${colors.button} text-white px-3 py-3 rounded font-bold text-sm disabled:opacity-50`}
        />
      );
    }

    // 同 rank 以下 → ダウングレード（期末切替）
    if (p.rank < currentRank && currentRank > 0) {
      return (
        <DowngradeButton
          targetPlan={p.key === 'business' ? 'pro' : p.key}
          label={`${p.name} にダウン（期末）`}
        />
      );
    }

    // 上位 rank → アップグレード or 新規 Checkout
    const priceId = priceIds[p.key];
    if (!priceId) return null;
    const ctaLabel = currentRank === 0 ? `${p.name} で始める` : `${p.name} にアップグレード`;
    return (
      <CheckoutButton
        basePriceId={priceId}
        label={ctaLabel}
        className={`w-full ${colors.button} text-white px-3 py-3 rounded font-bold text-sm disabled:opacity-50`}
      />
    );
  };

  return (
    <div className="pt-3">
      <table className="w-full border-collapse table-fixed">
        {/* ============ ヘッダー（プラン名・価格・badge） ============ */}
        <thead>
          <tr>
            <th className="text-left text-xs text-slate-500 font-normal w-[28%] pb-4 align-bottom">
              プラン比較
            </th>
            {PLANS.map((p) => {
              const isCurrent = user.plan === p.key;
              const colors = COLOR[p.color];
              return (
                <th
                  key={p.key}
                  className={`relative px-3 pt-7 pb-4 text-center align-bottom w-[24%] ${
                    isCurrent ? `${colors.bgCol} border-l-2 border-r-2 border-t-2 ${colors.border} rounded-t-lg` : ''
                  }`}
                >
                  {/* 現プラン or 推奨 / NEW リボン */}
                  {isCurrent ? (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full ${colors.badge} text-white text-xs font-bold whitespace-nowrap shadow-lg`}>
                      ✓ 利用中
                    </div>
                  ) : p.badge ? (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full ${colors.badge} text-white text-xs font-bold whitespace-nowrap shadow-lg`}>
                      {p.badge}
                    </div>
                  ) : null}

                  <div className={`text-sm font-bold ${colors.text}`}>
                    {p.emoji} {p.name}
                  </div>
                  <div className="mt-2 text-lg font-black text-white">{p.price}</div>
                  <div className="text-[10px] text-slate-500">/月 税込</div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* ============ 機能比較行 ============ */}
        <tbody>
          {ROWS.map((row, i) => {
            const showCategory = !!row.category;
            return (
              <Fragment key={`row-${i}`}>
                {showCategory && (
                  <tr>
                    <td colSpan={4} className="pt-7 pb-2 px-2">
                      <div className="flex items-center gap-2 border-b-2 border-slate-700 pb-2">
                        <span className="inline-block w-1 h-5 bg-emerald-500 rounded-sm"></span>
                        <span className="text-base font-bold text-white">
                          {row.category}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr className={showCategory ? '' : 'border-t border-slate-800/40'}>
                  <th className="text-left px-2 py-3 text-sm text-slate-300 font-normal">
                    {row.label}
                  </th>
                  {row.values.map((val, idx) => {
                    const p = PLANS[idx];
                    const isCurrent = user.plan === p.key;
                    const colors = COLOR[p.color];
                    return (
                      <td
                        key={idx}
                        className={`px-3 py-3 text-center text-sm text-slate-200 ${
                          isCurrent ? `${colors.bgCell} border-l-2 border-r-2 ${colors.border}` : ''
                        }`}
                      >
                        {val === '✓' ? (
                          <span className="text-emerald-400 text-base">✓</span>
                        ) : val === '—' ? (
                          <span className="text-slate-600">—</span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}

          {/* ============ CTA 行（高さ統一） ============ */}
          <tr className="border-t border-slate-800/40">
            <th></th>
            {PLANS.map((p) => {
              const isCurrent = user.plan === p.key;
              const colors = COLOR[p.color];
              return (
                <td
                  key={p.key}
                  className={`px-3 pt-4 pb-5 align-top ${
                    isCurrent ? `${colors.bgCol} border-l-2 border-r-2 border-b-2 ${colors.border} rounded-b-lg` : ''
                  }`}
                >
                  {renderCTA(p)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      {/* Plan C 動線 */}
      <p className="mt-6 text-xs text-slate-500 text-center">
        💡 月 3,000 枚を超える運用・年契約・SLA・専任サポートをご希望なら{' '}
        <a href="/lp01#contact" className="underline hover:text-slate-300">
          Plan C のお問い合わせへ。
        </a>
      </p>
    </div>
  );
}
