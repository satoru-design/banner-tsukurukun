'use client';

/**
 * Phase A.11.1: 共有 Header（Client Component）。
 * useSession() で session を読み、sessionToCurrentUser で CurrentUser に変換。
 * SessionProvider が layout.tsx で SSR session を渡しているため、初回レンダリングからフラッシュなし。
 *
 * 構造:
 * - 左: ロゴ（Link で / に戻る）
 * - 中央: rightSlot（page 固有 UI、StepIndicator 等）
 * - 右: PlanPill + UserMenu
 *
 * sticky top-0 で常時表示、z-40（モーダル < 50 より下）。
 */
import { ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { PlanPill } from './PlanPill';
import { UsageDisplay } from './UsageDisplay';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  /** ヘッダー中央に差し込むスロット（StepIndicator 等のページ固有 UI） */
  rightSlot?: ReactNode;
}

export function Header({ rightSlot }: HeaderProps) {
  const { data: session } = useSession();
  const user = sessionToCurrentUser(session);

  return (
    <header className="border-b border-slate-800 px-6 py-4 sticky top-0 bg-neutral-950 z-40">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight whitespace-nowrap"
        >
          <span className="text-teal-400">勝ちバナー</span>作る君
        </Link>

        <div className="flex-1 flex justify-center min-w-0">{rightSlot}</div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <PlanPill plan={user.plan} />
            <UsageDisplay />
          </div>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
