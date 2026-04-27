'use client';

/**
 * Phase A.11.3: ヘッダー右側、PlanPill 隣に表示する使用状況コンポーネント。
 *
 * - useSession() で session を読み、sessionToCurrentUser で CurrentUser に変換
 * - admin / 無制限プランは表示なし（PlanPill だけで十分）
 * - 80%超で amber、100%で red の文字色変化（マイページのバーと色味統一）
 * - tabular-nums でカウントアップ時の見た目ガタつき防止
 */
import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';

export function UsageDisplay() {
  const { data: session } = useSession();
  const user = sessionToCurrentUser(session);

  // 未ログイン: 表示なし
  if (!user.userId) return null;

  // admin / 無制限: 表示なし
  if (!Number.isFinite(user.usageLimit)) return null;

  const ratio = user.usageCount / user.usageLimit;
  const percent = Math.round(ratio * 100);

  // 80%超で amber, 100%で red
  const colorClass =
    ratio >= 1
      ? 'text-red-400'
      : ratio >= 0.8
        ? 'text-amber-400'
        : 'text-slate-300';

  return (
    <span
      className={`text-xs ${colorClass} tabular-nums`}
      aria-label={`今月の使用状況: ${user.usageCount} 回 / ${user.usageLimit} 回 (${percent}%)`}
    >
      {user.usageCount}/{user.usageLimit} [{percent}%]
    </span>
  );
}
