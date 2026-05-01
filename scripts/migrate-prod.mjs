/**
 * Phase A.15 リスク監査: dev/prod DB 分離後のマイグレーション本番適用ヘルパー
 *
 * 通常のフロー:
 *   1. ローカル: prisma migrate dev --name xxx → dev branch に適用
 *   2. 動作確認
 *   3. 本番 push 直前 OR 直後に: node scripts/migrate-prod.mjs → production branch に適用
 *
 * 必要 env:
 *   - PROD_DATABASE_URL: 本番 production branch の接続文字列
 *
 * .env に PROD_DATABASE_URL を入れてあれば --env-file=.env でロード可能。
 */
import { spawnSync } from 'node:child_process';

const prodUrl = process.env.PROD_DATABASE_URL;
if (!prodUrl) {
  console.error('PROD_DATABASE_URL env is required.');
  console.error('Set it in .env or pass via env: PROD_DATABASE_URL="..." node scripts/migrate-prod.mjs');
  process.exit(1);
}

console.log('Applying pending migrations to PRODUCTION branch...');
console.log(`Endpoint: ${prodUrl.match(/ep-[a-z0-9-]+/)?.[0] ?? 'unknown'}\n`);

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: prodUrl },
  shell: true, // Windows: npx is .cmd, requires shell
});

if (result.status !== 0) {
  console.error('\nMigration failed.');
  process.exit(result.status ?? 1);
}
console.log('\nProduction migration complete.');
