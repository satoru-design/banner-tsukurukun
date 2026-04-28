import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  '/signin',
  '/lp01',  // Phase A.15 で実装する LP（予約）
  '/lp02',
  '/lp03',
  '/api/billing/webhook',  // Phase A.12: Stripe からの POST。署名検証で正当性を担保するため auth 不要。
];

const PUBLIC_PATH_PREFIXES = [
  '/api/auth',  // NextAuth エンドポイント
  '/_next',
];

/**
 * Phase A.10: NextAuth.js v5 ベース認証 middleware。
 * 既存 Basic Auth は完全廃止。
 *
 * - /signin, /lp** はログイン不要
 * - /api/auth/** は NextAuth 自身のエンドポイントなので素通し
 * - それ以外は session 必須、未ログインなら /signin へリダイレクト
 *
 * ALLOWED_EMAILS のホワイトリスト判定は auth.config.ts の signIn callback 側。
 * ここでは単純に「セッションがあるかないか」のみチェック。
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // 完全一致 public パス
  if (PUBLIC_PATHS.includes(pathname)) {
    return;
  }

  // プレフィックス public パス
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return;
  }

  // 未ログイン → /signin にリダイレクト（callbackUrl で元の path を保持）
  if (!req.auth) {
    const signInUrl = new URL('/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return Response.redirect(signInUrl);
  }

  // ログイン済 → そのまま通す
  return;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
