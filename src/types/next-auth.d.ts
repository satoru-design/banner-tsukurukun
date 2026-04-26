import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Phase A.10: session.user に id と plan を追加。
   * NextAuth v5 のデフォルトには id がないので明示的に拡張する。
   */
  interface Session {
    user: {
      id: string;
      plan: string;
    } & DefaultSession['user'];
  }

  interface User {
    plan?: string;
  }
}
