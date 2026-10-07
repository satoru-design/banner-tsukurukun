/**
 * 500 系レスポンスの共通化。
 *
 * これまで多くの route が `error.message` をそのままクライアントに返していた。
 * Prisma の例外メッセージはテーブル名・カラム名・制約名を含み、
 * 外部 SDK の例外は内部 URL やリクエスト ID を含むため、
 * 攻撃者に DB スキーマと依存構成の地図を渡すことになる。
 *
 * 詳細はサーバーログにだけ残し、クライアントには固定文言を返す。
 */
import { NextResponse } from 'next/server';

/**
 * 例外をログに出し、内部情報を含まない 500 を返す。
 *
 * @param scope ログ検索用のタグ（例: 'generate-image'）
 * @param error 捕捉した例外
 * @param clientMessage クライアントに見せる文言
 */
export function internalErrorResponse(
  scope: string,
  error: unknown,
  clientMessage = 'サーバー内部エラーが発生しました',
): NextResponse {
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: clientMessage }, { status: 500 });
}
