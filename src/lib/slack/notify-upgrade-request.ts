/**
 * アップグレード申請時に Slack に通知する（手動 STORES 請求書フロー）。
 *
 * STORES請求書決済には API が無いため、ユーザーがアップグレードを押した時点では
 * 請求書を自動発行できない。代わりにこの通知で管理者に申請を伝え、管理者が
 * STORES で請求書を発行し、入金確認後に /admin/billing でプランを付与する。
 *
 * env: SLACK_WEBHOOK_URL_NEW_USER (Incoming Webhook URL, Sensitive)
 *   未設定なら no-op（ローカル開発時に誤って本番通知が飛ぶのを防ぐ）。
 *
 * fire-and-forget: 呼び出し元は失敗してもリクエストを 500 にしない。
 */
export async function notifyUpgradeRequest(args: { email: string; plan: string }): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (!webhook) return;
  const text = `🆙 アップグレード申請: ${args.email} → ${args.plan}\nSTORESで請求書を発行し、入金確認後に /admin/billing でプランを付与してください。`;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
