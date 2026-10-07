'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
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

/** 保存されている dismiss 時刻。触れない環境では null。 */
function readDismissedAt(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * 同月内に閉じた記録があるか。useSyncExternalStore の getSnapshot。
 * localStorage はサーバーに無いので、render 中に直接読む代わりにここで読む。
 */
function getDismissedThisMonth(): boolean {
  const raw = readDismissedAt();
  if (!raw) return false;
  return isSameMonth(new Date(raw), new Date());
}

/** サーバー描画とハイドレーション中は未 dismiss として扱う。従来と同じ見え方。 */
function getDismissedOnServer(): boolean {
  return false;
}

/**
 * 購読先は無い。この値が変わるのは同じタブで「今月は表示しない」を
 * 押した時だけで、それはコンポーネント側のローカル state で扱う。
 */
function subscribeDismissed(): () => void {
  return () => {};
}

/** 月が替わって無効になった記録を捨てる。state は触らない。 */
function pruneStaleDismissedAt(): void {
  const raw = readDismissedAt();
  if (!raw) return;
  if (isSameMonth(new Date(raw), new Date())) return;
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // 触れない環境では掃除をあきらめる。判定は getSnapshot 側で行う。
  }
}

/**
 * Phase A.17.0 Y: 1 セッション内で Pro 100 枚を使い切った時に出る inline 通知
 *
 * - localStorage で同月内 dismissed なら非表示
 * - クリックで /account#plan へ遷移（BusinessPlanCard へ）
 */
export function UpgradeToBusinessBanner({ isPro, proLimitReachedInSession, totalUsageCount = 0 }: Props) {
  // 同月内 dismissed の判定は useSyncExternalStore 経由。useEffect の中で
  // setState する実装から移した。読む条件は従来と同じ。
  const dismissedThisMonth = useSyncExternalStore(
    subscribeDismissed,
    getDismissedThisMonth,
    getDismissedOnServer,
  );
  // このセッションで「今月は表示しない」を押したか。
  const [dismissedNow, setDismissedNow] = useState(false);

  // 月が替わった古い記録の掃除。従来は判定と同じ effect で行っていた副作用。
  useEffect(() => {
    pruneStaleDismissedAt();
  }, []);

  if (!isPro || !proLimitReachedInSession || dismissedThisMonth || dismissedNow) return null;

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
    setDismissedNow(true);
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
