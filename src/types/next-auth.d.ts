import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Phase A.10: session.user に id と plan を追加。
   * Phase A.11.0: nameOverride / planStartedAt / planExpiresAt / usageCount / usageResetAt 追加。
   * (Date は serializable でないため、JWT/session 上では ISO string で保持)
   */
  interface Session {
    user: {
      id: string;
      plan: string;
      nameOverride: string | null;
      planStartedAt: string | null;
      planExpiresAt: string | null;
      usageCount: number;
      usageResetAt: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    plan?: string;
    nameOverride?: string | null;
    planStartedAt?: Date | null;
    planExpiresAt?: Date | null;
    usageCount?: number;
    usageResetAt?: Date | null;
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
