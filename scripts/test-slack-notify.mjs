/**
 * Slack 新規ユーザー通知の動作確認スクリプト。
 * 実 webhook に「これはテストです」メッセージを送る。
 *
 * 使い方:
 *   node scripts/test-slack-notify.mjs
 */
import 'dotenv/config';

const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
if (!webhook) {
  console.error('[ERROR] SLACK_WEBHOOK_URL_NEW_USER 未設定');
  process.exit(1);
}

const ts = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const text = [
  ':test_tube: *autobanner.jp テスト通知*',
  'これは新規ユーザー通知の疎通確認です。本番では Google ログイン直後に同形式のメッセージが届きます。',
  `送信時刻: ${ts} JST`,
].join('\n');

const res = await fetch(webhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});

console.log(`status: ${res.status}`);
console.log(`body:   ${await res.text()}`);
