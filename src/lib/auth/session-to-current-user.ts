import type { Session } from 'next-auth';
import type { CurrentUser } from './get-current-user';
import { getUsageLimit } from '@/lib/plans/limits';

/**
 * Phase A.11.0: NextAuth Session を CurrentUser に変換するヘルパー。
 * Server side: getCurrentUser() で auth() の結果を渡す。
 * Client side（A.11.1 Header 等）: useSession() の data を渡す。
 *
 * 両方で同じ derive ロジックを使うことで、Header を Client/Server 両用に統一できる。
 */
export function sessionToCurrentUser(session: Session | null): CurrentUser {
  if (!session?.user?.id) {
    return {
      userId: null,
      email: null,
      plan: 'free',
      displayName: 'ゲスト',
      nameOverride: null,
      image: null,
      planStartedAt: null,
      planExpiresAt: null,
      usageCount: 0,
      usageLimit: getUsageLimit('free'),
      usageResetAt: null,
    };
  }
  const u = session.user;
  const plan = u.plan ?? 'free';
  return {
    userId: u.id,
    email: u.email ?? null,
    plan,
    displayName: u.nameOverride ?? u.name ?? 'ユーザー',
    nameOverride: u.nameOverride ?? null,
    image: u.image ?? null,
    planStartedAt: u.planStartedAt ? new Date(u.planStartedAt) : null,
    planExpiresAt: u.planExpiresAt ? new Date(u.planExpiresAt) : null,
    usageCount: u.usageCount ?? 0,
    usageLimit: getUsageLimit(plan),
    usageResetAt: u.usageResetAt ? new Date(u.usageResetAt) : null,
  };
}
