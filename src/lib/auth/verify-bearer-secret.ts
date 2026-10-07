/**
 * 共有シークレットの Bearer 認証ヘルパー（fail-closed）。
 *
 * これまで各 route は次の書き方をしていた。
 *   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return 401;
 *
 * この形は env が未設定のとき期待値が文字列 "Bearer undefined" になり、
 * `Authorization: Bearer undefined` を送れば誰でも通過してしまう。
 * 本ヘルパーは env が未設定・空文字の場合は必ず false を返す。
 * 比較も長さ一致時のみ定数時間で行う。
 */

/**
 * これ未満の長さはログに警告を出す（拒否はしない）。
 * 既存デプロイの値を突然 401 にしないため、長さは運用上の警告に留める。
 */
const WEAK_SECRET_LENGTH = 16;

/** 未設定・空文字なら必ず false。設定済なら短さを警告しつつ通す。 */
function readSecret(envName: string): string | null {
  const expected = process.env[envName];
  if (!expected) {
    console.error(`[verify-bearer-secret] ${envName} is not configured; denying request`);
    return null;
  }
  if (expected.length < WEAK_SECRET_LENGTH) {
    console.warn(
      `[verify-bearer-secret] ${envName} is shorter than ${WEAK_SECRET_LENGTH} chars; rotate it to a longer random value`,
    );
  }
  return expected;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * `Authorization: Bearer <secret>` を検証する。
 *
 * @param req 受信リクエスト
 * @param envName 期待値を保持する環境変数名（ログ用にも使う）
 * @returns 検証に成功したときだけ true
 */
export function verifyBearerSecret(req: Request, envName: string): boolean {
  const expected = readSecret(envName);
  if (!expected) return false;
  const got = req.headers.get('authorization');
  if (!got) return false;
  return constantTimeEquals(got, `Bearer ${expected}`);
}

/** Vercel Cron 用の糖衣。 */
export function verifyCronSecret(req: Request): boolean {
  return verifyBearerSecret(req, 'CRON_SECRET');
}

/**
 * 共有シークレットを定数時間で突き合わせる（Bearer ヘッダー以外の経路用）。
 * env 未設定時は false。
 */
export function verifySharedSecret(
  candidate: string | null | undefined,
  envName: string,
): boolean {
  const expected = readSecret(envName);
  if (!expected) return false;
  if (!candidate) return false;
  return constantTimeEquals(candidate, expected);
}
