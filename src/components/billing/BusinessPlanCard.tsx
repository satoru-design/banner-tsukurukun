'use client';

import type { CurrentUser } from '@/lib/auth/get-current-user';
import { CheckoutButton } from './CheckoutButton';
import { USAGE_LIMIT_BUSINESS, USAGE_HARDCAP_BUSINESS } from '@/lib/plans/limits';
import { getOverageRate } from '@/lib/plans/overage-rates';

interface Props {
  user: CurrentUser;
}

/**
 * Phase A.17.0 W (baseline): /account 常設の Business プラン切替カード
 *
 * - free / starter / pro / admin: Business アップグレード CTA を表示
 *   （admin は事業計画 v2 §5.1 に従い顧客と同じ目線で確認可能にする）
 * - business: 「現在のプラン」表示（CTA なし、ダウングレードは隣の ProPlanCard で行う）
 */
export function BusinessPlanCard({ user }: Props) {
  const businessBasePriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE;
  if (!businessBasePriceId) return null;

  const isBusiness = user.plan === 'business';
  const overageRate = getOverageRate('business');

  const ctaLabel = (() => {
    if (isBusiness) return null;
    if (user.plan === 'pro') return 'Business にアップグレード';
    if (user.plan === 'admin') return 'Business を試す（admin プレビュー）';
    return 'Business で始める';
  })();

  return (
    <div className="rounded-lg border border-emerald-700/40 bg-gradient-to-br from-emerald-950/40 to-slate-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-emerald-300">
            🚀 Business プラン
            {isBusiness && (
              <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-emerald-500 text-white">
                現在のプラン
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">広告代理店・中堅 EC 運用部隊向け</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">¥39,800</div>
          <div className="text-xs text-slate-500">/ 月（税込）</div>
        </div>
      </div>

      <ul className="text-sm text-slate-300 space-y-1 mb-4">
        <li>✅ {USAGE_LIMIT_BUSINESS.toLocaleString()} 枠 / 月（Pro の 10 倍）</li>
        <li>✅ 超過分は ¥{overageRate}/枠（Pro の半額）</li>
        <li>✅ 上限 {USAGE_HARDCAP_BUSINESS.toLocaleString()} 枠まで利用可能</li>
        <li>✅ 全 17 サイズ・複数スタイル並列生成</li>
        <li className="text-slate-500 text-xs pt-1">
          🔜 クライアント別フォルダ / 拡張 Brand Kit / 一括 ZIP DL は順次提供
        </li>
      </ul>

      {!isBusiness && ctaLabel && (
        <CheckoutButton
          basePriceId={businessBasePriceId}
          label={ctaLabel}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded font-bold disabled:opacity-50"
        />
      )}

      <p className="text-xs text-slate-500 mt-3">
        💡 より大規模・年契約・SLA をご希望なら{' '}
        <a href="/lp01#contact" className="underline hover:text-slate-300">
          Plan C のお問い合わせへ
        </a>
      </p>
    </div>
  );
}
