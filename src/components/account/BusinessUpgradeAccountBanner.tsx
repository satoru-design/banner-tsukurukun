'use client';

import { useState } from 'react';
import { getOverageRate } from '@/lib/plans/overage-rates';
import { USAGE_LIMIT_BUSINESS } from '@/lib/plans/limits';

interface MetricSnapshot {
  avgOveragePerMonth?: number;
  invoiceCount?: number;
  totalMeteredJpy?: number;
  threshold?: number;
}

interface Props {
  /** UpgradeNotice の最新 1 件（なければ表示しない） */
  notice: {
    id: string;
    metricSnapshot: MetricSnapshot;
    createdAt: Date;
  } | null;
  /** User.upgradeNoticeShownAt（最後に dismiss した時刻） */
  upgradeNoticeShownAt: Date | null;
}

const SUPPRESSION_DAYS = 60;

/**
 * Phase A.17.0 X: 月次 Cron 検知に基づく Business 推奨バナー
 *
 * 表示条件:
 *   - notice が存在
 *   - upgradeNoticeShownAt が null OR 60日以上前
 */
export function BusinessUpgradeAccountBanner({ notice, upgradeNoticeShownAt }: Props) {
  const [hidden, setHidden] = useState(false);

  if (!notice) return null;
  if (hidden) return null;
  if (upgradeNoticeShownAt) {
    const daysSince = (Date.now() - upgradeNoticeShownAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < SUPPRESSION_DAYS) return null;
  }

  const avgOverage = notice.metricSnapshot.avgOveragePerMonth ?? 0;
  const invoiceCount = notice.metricSnapshot.invoiceCount ?? 0;
  const businessRate = getOverageRate('business');
  // Business なら ¥40/枚（Pro の半額）
  const overageQuantity = avgOverage > 0 ? Math.round(avgOverage / 80) : 0; // Pro 単価 ¥80 で逆算
  const businessExtra = overageQuantity * businessRate;
  // Pro maxed (base ¥14,800 + 平均超過 avgOverage) vs Business (base ¥39,800 + overageQuantity × ¥40)
  const monthlyDiff = (14800 + avgOverage) - (39800 + businessExtra);

  const handleDismiss = async () => {
    setHidden(true);
    await fetch('/api/account/dismiss-upgrade-notice', { method: 'POST' });
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📊</span>
        <div className="flex-1">
          <h4 className="font-semibold text-amber-300 mb-1">
            あなたは Business プラン向きかもしれません。
          </h4>
          <p className="text-sm text-slate-300 mb-2">
            過去 {invoiceCount} ヶ月の Pro メータード超過: 平均
            <strong className="text-amber-300 mx-1">¥{avgOverage.toLocaleString()}/月</strong>
            。Business（{USAGE_LIMIT_BUSINESS.toLocaleString()} 枚 + ¥{businessRate}/枚）に変更すると
            {monthlyDiff > 0 ? (
              <span> 月 <strong className="text-emerald-400">¥{monthlyDiff.toLocaleString()} お得</strong> になる試算です。</span>
            ) : (
              <span> 同程度のコストで上限が大幅に拡張されます。</span>
            )}
          </p>
          <div className="flex gap-2">
            <a
              href="#plan"
              className="inline-block px-3 py-1.5 text-sm font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
            >
              Business を確認
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
