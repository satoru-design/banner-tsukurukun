import { getCurrentUser } from '@/lib/auth/get-current-user';

/**
 * Session ベースの管理者判定。
 * getCurrentUser().plan === 'admin' のとき true を返す。
 * 未ログイン（userId === null）や plan が他値のときは false。
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !user.userId) return false;
  return user.plan === 'admin';
}
