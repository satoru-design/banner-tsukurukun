'use client';

import type { CurrentUser } from '@/lib/auth/get-current-user';
import { CheckoutButton } from './CheckoutButton';
import { DowngradeButton } from './DowngradeButton';
import { USAGE_LIMIT_PRO, USAGE_HARDCAP_PRO } from '@/lib/plans/limits';
import { getOverageRate } from '@/lib/plans/overage-rates';

interface Props {
  user: CurrentUser;
}

/**
 * Phase A.17.0: /account 常設の Pro プラン切替カード
 *
 * BusinessPlanCard と並列で表示することで、ユーザーが
 * 「Business しか選択肢がない」と誤認するのを防ぐ。
 *
 * - free / starter / business / admin: Pro CTA を表示
 *   - business: Pro → ダウングレード（期末切替）
 *   - admin: 「Pro を試す（admin プレビュー）」
 * - pro: 「現在のプラン」表示 + CTA なし
 */
export function ProPlanCard({ user }: Props) {
  const proBasePriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE;
  if (!proBasePriceId) return null;

  const isPro = user.plan === 'pro';
  const overageRate = getOverageRate('pro');

  // 状態別 CTA / アクション
  const renderAction = () => {
    if (isPro) return null; // 現在のプラン → ボタンなし
    if (user.plan === 'business') {
      return <DowngradeButton targetPlan="pro" label="Pro にダウングレード（期末切替）" />;
    }
    const ctaLabel =
      user.plan === 'admin' ? 'Pro を試す（admin プレビュー）' : 'Pro を試す';
    return (
      <CheckoutButton
        basePriceId={proBasePriceId}
        label={ctaLabel}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded font-bold disabled:opacity-50"
      />
    );
  };

  return (
    <div className="rounded-lg border border-teal-700/40 bg-gradient-to-br from-teal-950/40 to-slate-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-teal-300">
            💼 Pro プラン
            {isPro && (
              <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-teal-500 text-white">
                現在のプラン
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">マーケター・運用担当・小規模チーム向け</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">¥14,800</div>
          <div className="text-xs text-slate-500">/ 月（税込）</div>
        </div>
      </div>

      <ul className="text-sm text-slate-300 space-y-1 mb-4">
        <li>✅ {USAGE_LIMIT_PRO.toLocaleString()} 枠 / 月</li>
        <li>✅ 超過分は ¥{overageRate}/枠</li>
        <li>✅ 上限 {USAGE_HARDCAP_PRO.toLocaleString()} 枠まで利用可能</li>
        <li>✅ 全 17 サイズ・複数スタイル並列生成</li>
        <li className="text-slate-500 text-xs pt-1">
          🎁 勝ちバナー添付無制限・プロンプト閲覧（Pro 標準特典）
        </li>
      </ul>

      {renderAction()}

      <p className="text-xs text-slate-500 mt-3">
        💡 月 100 枠を超える運用なら右の{' '}
        <span className="text-emerald-300">Business プラン</span> がお得
      </p>
    </div>
  );
}
