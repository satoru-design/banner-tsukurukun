/**
 * Google 認証して登録した User 一覧を出力する。
 *
 * 使い方:
 *   node scripts/list-users.mjs            # dev DB (DATABASE_URL)
 *   node scripts/list-users.mjs --prod     # 本番 DB (PROD_DATABASE_URL)
 *   node scripts/list-users.mjs --json     # 機械可読 JSON 出力
 *   node scripts/list-users.mjs --prod --json
 *   node scripts/list-users.mjs --prod --slack  # Slack に同チャンネル投稿（要 SLACK_WEBHOOK_URL_NEW_USER）
 *
 * 出力:
 *   1. 直近登録順のユーザー一覧（email, name, plan, createdAt, usage, provider）
 *   2. plan 別カウント
 *   3. 直近 24h / 7d / 30d の新規登録数
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const args = new Set(process.argv.slice(2));
const useProd = args.has('--prod');
const asJson = args.has('--json');
const toSlack = args.has('--slack');

const connectionString = useProd
  ? process.env.PROD_DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    `[ERROR] ${useProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} が未設定です。.env を確認してください。`,
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const now = new Date();
const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

const users = await prisma.user.findMany({
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    email: true,
    name: true,
    nameOverride: true,
    plan: true,
    createdAt: true,
    usageCount: true,
    usageResetAt: true,
    stripeCustomerId: true,
    stripeSubscriptionId: true,
    paymentFailedAt: true,
    accounts: {
      select: { provider: true },
    },
    _count: {
      select: { generations: true },
    },
  },
});

if (asJson) {
  console.log(JSON.stringify({ env: useProd ? 'prod' : 'dev', count: users.length, users }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '-');
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s ?? '');

console.log('');
console.log(`=== User 一覧 (${useProd ? 'PROD' : 'DEV'} DB) — 計 ${users.length} 名 ===`);
console.log('');
console.log(
  [
    'createdAt'.padEnd(17),
    'email'.padEnd(34),
    'name'.padEnd(14),
    'plan'.padEnd(8),
    'gen'.padStart(4),
    'use'.padStart(4),
    'stripe'.padEnd(7),
    'provider',
  ].join(' | '),
);
console.log('-'.repeat(110));

for (const u of users) {
  const providers = u.accounts.map((a) => a.provider).join(',') || '-';
  const stripeFlag = u.stripeSubscriptionId ? 'sub' : u.stripeCustomerId ? 'cus' : '-';
  const displayName = u.nameOverride || u.name || '';
  console.log(
    [
      fmtDate(u.createdAt).padEnd(17),
      truncate(u.email, 34).padEnd(34),
      truncate(displayName, 14).padEnd(14),
      u.plan.padEnd(8),
      String(u._count.generations).padStart(4),
      String(u.usageCount).padStart(4),
      stripeFlag.padEnd(7),
      providers,
    ].join(' | '),
  );
}

const planCounts = users.reduce((acc, u) => {
  acc[u.plan] = (acc[u.plan] ?? 0) + 1;
  return acc;
}, {});

const cnt24h = users.filter((u) => u.createdAt >= ago24h).length;
const cnt7d = users.filter((u) => u.createdAt >= ago7d).length;
const cnt30d = users.filter((u) => u.createdAt >= ago30d).length;
const withGoogle = users.filter((u) => u.accounts.some((a) => a.provider === 'google')).length;
const withGen = users.filter((u) => u._count.generations > 0).length;
const paidUsers = users.filter((u) => u.plan === 'starter' || u.plan === 'pro').length;
const paymentFailed = users.filter((u) => u.paymentFailedAt).length;

console.log('');
console.log('=== Plan 別 ===');
for (const [plan, n] of Object.entries(planCounts).sort()) {
  console.log(`  ${plan.padEnd(10)} ${n}`);
}

console.log('');
console.log('=== Summary ===');
console.log(`  Google 連携あり:   ${withGoogle} / ${users.length}`);
console.log(`  生成実績あり:       ${withGen} / ${users.length}`);
console.log(`  有料 (starter/pro): ${paidUsers}`);
console.log(`  支払い失敗中:       ${paymentFailed}`);
console.log(`  直近 24h 登録:     ${cnt24h}`);
console.log(`  直近 7d 登録:      ${cnt7d}`);
console.log(`  直近 30d 登録:     ${cnt30d}`);
console.log('');

if (toSlack) {
  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (!webhook) {
    console.error('[ERROR] --slack 指定だが SLACK_WEBHOOK_URL_NEW_USER 未設定');
    await prisma.$disconnect();
    process.exit(1);
  }

  const planEmoji = (p) =>
    p === 'admin' ? ':crown:' : p === 'business' ? ':office:' : p === 'pro' ? ':star:' : p === 'starter' ? ':seedling:' : ':bust_in_silhouette:';
  const lines = users.map((u) => {
    const dn = (u.nameOverride || u.name || '').trim() || '(no name)';
    return `• ${planEmoji(u.plan)} \`${u.email}\` — ${dn} _(${u.plan}, ${fmtDate(u.createdAt)})_`;
  });

  const planSummary = Object.entries(planCounts)
    .sort()
    .map(([p, n]) => `${p}=${n}`)
    .join(' / ');

  const text = [
    `:clipboard: *autobanner.jp 登録ユーザー一覧* (${useProd ? 'PROD' : 'DEV'} DB)`,
    `計 *${users.length} 名* — ${planSummary}`,
    `直近 24h: ${cnt24h} / 7d: ${cnt7d} / 30d: ${cnt30d}`,
    '',
    ...lines,
  ].join('\n');

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  console.log(`Slack post: status=${res.status} body=${await res.text()}`);
}

await prisma.$disconnect();
