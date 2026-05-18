/**
 * リテンション対象ユーザー (D+1 / D+3 / D+7) を Slack に通知する。
 *
 * 使い方:
 *   node scripts/notify-retention-targets.mjs            # dev DB / Slack なし
 *   node scripts/notify-retention-targets.mjs --prod     # 本番 DB / Slack 通知あり
 *   node scripts/notify-retention-targets.mjs --prod --dry-run  # Slack 送信せず標準出力のみ
 *
 * ロジック:
 *   - D+1: 24h 前に登録、まだ Paid じゃない、まだ「初回完成バナーをダウンロードしてない」フォロー
 *   - D+3: 72h 前に登録、まだ Paid じゃない、「他のサイズ・パターンを試す」促進
 *   - D+7: 168h 前に登録、まだ Paid じゃない、「Pro 提案 (Free 上限到達近い場合)」
 *
 * Slack 通知先: SLACK_WEBHOOK_URL_NEW_USER (新規登録通知と同チャンネル)
 *
 * 想定実行: Vercel Cron で毎日 9:00 JST に発火
 *   （現状は手動 or scripts/run-kpi-summary.ts 同様の cron で）
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const args = new Set(process.argv.slice(2));
const useProd = args.has('--prod');
const dryRun = args.has('--dry-run');

const connectionString = useProd
  ? process.env.PROD_DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    `[ERROR] ${useProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} 未設定。`,
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL_NEW_USER ?? '';

const HOURS = 60 * 60 * 1000;

function hoursAgoRange(hoursAgoStart, hoursAgoEnd) {
  // [now - hoursAgoEnd, now - hoursAgoStart) の範囲を返す
  // 例: hoursAgoRange(24, 48) = "24-48h 前に登録" = D+1 のユーザー
  const now = Date.now();
  return {
    gte: new Date(now - hoursAgoEnd * HOURS),
    lt: new Date(now - hoursAgoStart * HOURS),
  };
}

async function findTargets(label, hoursStart, hoursEnd) {
  const where = {
    createdAt: hoursAgoRange(hoursStart, hoursEnd),
    plan: { in: ['free'] }, // 既に有料の人は除外
  };
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      currentMonthUsageCount: true,
      _count: { select: { generations: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return { label, users };
}

function fmtUserLine(u) {
  const gen = u._count?.generations ?? 0;
  const use = u.currentMonthUsageCount ?? 0;
  return `• \`${u.email}\` (${u.name ?? '-'}) — 累計生成 ${gen} / 今月使用 ${use}`;
}

async function sendToSlack(blocks) {
  if (!SLACK_WEBHOOK) {
    console.log('[INFO] SLACK_WEBHOOK_URL_NEW_USER 未設定。送信スキップ。');
    return;
  }
  if (dryRun) {
    console.log('[DRY-RUN] Slack 送信スキップ');
    return;
  }
  const res = await fetch(SLACK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    console.error('[ERROR] Slack 送信失敗:', res.status, await res.text());
  } else {
    console.log('[INFO] Slack 送信成功');
  }
}

const main = async () => {
  const [d1, d3, d7] = await Promise.all([
    findTargets('D+1', 24, 48),
    findTargets('D+3', 72, 96),
    findTargets('D+7', 168, 192),
  ]);

  console.log('\n=== リテンション対象ユーザー (Free のみ) ===\n');
  for (const group of [d1, d3, d7]) {
    console.log(`【${group.label}】 ${group.users.length} 名`);
    for (const u of group.users) {
      console.log(`  ${fmtUserLine(u)}`);
    }
    console.log('');
  }

  // Slack 送信内容
  const totalCount = d1.users.length + d3.users.length + d7.users.length;
  if (totalCount === 0) {
    console.log('[INFO] 対象ユーザーなし。Slack 送信スキップ。');
    await prisma.$disconnect();
    return;
  }

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🔁 本日のリテンション対象', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Free プランで残っている登録ユーザーへフォローメール・声がけ候補です（合計 *${totalCount} 名*）。`,
      },
    },
  ];

  for (const group of [d1, d3, d7]) {
    if (group.users.length === 0) continue;
    blocks.push({ type: 'divider' });
    const messageTemplates = {
      'D+1': '初回生成は試せましたか？／他のサイズもいかがですか？',
      'D+3': '別の業種パターン・季節キャンペーン用バナーも試してみませんか？',
      'D+7': 'Free 上限に近づいたら Pro（月 100 本）も検討ください',
    };
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*【${group.label}】 ${group.users.length} 名*\n_${messageTemplates[group.label]}_\n${group.users.map(fmtUserLine).join('\n')}`,
      },
    });
  }

  await sendToSlack(blocks);
  await prisma.$disconnect();
};

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
