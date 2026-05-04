import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { getPrisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import { sendMetaCompleteRegistrationEvent } from '@/lib/billing/meta-capi';

const prisma = getPrisma();

/**
 * Phase A.10: NextAuth.js v5 完全 config。
 * Prisma adapter で User/Account を DB 自動管理。
 *
 * - session strategy: 'jwt' (Edge runtime middleware で req.auth を読むために必須)
 *   database strategy だと middleware から DB アクセス不可で req.auth=null となる既知問題。
 * - signIn 時に User row 自動作成 (adapter が処理)
 * - admin email を自動的に plan='admin' に昇格 (events.signIn フック)
 * - JWT に id/email/plan を載せて、middleware と server-side で参照可能に
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    /**
     * 初回 signIn 時 (user 引数あり) と、以降の trigger='update' 時に
     * JWT トークンに id/plan を書き込む。
     * 普通のリクエストでは token がそのまま返るので、毎回 DB 参照しない。
     */
    async jwt({ token, user, trigger }) {
      // 初回 signIn 時: user オブジェクトから id を取得 + admin 判定
      if (user) {
        token.id = user.id;
        // ADMIN_EMAILS のメアドなら token.plan='admin' を即時反映
        // (events.signIn の DB 更新と並行して JWT にも書く)
        const adminEmails = (process.env.ADMIN_EMAILS ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const isAdmin = !!user.email && adminEmails.includes(user.email);
        token.plan = isAdmin ? 'admin' : ((user as { plan?: string }).plan ?? 'free');
        // Phase A.11.0: 新フィールドも JWT に載せる
        const u = user as {
          nameOverride?: string | null;
          planStartedAt?: Date | null;
          planExpiresAt?: Date | null;
          usageCount?: number;
          usageResetAt?: Date | null;
        };
        token.nameOverride = u.nameOverride ?? null;
        token.planStartedAt = u.planStartedAt ? u.planStartedAt.toISOString() : null;
        token.planExpiresAt = u.planExpiresAt ? u.planExpiresAt.toISOString() : null;
        token.usageCount = u.usageCount ?? 0;
        token.usageResetAt = u.usageResetAt ? u.usageResetAt.toISOString() : null;
      } else if (trigger === 'update' && token.email) {
        // 明示的 update（プラン変更直後など）の時だけ DB から再取得
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
        });
        if (dbUser) {
          token.plan = dbUser.plan;
          // Phase A.11.0: 新フィールドも DB から再取得
          token.nameOverride = dbUser.nameOverride;
          token.planStartedAt = dbUser.planStartedAt ? dbUser.planStartedAt.toISOString() : null;
          token.planExpiresAt = dbUser.planExpiresAt ? dbUser.planExpiresAt.toISOString() : null;
          token.usageCount = dbUser.usageCount;
          token.usageResetAt = dbUser.usageResetAt ? dbUser.usageResetAt.toISOString() : null;
        }
      }
      return token;
    },
    /**
     * セッション読み取り時に JWT トークンの id/plan を session.user に注入。
     * これにより `getCurrentUser()` から id/plan が見える。
     * Phase A.11.0: nameOverride / planDates / usage も注入。
     */
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) ?? '';
        session.user.plan = (token.plan as string) ?? 'free';
        // Phase A.11.0: 新フィールドも session.user に注入
        session.user.nameOverride = (token.nameOverride as string | null) ?? null;
        session.user.planStartedAt = (token.planStartedAt as string | null) ?? null;
        session.user.planExpiresAt = (token.planExpiresAt as string | null) ?? null;
        session.user.usageCount = (token.usageCount as number) ?? 0;
        session.user.usageResetAt = (token.usageResetAt as string | null) ?? null;
      }
      return session;
    },
  },
  events: {
    /**
     * 初回サインイン時 (User row 作成直後) に admin 自動昇格。
     * ADMIN_EMAILS env のリストに該当するメアドを admin に。
     *
     * Phase A.16: 初回サインイン (isNewUser=true) のみ Meta CAPI に
     * CompleteRegistration イベント送信。広告最適化シグナル蓄積用。
     */
    async signIn({ user, isNewUser }) {
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

      // Phase A.16: 新規ユーザーのみ CompleteRegistration を CAPI で送信
      // admin もテスト時に発火するが、event_id で dedup されるので問題なし
      // fire-and-forget（CAPI 失敗で signIn を止めない）
      if (isNewUser) {
        sendMetaCompleteRegistrationEvent({
          email: user.email,
          externalId: user.id ?? undefined,
          eventId: `cr_${user.id ?? user.email}_${Date.now()}`,
        }).catch((e) => {
          console.error('[auth] CompleteRegistration CAPI failed (non-fatal):', e);
        });
      }
    },
  },
});
