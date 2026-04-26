import { auth } from './auth';

/**
 * Phase A.10: NextAuth.js v5 セッションから現在のユーザーを取得。
 * Server Components / Route Handlers / Server Actions から呼ぶ。
 *
 * 未ログイン時は userId=null, plan='free' を返す。
 * middleware で /signin に飛ばされるため、認証必須 path では実質ログイン済み。
 *
 * Phase A.11+ で plan ベースの機能 gate に使用。
 */
export interface CurrentUser {
  /** ログイン済の Prisma User.id。未ログイン時は null。 */
  userId: string | null;
  /** ログイン済の email。未ログイン時は null。 */
  email: string | null;
  /** Phase A.10: 'free' | 'starter' | 'pro' | 'admin' */
  plan: string;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    return { userId: null, email: null, plan: 'free' };
  }
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    plan: session.user.plan ?? 'free',
  };
}
