/**
 * 新規ユーザー登録時に Slack に通知する。
 *
 * env: SLACK_WEBHOOK_URL_NEW_USER (Incoming Webhook URL, Sensitive)
 *   未設定なら no-op（ローカル開発時に誤って本番通知が飛ぶのを防ぐ）。
 *
 * 呼び出し元:
 *   - src/lib/auth/auth.ts events.signIn の isNewUser ブロック
 *   - 既存の Meta CAPI と同じく await で完了を待つ
 *     (Vercel serverless が response 直後に terminate するため fire-and-forget は不可)
 */
export async function notifyNewUserToSlack(args: {
  email: string;
  name?: string | null;
  provider?: string; // 'google' 想定
  isAdminEmail?: boolean;
}): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (!webhook) {
    console.log('[slack/notify-new-user] SLACK_WEBHOOK_URL_NEW_USER 未設定のためスキップ');
    return;
  }

  const tag = args.isAdminEmail ? ':crown: admin' : ':bust_in_silhouette: 新規';
  const provider = args.provider ?? 'google';
  const displayName = args.name?.trim() || '(no name)';
  const ts = new Date().toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const text = [
    `${tag} 登録: *${displayName}*`,
    `email: \`${args.email}\``,
    `provider: \`${provider}\` / ${ts} JST`,
    `<https://autobanner.jp|autobanner.jp>`,
  ].join('\n');

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(
        `[slack/notify-new-user] Slack webhook 失敗 status=${res.status} body=${await res.text().catch(() => '')}`,
      );
    }
  } catch (e) {
    console.error('[slack/notify-new-user] Slack webhook 例外:', e);
  }
}
