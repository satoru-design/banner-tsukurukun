import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge runtime 互換 (DB 操作を含まない) NextAuth.js v5 config。
 * middleware と auth.ts の両方が import する。
 *
 * Phase A.10:
 * - Google OAuth Provider のみ
 * - signIn callback でホワイトリスト判定（ALLOWED_EMAILS）
 * - DB 操作（User upsert / plan 付与）は auth.ts 側の Prisma adapter に任せる
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    /**
     * ALLOWED_EMAILS 環境変数によるホワイトリスト制御。
     * 空文字 or 未設定 → 全公開（Phase A.15 で空にして公開）
     * カンマ区切り → リスト内のメアドのみログイン可
     */
    async signIn({ user }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // ALLOWED_EMAILS 空 → 全員許可（A.15 公開時の状態）
      if (allowed.length === 0) return true;

      // メアドがリストに含まれていれば許可
      if (user.email && allowed.includes(user.email)) return true;

      // それ以外は拒否
      return false;
    },
    /**
     * ルート保護用の authorized callback。middleware から呼ばれる。
     * auth(=session) があるかどうかだけ判定。詳細な path 別ルールは
     * middleware.ts 側で行う。
     */
    async authorized({ auth }) {
      return !!auth;
    },
  },
};
