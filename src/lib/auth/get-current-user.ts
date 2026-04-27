import { auth } from './auth';
import { sessionToCurrentUser } from './session-to-current-user';

/**
 * Phase A.10: NextAuth.js v5 セッションから現在のユーザーを取得（Server 用）。
 * Phase A.11.0: 拡張フィールド（displayName / planDates / usage）追加。
 *
 * Server Components / Route Handlers / Server Actions から呼ぶ。
 * derive ロジックは sessionToCurrentUser に集約（Client 側 Header でも同じ変換を使う）。
 */
export interface CurrentUser {
  /** ログイン済の Prisma User.id。未ログイン時は null。 */
  userId: string | null;
  /** ログイン済の email。未ログイン時は null。 */
  email: string | null;
  /** 'free' | 'starter' | 'pro' | 'admin' */
  plan: string;
  /** 表示名（nameOverride ?? name ?? "ユーザー"） */
  displayName: string;
  /** Google アバター URL */
  image: string | null;
  /** 現在プラン開始日 */
  planStartedAt: Date | null;
  /** 有料プラン期限（free/admin は null） */
  planExpiresAt: Date | null;
  /** 当月使用回数 */
  usageCount: number;
  /** プランから導出される月次上限（admin は Infinity） */
  usageLimit: number;
  /** 次回リセット日時 */
  usageResetAt: Date | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  return sessionToCurrentUser(session);
}
