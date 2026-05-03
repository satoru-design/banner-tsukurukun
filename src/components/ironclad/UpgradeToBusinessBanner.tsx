'use client';

import { useState, useEffect } from 'react';
import { USAGE_LIMIT_PRO } from '@/lib/plans/limits';
import { getOverageRate } from '@/lib/plans/overage-rates';

interface Props {
  /** 現在 Pro plan か（free/starter/admin/business では出さない） */
  isPro: boolean;
  /** このセッションで Pro 100 枚を使い切ったか */
  proLimitReachedInSession: boolean;
  /** 月初からの累計生成数（usageCount + sessionGenerated） */
  totalUsageCount?: number;
}

const DISMISS_KEY = 'businessUpgradeBannerDismissedAt';

/**
 * Phase A.17.0 Y: 1 セッション内で Pro 100 枚を使い切った時に出る inline 通知
 *
 * - localStorage で同月内 dismissed なら非表示
 * - クリックで /account#plan へ遷移（BusinessPlanCard へ）
 */
export function UpgradeToBusinessBanner({ isPro, proLimitReachedInSession, totalUsageCount = 0 }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const date = new Date(dismissedAt);
      const now = new Date();
      // 同月内なら非表示維持
      if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
        setDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, []);

  if (!isPro || !proLimitReachedInSession || dismissed) return null;

  const proRate = getOverageRate('pro');
  const businessRate = getOverageRate('business');
  const overage = Math.max(0, totalUsageCount - USAGE_LIMIT_PRO);
  const proExtraCost = overage * proRate;
  const businessExtraCost = overage * businessRate;
  // Pro maxed (¥14,800 + overage × ¥80) vs Business (¥39,800 + overage × ¥40)
  // ¥39,800 - ¥14,800 = ¥25,000 の固定費差を吸収するのに overage × ¥40 が必要
  const monthlyDiff = (14800 + proExtraCost) - (39800 + businessExtraCost);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setDismissed(true);
  };

  return (
    <div className="rounded-lg border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 to-slate-900 p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🚀</span>
        <div className="flex-1">
          <h4 className="font-semibold text-emerald-300 mb-1">
            このセッションで Pro {USAGE_LIMIT_PRO} 枚を使い切りました
          </h4>
          <p className="text-sm text-slate-300">
            この調子で運用すると、Business プラン（月 ¥39,800 / 1,000 枚 / 超過 ¥{businessRate}）の方が
            {monthlyDiff > 0 ? (
              <> 今月 <strong className="text-emerald-300">¥{monthlyDiff.toLocaleString()} お得</strong>になる試算です。</>
            ) : (
              <> 1,000 枚まで上限が大幅に拡張されます。</>
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href="/account#plan"
              className="inline-block px-4 py-2 text-sm font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Business を見る
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              今月は表示しない
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
