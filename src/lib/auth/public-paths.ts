/**
 * middleware が認証なしで通すパスの定義。
 *
 * middleware.ts に直接書いていたものをここに出した。理由は 2 つある。
 *  1. `vercel.json` の cron と突き合わせる回帰テストを書けるようにする。
 *     以前は cron を 4 本だけ個別列挙していたため、`vercel.json` 側に
 *     cron を追加しても middleware に足し忘れ、15 本中 12 本が 401 で
 *     黙って死んでいた。
 *  2. 「ここに載せる = 認証を route 側に委ねる」という判断を 1 箇所に集める。
 *
 * ここに載せたパスは middleware でセッション検査をしない。
 * 必ず route 側に署名検証か Bearer / token 検証があることを確認してから追加する。
 */

/** 完全一致で公開するパス。 */
export const PUBLIC_PATHS = [
  '/signin',
  '/price',  // 公開料金表ページ（Pay.jp 審査・新規訪問者向け／認証不要）
  '/lp01',  // Phase A.15: 機能訴求 LP（公開）
  '/lp01-legacy',  // Phase A.16: lp01 A/B B バリアント（公開）
  '/lp02',  // Phase A.15: 時短訴求 LP（公開）
  '/lp03',
  '/contact',  // Phase A.15: Plan C 個別商談 問合せページ
  // 決済プロバイダからの webhook。いずれも外部から Cookie 無しで POST されるため
  // middleware を通さないと 401 で落ち、課金イベントが届かずプラン状態がずれる。
  // 正当性は各 route の署名 / トークン検証が担保する。
  '/api/billing/webhook',  // Phase A.12: Stripe。constructEvent で署名検証。
  '/api/billing/payjp/webhook',  // 移管 P3: Pay.jp。token 検証 + events.retrieve で再取得。
  '/api/billing/stores/webhook',  // STORES (Coiney)。route 側で token を定数時間比較。
  '/api/admin/kpi',  // Phase A.17.0: GAS から呼ばれる KPI 集計 API。Bearer ADMIN_KPI_SECRET で認証。
  '/api/admin/batch-generate',  // Phase 2: meta-ads-autopilot からの Bearer API Key 認証エンドポイント
  '/api/admin/batch-reject',    // Phase 4: 拒否理由を受け取って次回 prompt に注入する用
  '/api/admin/meta-ad-link',    // C1: meta-ads-autopilot が ad_id↔生成画像 を登録。route 側で verifyBatchGenerateAuth (Bearer) 済
] as const;

/** 前方一致で公開するパス。 */
export const PUBLIC_PATH_PREFIXES = [
  '/api/auth',  // NextAuth エンドポイント
  '/_next',
  '/legal',  // Phase A.15: 特商法 / 利用規約 / プライバシーポリシー
  '/site',  // LP Maker Pro 2.0 D10-T14: 公開 LP（/site/[user]/[slug]）。認証なしで閲覧可。
  // Vercel Cron はセッション Cookie を送らないため、ここを通さないと
  // middleware が 401 を返して route に到達しない（= cron が黙って死ぬ）。
  // cron を追加したときに足し忘れが起きないよう prefix で通す。
  // 認証は各 route の verifyCronSecret (Bearer CRON_SECRET) が担保する。
  // 未設定なら必ず拒否する fail-closed 実装なので、ここを公開しても素通りしない。
  '/api/cron',
] as const;

/** middleware がセッション検査をせずに通すパスかどうか。 */
export function isPublicPath(pathname: string): boolean {
  if ((PUBLIC_PATHS as readonly string[]).includes(pathname)) return true;
  return (PUBLIC_PATH_PREFIXES as readonly string[]).some((p) => pathname.startsWith(p));
}
