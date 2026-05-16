'use client';

/**
 * D12 Task 19: dashboard 上部の利用状況ヘッダー。
 *
 * - 現在のプラン badge を色分け表示
 * - 今月の利用本数 / soft limit を表示
 * - soft limit 超過時は Free/Starter にアップグレード CTA、Pro はメータード課金注記
 * - hard cap の 80% に近づいたら警告を表示
 */
import { useState } from 'react';
import { UpgradeLpModal } from './UpgradeLpModal';

interface Props {
  plan: 'free' | 'starter' | 'pro' | 'admin';
  currentUsage: number;
  softLimit: number;
  hardCap: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  admin: 'Admin',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-slate-700 text-slate-300',
  starter: 'bg-blue-500 text-slate-950',
  pro: 'bg-emerald-500 text-slate-950',
  admin: 'bg-purple-500 text-slate-50',
};

export function UsageHeader({ plan, currentUsage, softLimit, hardCap }: Props) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const isOverSoft = currentUsage >= softLimit;
  const isNearHard = currentUsage >= hardCap * 0.8;

  return (
    <>
      <div className="flex items-center justify-between bg-slate-900 rounded-lg p-4 mb-6 border border-slate-800">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-1 rounded ${PLAN_COLORS[plan]}`}>
            {PLAN_LABELS[plan]}
          </span>
          <span className="text-sm text-slate-300">
            今月{' '}
            <strong className={isOverSoft ? 'text-amber-400' : 'text-emerald-400'}>
              {currentUsage}
            </strong>
            <span className="text-slate-500"> / {softLimit} 本</span>
            {isOverSoft && plan === 'pro' && (
              <span className="text-xs text-amber-400 ml-2">
                （超過分は ¥980/本 メータード）
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isNearHard && plan !== 'admin' && plan !== 'pro' && (
            <span className="text-xs text-red-400">
              上限 {hardCap} 本に近づいています
            </span>
          )}
          {(plan === 'free' || plan === 'starter') && isOverSoft && (
            <button
              type="button"
              onClick={() => setShowUpgrade(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded text-sm"
            >
              アップグレード
            </button>
          )}
        </div>
      </div>
      {showUpgrade && (
        <UpgradeLpModal currentPlan={plan} onClose={() => setShowUpgrade(false)} />
      )}
    </>
  );
}
