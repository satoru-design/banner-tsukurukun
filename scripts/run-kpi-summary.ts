/**
 * Daily / Weekly / Monthly KPI 通知の ad-hoc 手動発火スクリプト。
 *
 * 使い方（tsx 経由）:
 *   npx tsx scripts/run-kpi-summary.ts --daily
 *   npx tsx scripts/run-kpi-summary.ts --weekly
 *   npx tsx scripts/run-kpi-summary.ts --monthly
 *   npx tsx scripts/run-kpi-summary.ts --daily --prod  # 本番 DB に対して実行
 *
 * 注意:
 *   - --prod 指定時は PROD_DATABASE_URL を DATABASE_URL に上書きしてから lib をロードする
 *   - SLACK_WEBHOOK_URL_NEW_USER が .env になければ通知はスキップされる（dry-run）
 */
import 'dotenv/config';

const args = new Set(process.argv.slice(2));
const useProd = args.has('--prod');
const kind = args.has('--daily')
  ? 'daily'
  : args.has('--weekly')
  ? 'weekly'
  : args.has('--monthly')
  ? 'monthly'
  : null;

if (!kind) {
  console.error('Usage: npx tsx scripts/run-kpi-summary.ts --daily|--weekly|--monthly [--prod]');
  process.exit(1);
}

if (useProd) {
  if (!process.env.PROD_DATABASE_URL) {
    console.error('[ERROR] PROD_DATABASE_URL 未設定');
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
  console.log('[run-kpi-summary] PROD DB に接続して実行');
} else {
  console.log('[run-kpi-summary] DEV DB に接続して実行');
}

async function main() {
  // env 上書き後に動的 import（getPrisma が起動時に env を読むため）
  const { sendDailyKpi, sendWeeklyKpi, sendMonthlyKpi } = await import('../src/lib/slack/kpi-summary');

  console.log(`[run-kpi-summary] kind=${kind} 開始`);
  const fn = kind === 'daily' ? sendDailyKpi : kind === 'weekly' ? sendWeeklyKpi : sendMonthlyKpi;
  const result = await fn();
  console.log(`[run-kpi-summary] 完了:`, result);
}

main().catch((e) => {
  console.error('[run-kpi-summary] 失敗:', e);
  process.exit(1);
});
