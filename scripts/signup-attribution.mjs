/**
 * 登録者の流入チャネル（first touch attribution）を集計して表示する。
 *
 * 使い方:
 *   node scripts/signup-attribution.mjs --prod            # 本番 DB
 *   node scripts/signup-attribution.mjs --prod --days 30  # 直近 30 日だけ
 *   node scripts/signup-attribution.mjs --prod --json
 *
 * 前提: migration 20260918053000_add_signup_attribution が適用済であること。
 * 計測開始より前に登録したユーザーは signupChannel=NULL（= 計測なし）で出る。
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const argv = process.argv.slice(2);
const args = new Set(argv);
const useProd = args.has('--prod');
const asJson = args.has('--json');
const daysIdx = argv.indexOf('--days');
const days = daysIdx >= 0 ? Number(argv[daysIdx + 1]) : null;

const connectionString = useProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!connectionString) {
  console.error(`[ERROR] ${useProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} が未設定です。`);
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const where = days && Number.isFinite(days)
  ? { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
  : {};

const users = await prisma.user.findMany({
  where,
  orderBy: { createdAt: 'desc' },
  select: {
    email: true,
    name: true,
    plan: true,
    createdAt: true,
    signupChannel: true,
    signupAttribution: true,
  },
});

const LABEL = {
  paid_google: 'Google 広告',
  paid_meta: 'Meta 広告',
  paid_other: '広告 (その他)',
  organic_search: '自然検索',
  social: 'SNS',
  email: 'メール',
  referral: '他サイト経由',
  direct: '直接/不明',
};

const counts = new Map();
for (const u of users) {
  const key = u.signupChannel ?? '(計測なし)';
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

if (asJson) {
  console.log(JSON.stringify({ total: users.length, counts: Object.fromEntries(counts), users }, null, 2));
} else {
  const scope = days ? `直近 ${days} 日` : '全期間';
  console.log(`\n■ 登録者の流入チャネル (${scope} / ${useProd ? '本番' : 'dev'} DB)  合計 ${users.length} 人\n`);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key, n] of sorted) {
    const label = LABEL[key] ?? key;
    console.log(`  ${String(n).padStart(4)} 人  ${label}`);
  }

  const measured = users.filter((u) => u.signupChannel);
  if (measured.length > 0) {
    console.log('\n■ 計測できている登録者（新しい順・最大 30 件）\n');
    for (const u of measured.slice(0, 30)) {
      const a = u.signupAttribution ?? {};
      const detail = [a.ref && `ref=${a.ref}`, a.src && `utm_source=${a.src}`, a.cmp && `utm_campaign=${a.cmp}`]
        .filter(Boolean)
        .join(' / ');
      const ts = u.createdAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      console.log(`  ${ts}  ${(LABEL[u.signupChannel] ?? u.signupChannel).padEnd(12)}  ${u.email}`);
      console.log(`      着地=${a.lp ?? '?'}${detail ? `  ${detail}` : ''}`);
    }
  }
  console.log('');
}

await prisma.$disconnect();
