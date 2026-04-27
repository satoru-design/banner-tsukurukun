'use client';

/**
 * Phase A.11.3: /account 訪問時に session と DB の乖離を自動修正する。
 *
 * 背景: ヘッダーは JWT キャッシュ（useSession）を読むため、外部から DB を直接更新した場合
 * （例: 運営によるプラン変更、Stripe webhook 経由のアップグレード等）にヘッダーが古い値を
 * 表示し続ける。Phase A.12 までこの状態だと UX が悪い。
 *
 * 解決: /account は Server Component で常に DB から fresh データを取得しているので、
 * その値を Client 側に渡し、session との差分があれば update() で merge する。
 * client-side merge のためネットワーク往復ゼロ、Header の useSession() が自動で再評価される。
 */
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface Props {
  freshUser: CurrentUser;
}

export function SessionSyncer({ freshUser }: Props) {
  const { data: session, update } = useSession();

  useEffect(() => {
    if (!session?.user || !freshUser.userId) return;

    const u = session.user;
    const freshPlanStartedAt = freshUser.planStartedAt?.toISOString() ?? null;
    const freshPlanExpiresAt = freshUser.planExpiresAt?.toISOString() ?? null;
    const freshUsageResetAt = freshUser.usageResetAt?.toISOString() ?? null;

    const stale =
      u.plan !== freshUser.plan ||
      u.nameOverride !== freshUser.nameOverride ||
      u.usageCount !== freshUser.usageCount ||
      u.planStartedAt !== freshPlanStartedAt ||
      u.planExpiresAt !== freshPlanExpiresAt ||
      u.usageResetAt !== freshUsageResetAt;

    if (stale) {
      void update({
        plan: freshUser.plan,
        nameOverride: freshUser.nameOverride,
        planStartedAt: freshPlanStartedAt,
        planExpiresAt: freshPlanExpiresAt,
        usageCount: freshUser.usageCount,
        usageResetAt: freshUsageResetAt,
      });
    }
  }, [session, freshUser, update]);

  return null;
}
