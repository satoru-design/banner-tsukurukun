/**
 * AdLoop AdAccount 冪等 seed。slug で upsert。
 * 実行: node scripts/seed-accounts.mjs                      (dev = .env DATABASE_URL)
 *       本番: DATABASE_URL=$PROD_DATABASE_URL node scripts/seed-accounts.mjs
 * token/webhook は env(ACCOUNT_<SLUG>_*) に別途設定（このスクリプトでは扱わない）。
 * metaAdAccountId は実値に差し替えてから実行すること。
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const ACCOUNTS = [
  { slug: 'five-point-detox', name: '5 Point Detox', metaAdAccountId: 'REPLACE_ME' },
  { slug: 'kokoromil', name: 'ココロミル', metaAdAccountId: 'REPLACE_ME' },
  // 自社を入れる場合: { slug: 'autobanner', name: 'AutoBanner', metaAdAccountId: '1664983991362612' },
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL required');
  process.exit(1);
}
// 安全ガード: プレースホルダのまま実行してゴミ account を seed するのを防ぐ
const unresolved = ACCOUNTS.filter((a) => a.metaAdAccountId === 'REPLACE_ME').map((a) => a.slug);
if (unresolved.length > 0) {
  console.error(`metaAdAccountId が REPLACE_ME のままです: ${unresolved.join(', ')}。実値に差し替えてから実行してください。`);
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

for (const a of ACCOUNTS) {
  const r = await prisma.adAccount.upsert({
    where: { slug: a.slug },
    create: a,
    update: { name: a.name, metaAdAccountId: a.metaAdAccountId },
  });
  console.log(`upserted: ${r.slug} (${r.id})`);
}
await prisma.$disconnect();
