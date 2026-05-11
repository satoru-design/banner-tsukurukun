/**
 * Phase 2: /api/admin/batch-generate の Bearer Token 認証ヘルパー。
 *
 * meta-ads-autopilot からの外部呼び出し用。`Authorization: Bearer ${META_AUTOPILOT_API_KEY}` を期待。
 * 検証失敗時は理由を返さず統一的に false を返す（情報漏洩防止）。
 */
export function verifyBatchGenerateAuth(req: Request): boolean {
  const expected = process.env.META_AUTOPILOT_API_KEY;
  if (!expected || expected.length < 32) {
    console.error('[batch-generate/auth] META_AUTOPILOT_API_KEY is not configured or too short');
    return false;
  }
  const got = req.headers.get('authorization');
  if (!got) return false;
  const expectedHeader = `Bearer ${expected}`;
  // タイミング攻撃対策: 長さが違うなら即 false（早期 return しても OK・キーは公開済の長さ）
  if (got.length !== expectedHeader.length) return false;
  // 定数時間比較
  let mismatch = 0;
  for (let i = 0; i < got.length; i++) {
    mismatch |= got.charCodeAt(i) ^ expectedHeader.charCodeAt(i);
  }
  return mismatch === 0;
}
