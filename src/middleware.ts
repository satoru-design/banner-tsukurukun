import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  '/signin',
  '/lp01',  // Phase A.15: 機能訴求 LP（公開）
  '/lp01-legacy',  // Phase A.16: lp01 A/B B バリアント（公開）
  '/lp02',  // Phase A.15: 時短訴求 LP（公開）
  '/lp03',
  '/contact',  // Phase A.15: Plan C 個別商談 問合せページ
  '/api/billing/webhook',  // Phase A.12: Stripe からの POST。署名検証で正当性を担保するため auth 不要。
  '/api/admin/kpi',  // Phase A.17.0: GAS から呼ばれる KPI 集計 API。Bearer ADMIN_KPI_SECRET で認証。
  '/api/admin/batch-generate',  // Phase 2: meta-ads-autopilot からの Bearer API Key 認証エンドポイント
  '/api/admin/batch-reject',    // Phase 4: 拒否理由を受け取って次回 prompt に注入する用
  '/api/cron/check-business-upgrade',  // Phase A.17.0: Vercel Cron。Bearer CRON_SECRET で認証。
  '/api/cron/process-video-jobs',  // Phase B.1: Vercel Cron。Bearer CRON_SECRET で認証。
];

const PUBLIC_PATH_PREFIXES = [
  '/api/auth',  // NextAuth エンドポイント
  '/_next',
  '/legal',  // Phase A.15: 特商法 / 利用規約 / プライバシーポリシー
  '/site',  // LP Maker Pro 2.0 D10-T14: 公開 LP（/site/[user]/[slug]）。認証なしで閲覧可。
];

const AB_LP01_COOKIE = 'ab_lp01';
const AB_LP01_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type Variant = 'a' | 'b';

/**
 * Phase A.17: lp01 の振り分け
 *
 * 新デザイン (V2) を全面ロールアウト。
 * - `?v=a` or `?v=b` クエリで強制（保守確認用）
 * - cookie `ab_lp01` が **b** の場合のみ尊重（旧版を継続して見たいユーザー）
 * - それ以外（cookie なし / cookie=a / 不正値）はすべて variant=a (V2) を返す
 * - variant=b は `/lp01-legacy` に rewrite
 *
 * 戻り値: rewrite/passthrough のレスポンス（cookie を再確定する）
 */
function handleLp01Ab(req: NextRequest): NextResponse {
  const url = req.nextUrl;
  const forced = url.searchParams.get('v');
  const cookieVal = req.cookies.get(AB_LP01_COOKIE)?.value;

  let variant: Variant;
  if (forced === 'a' || forced === 'b') {
    variant = forced;
  } else if (cookieVal === 'b') {
    // 明示的に旧版を選んでいたユーザーには b を継続提供
    variant = 'b';
  } else {
    // 新規 / cookie=a / 不正値はすべて V2
    variant = 'a';
  }

  const targetPath = variant === 'b' ? '/lp01-legacy' : '/lp01';
  const incomingPath = url.pathname;

  let response: NextResponse;
  if (incomingPath !== targetPath) {
    const target = new URL(targetPath, req.url);
    url.searchParams.forEach((value, key) => {
      if (key !== 'v') target.searchParams.set(key, value);
    });
    response = NextResponse.rewrite(target);
  } else {
    response = NextResponse.next();
  }

  response.cookies.set(AB_LP01_COOKIE, variant, {
    maxAge: AB_LP01_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  });
  response.headers.set('x-ab-lp01', variant);
  return response;
}

/**
 * Phase A.10: NextAuth.js v5 ベース認証 middleware。
 * Phase A.16: lp01 A/B 振り分けロジックを追加。
 *
 * - /signin, /lp** はログイン不要
 * - /lp01 と /lp01-legacy には A/B 振り分けを適用（cookie 30 日固定）
 * - /api/auth/** は NextAuth 自身のエンドポイントなので素通し
 * - それ以外は session 必須、未ログインなら /signin へリダイレクト
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // A/B: lp01 系列はここで振り分け（PUBLIC_PATHS 判定より前に処理）
  if (pathname === '/lp01' || pathname === '/lp01-legacy') {
    return handleLp01Ab(req);
  }

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
