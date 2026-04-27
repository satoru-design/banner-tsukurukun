import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Phase A.10: session.user に id と plan を追加。
   * Phase A.11.0: nameOverride / planStartedAt / planExpiresAt / usageCount / usageResetAt 追加。
   * Date は serializable でないため、JWT/session 上では ISO string で保持。
   *
   * NOTE: NextAuth の DefaultSession.user は User 型を参照するため、User と Session.user で
   * 同名フィールドの型が異なると intersection 衝突する。User の augmentation は行わず、
   * Session.user を独立した型で override する（Omit で DefaultSession の user フィールドから
   * 名前/メール/画像のみ継承し、Date 系は持ち込まない）。
   */
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      plan: string;
      nameOverride: string | null;
      planStartedAt: string | null;
      planExpiresAt: string | null;
      usageCount: number;
      usageResetAt: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    plan?: string;
    nameOverride?: string | null;
    planStartedAt?: string | null;
    planExpiresAt?: string | null;
    usageCount?: number;
    usageResetAt?: string | null;
  }
}

// DefaultSession の参照を残すための no-op（unused 警告を抑える）
export type _KeepDefaultSession = DefaultSession;
