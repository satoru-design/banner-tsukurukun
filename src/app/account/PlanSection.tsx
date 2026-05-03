'use client';

/**
 * Phase A.11.2 / A.17.0: プラン情報セクション。
 * - 現在のプラン Pill / 利用開始日 / 終了予定日 / 当月使用状況
 * - Phase A.17.0: 汎用「アップグレード / ダウングレード」ボタンと UpgradeModal を撤去。
 *   各プランカード（Starter / Pro / Business）が自分の遷移操作を所有する責任分離設計に変更。
 *
 * id="plan" のアンカー対応（ヘッダードロップダウンの「プラン変更」リンクから来る）。
 */
import { PlanPill } from '@/components/layout/PlanPill';
import { PortalButton } from '@/components/billing/PortalButton';
import { ProOverageDisplay } from '@/components/account/ProOverageDisplay';
import { StarterPlanCard } from '@/components/billing/StarterPlanCard';
import { ProPlanCard } from '@/components/billing/ProPlanCard';
import { BusinessPlanCard } from '@/components/billing/BusinessPlanCard';
import { BusinessUpgradeAccountBanner } from '@/components/account/BusinessUpgradeAccountBanner';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface PlanSectionProps {
  user: CurrentUser;
  upgradeNotice?: {
    id: string;
    metricSnapshot: Record<string, unknown>;
    createdAt: Date;
  } | null;
  upgradeNoticeShownAt?: Date | null;
}

function formatDate(d: Date | null): string {
  if (!d) return '-';
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function PlanSection({ user, upgradeNotice, upgradeNoticeShownAt }: PlanSectionProps) {
  const isUnlimited = !Number.isFinite(user.usageLimit);
  const ratio = isUnlimited
    ? 0
    : Math.min(1, user.usageCount / Math.max(1, user.usageLimit));
  const percent = Math.round(ratio * 100);

  // 80% 超で amber, 100% で red
  const barColor =
    ratio >= 1
      ? 'bg-red-500'
      : ratio >= 0.8
        ? 'bg-amber-500'
        : 'bg-teal-500';

  const hasSubscription =
    user.plan === 'starter' || user.plan === 'pro' || user.plan === 'business';

  return (
    <section id="plan" className="scroll-mt-20">
      <h2 className="text-lg font-semibold border-b border-slate-800 pb-2 mb-4">
        プラン
      </h2>

      <div className="space-y-4">
        {/* 現在のプラン */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 w-32">現在のプラン</span>
          <PlanPill plan={user.plan} size="sm" />
        </div>

        {/* 利用開始日 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 w-32">利用開始日</span>
          <span className="text-slate-200">{formatDate(user.planStartedAt)}</span>
        </div>

        {/* プラン終了日（解約予約 / プラン切替予約時のみ表示） */}
        {user.planExpiresAt && (
          <div className="flex items-start gap-3">
            <span className="text-sm text-slate-400 w-32">プラン終了予定</span>
            <div className="text-slate-200">
              <div>{formatDate(user.planExpiresAt)}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                この日まで {user.plan.toUpperCase()} を利用可。以降は予約内容に従い切替されます。
              </div>
            </div>
          </div>
        )}

        {/* 今月の使用状況 */}
        <div>
          <div className="text-sm text-slate-400 mb-2">今月の使用状況</div>
          {isUnlimited ? (
            <div className="text-slate-200">
              <span className="font-semibold">{user.usageCount}</span> 回（無制限プラン）
            </div>
          ) : (
            <>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${barColor}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="text-sm text-slate-300 mt-2">
                {user.usageCount} / {user.usageLimit} 回
              </div>
              {user.usageResetAt && (
                <div className="text-xs text-slate-500 mt-1">
                  リセット日: {formatDate(user.usageResetAt)}
                </div>
              )}
              {/* Phase A.14: Pro 上限超過分の追加課金額を表示 */}
              <ProOverageDisplay plan={user.plan} usageCount={user.usageCount} />
            </>
          )}
        </div>

        {/* お支払い情報管理（有料プランのみ） */}
        {hasSubscription && (
          <div className="pt-1">
            <PortalButton />
          </div>
        )}

        {/* Phase A.17.0 X: 月次 Cron 検知のバナー（Pro のみ） */}
        {user.plan === 'pro' && (
          <BusinessUpgradeAccountBanner
            notice={
              upgradeNotice
                ? {
                    id: upgradeNotice.id,
                    metricSnapshot: upgradeNotice.metricSnapshot,
                    createdAt: upgradeNotice.createdAt,
                  }
                : null
            }
            upgradeNoticeShownAt={upgradeNoticeShownAt ?? null}
          />
        )}

        {/* Phase A.17.0 W: Starter / Pro / Business プラン切替カード（常設・3 列横並び） */}
        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StarterPlanCard user={user} />
          <ProPlanCard user={user} />
          <BusinessPlanCard user={user} />
        </div>
      </div>
    </section>
  );
}
