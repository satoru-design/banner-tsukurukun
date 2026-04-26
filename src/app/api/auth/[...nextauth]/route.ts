/**
 * NextAuth.js v5 API ハンドラ。
 * handlers から GET/POST を分割代入。
 * /api/auth/signin, /api/auth/callback/google, /api/auth/session 等を提供。
 */
import { handlers } from '@/lib/auth/auth';

export const { GET, POST } = handlers;
