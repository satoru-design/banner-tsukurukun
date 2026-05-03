'use client';

import type { CurrentUser } from '@/lib/auth/get-current-user';
import { CheckoutButton } from './CheckoutButton';
import { DowngradeButton } from './DowngradeButton';

interface Props {
  user: CurrentUser;
}

/**
 * Phase A.17.0: /account 常設の Starter プラン切替カード
 *
 * 3 カード並列構成（Starter / Pro / Business）の左端。
 *
 * - free / admin: Starter を試す CTA
 * - starter: 「現在のプラン」表示・CTA なし
 * - pro / business: Starter にダウングレード（期末切替）
 */
export function StarterPlanCard({ user }: Props) {
  const starterBasePriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER;
  if (!starterBasePriceId) return null;

  const isStarter = user.plan === 'starter';

  const renderAction = () => {
    if (isStarter) return null;
    if (user.plan === 'pro' || user.plan === 'business') {
      return <DowngradeButton targetPlan="starter" label="Starter にダウングレード（期末切替）" />;
    }
    const ctaLabel =
      user.plan === 'admin' ? 'Starter を試す（admin プレビュー）' : 'Starter を試す';
    return (
      <CheckoutButton
        basePriceId={starterBasePriceId}
        label={ctaLabel}
        className="w-full bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 rounded font-bold disabled:opacity-50"
      />
    );
  };

  return (
    <div className="rounded-lg border border-sky-700/40 bg-gradient-to-br from-sky-950/40 to-slate-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-sky-300">
            🌱 Starter プラン
            {isStarter && (
              <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-sky-500 text-white">
                現在のプラン
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">個人マーケター・副業・お試し利用向け</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">¥3,980</div>
          <div className="text-xs text-slate-500">/ 月（税込）</div>
        </div>
      </div>

      <ul className="text-sm text-slate-300 space-y-1 mb-4">
        <li>✅ 30 枠 / 月</li>
        <li>✅ メータード課金なし（コスト固定）</li>
        <li>✅ 上限 30 枠（追加課金で暴騰の心配なし）</li>
        <li>✅ 5 サイズ（主要 SNS のみ）</li>
        <li className="text-slate-500 text-xs pt-1">
          🎁 透かしなし・お気に入り 5 枚保持
        </li>
      </ul>

      {renderAction()}

      <p className="text-xs text-slate-500 mt-3">
        💡 全 17 サイズ・複数スタイル並列が必要なら右の{' '}
        <span className="text-teal-300">Pro プラン</span>
      </p>
    </div>
  );
}
