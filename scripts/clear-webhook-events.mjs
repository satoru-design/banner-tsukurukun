/**
 * Webhook idempotency 記録を削除して Stripe Dashboard からの再送を有効にする一時スクリプト。
 *
 * 用途:
 *   - plan-sync 等のバグ修正後、既処理の Stripe イベントを再処理させたい時
 *   - WebhookEvent テーブルに残った行があると同じ event.id は idempotent: true でスキップされるため
 *
 * 使い方:
 *   node --env-file=.env scripts/clear-webhook-events.mjs evt_xxx evt_yyy ...
 *
 * 削除後、Stripe Dashboard → Webhooks → 該当イベント → 「再送する」で再処理。
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('Usage: node --env-file=.env scripts/clear-webhook-events.mjs evt_xxx [evt_yyy ...]');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const result = await prisma.webhookEvent.deleteMany({ where: { id: { in: ids } } });
console.log(`Deleted ${result.count} of ${ids.length} WebhookEvent records`);
console.log('You can now resend these events from Stripe Dashboard:');
for (const id of ids) console.log(`  - ${id}`);
await prisma.$disconnect();
