import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  '/signin',
  '/lp01',  // Phase A.15: 機能訴求 LP（公開）
  '/lp02',  // Phase A.15: 時短訴求 LP（公開）
  '/lp03',
  '/contact',  // Phase A.15: Plan C 個別商談 問合せページ
  '/api/billing/webhook',  // Phase A.12: Stripe からの POST。署名検証で正当性を担保するため auth 不要。
  '/api/admin/kpi',  // Phase A.17.0: GAS から呼ばれる KPI 集計 API。Bearer ADMIN_KPI_SECRET で認証。
  '/api/cron/check-business-upgrade',  // Phase A.17.0: Vercel Cron。Bearer CRON_SECRET で認証。
  '/api/cron/process-video-jobs',  // Phase B.1: Vercel Cron。Bearer CRON_SECRET で認証。
];

const PUBLIC_PATH_PREFIXES = [
  '/api/auth',  // NextAuth エンドポイント
  '/_next',
  '/legal',  // Phase A.15: 特商法 / 利用規約 / プライバシーポリシー
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

  // 未ログイン
  if (!req.auth) {
    // /api/* は HTML redirect ではなく JSON 401 を返す。
    // (HTTP redirect → /signin の gzip HTML を fetch().json() がパースして
    //  binary 文字化けエラーになるのを防ぐ)
    if (pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: 'ログインの有効期限が切れました。再ログインしてください。', code: 'SESSION_EXPIRED' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    // それ以外（ページ）は /signin にリダイレクト（callbackUrl で元の path を保持）
    const signInUrl = new URL('/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return Response.redirect(signInUrl);
  }

  // ログイン済 → そのまま通す
  return;
});

export const config = {
  // 静的アセット（画像・動画・フォント等）は middleware を通さない。
  // 通すと public/ 内のファイル（OGP 画像 / バナー）が認証必須になり、
  // SNS シェアの crawler や未ログインの新規訪問者から見えなくなる。
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|avif|mp4|webm|ogg|m4a|woff2?|ttf|otf|css|js|map|txt|xml|json)).*)',
  ],
};
