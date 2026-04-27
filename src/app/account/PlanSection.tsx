'use client';

/**
 * Phase A.11.2: プラン情報セクション。
 * - 現在のプラン Pill
 * - 利用開始日 / 次回更新日（有料時のみ）
 * - 今月の使用状況プログレスバー
 * - アップグレード/ダウングレードボタン → UpgradeModal
 *
 * id="plan" のアンカー対応（ヘッダードロップダウンの「プラン変更」リンクから来る）。
 */
import { useState } from 'react';
import { PlanPill } from '@/components/layout/PlanPill';
import { UpgradeModal } from './UpgradeModal';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface PlanSectionProps {
  user: CurrentUser;
}

function formatDate(d: Date | null): string {
  if (!d) return '-';
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function PlanSection({ user }: PlanSectionProps) {
  const [modalType, setModalType] = useState<'upgrade' | 'downgrade' | null>(null);

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

  return (
    <section id="plan">
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

        {/* 次回更新日（有料時のみ表示） */}
        {user.planExpiresAt && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 w-32">次回更新日</span>
            <span className="text-slate-200">{formatDate(user.planExpiresAt)}</span>
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
            </>
          )}
        </div>

        {/* アップグレード/ダウングレードボタン */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setModalType('upgrade')}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded transition"
          >
            アップグレード
          </button>
          <button
            type="button"
            onClick={() => setModalType('downgrade')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded transition"
          >
            ダウングレード
          </button>
        </div>
      </div>

      {modalType && (
        <UpgradeModal
          type={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </section>
  );
}
