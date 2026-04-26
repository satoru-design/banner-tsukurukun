import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { getPrisma } from '@/lib/prisma';
import { authConfig } from './auth.config';

const prisma = getPrisma();

/**
 * Phase A.10: NextAuth.js v5 完全 config。
 * Prisma adapter で User/Account/Session を DB 自動管理。
 * - session strategy: 'database' (Prisma adapter 使用時の標準)
 * - signIn 時に User row 自動作成 (adapter が処理)
 * - admin email を自動的に plan='admin' に昇格 (events.signIn フック)
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  callbacks: {
    ...authConfig.callbacks,
    /**
     * セッション読み取り時に User.plan を session.user.plan に注入。
     * これにより `getCurrentUser()` から plan が見えるようになる。
     */
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        // user は Prisma User row なので plan を直接読める
        // （TypeScript 型の都合で any キャスト）
        session.user.plan = (user as { plan?: string }).plan ?? 'free';
      }
      return session;
    },
  },
  events: {
    /**
     * 初回サインイン時 (User row 作成直後) に admin 自動昇格。
     * ADMIN_EMAILS env のリストに該当するメアドを admin に。
     */
    async signIn({ user }) {
      if (!user.email) return;
      const adminEmails = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (adminEmails.includes(user.email)) {
        // 既存 user でも plan が admin でなければ昇格
        await prisma.user.update({
          where: { email: user.email },
          data: { plan: 'admin' },
        });
      }
    },
  },
});
