/**
 * Phase 1 (現在): 単一テナント運用。固定値 (userId=null) を返すスタブ。
 * Phase 2 (SaaS化時): NextAuth/Clerk 等から実ユーザーを取得する実装に差し替え。
 *
 * このモジュールを経由することで、SaaS化時に
 * 全 API ルートを書き換えなくて済むようにする。
 */
export interface CurrentUser {
  /** Phase 1 は常に null。Phase 2 で実 userId が入る。 */
  userId: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return { userId: null };
}
