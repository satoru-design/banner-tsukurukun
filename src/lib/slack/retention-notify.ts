/**
 * Phase A.19: リテンション対象ユーザー (D+1 / D+3 / D+7) を Slack に通知する。
 *
 * 既存 scripts/notify-retention-targets.mjs のロジックを Server-side (TS) で再実装。
 * /api/cron/notify-retention から毎朝 9 時 JST に発火される。
 *
 * 通知先: SLACK_WEBHOOK_URL_NEW_USER (新規登録通知と同チャンネル)
 */
import { getPrisma } from '@/lib/prisma';

const HOURS = 60 * 60 * 1000;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL_NEW_USER ?? '';

type RetentionLabel = 'D+1' | 'D+3' | 'D+7';

interface RetentionUser {
  id: string;
  email: string;
  name: string | null;
  usageCount: number;
  generationCount: number;
}

interface RetentionGroup {
  label: RetentionLabel;
  users: RetentionUser[];
}

function hoursAgoRange(hoursStart: number, hoursEnd: number) {
  const now = Date.now();
  return {
    gte: new Date(now - hoursEnd * HOURS),
    lt: new Date(now - hoursStart * HOURS),
  };
}

async function findTargets(label: RetentionLabel, hoursStart: number, hoursEnd: number): Promise<RetentionGroup> {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: {
      createdAt: hoursAgoRange(hoursStart, hoursEnd),
      plan: 'free', // 既に有料/admin は除外
    },
    select: {
      id: true,
      email: true,
      name: true,
      usageCount: true,
      _count: { select: { generations: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return {
    label,
    users: users.map((u) => ({
      id: u.id,
      email: u.email ?? '(no-email)',
      name: u.name,
      usageCount: u.usageCount ?? 0,
      generationCount: u._count.generations,
    })),
  };
}

const MESSAGE_TEMPLATES: Record<RetentionLabel, string> = {
  'D+1': '初回生成は試せましたか？／他のサイズもいかがですか？',
  'D+3': '別の業種パターン・季節キャンペーン用バナーも試してみませんか？',
  'D+7': 'Free 上限 (10 本) に近づいたら Pro 7 日無料トライアルも検討ください',
};

function fmtUserLine(u: RetentionUser): string {
  return `• \`${u.email}\` (${u.name ?? '-'}) — 累計生成 ${u.generationCount} / 今月使用 ${u.usageCount}`;
}

/**
 * Slack 通知本体。
 * 戻り値: 通知した対象数。SLACK_WEBHOOK 未設定なら no-op で 0 を返す。
 */
export async function sendRetentionNotify(): Promise<{
  notified: boolean;
  totalCount: number;
  byLabel: Record<RetentionLabel, number>;
}> {
  const [d1, d3, d7] = await Promise.all([
    findTargets('D+1', 24, 48),
    findTargets('D+3', 72, 96),
    findTargets('D+7', 168, 192),
  ]);

  const totalCount = d1.users.length + d3.users.length + d7.users.length;
  const byLabel = {
    'D+1': d1.users.length,
    'D+3': d3.users.length,
    'D+7': d7.users.length,
  };

  if (totalCount === 0) {
    return { notified: false, totalCount: 0, byLabel };
  }

  if (!SLACK_WEBHOOK) {
    console.warn('[retention-notify] SLACK_WEBHOOK_URL_NEW_USER 未設定。送信スキップ。');
    return { notified: false, totalCount, byLabel };
  }

  const blocks: unknown[] = [
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
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*【${group.label}】 ${group.users.length} 名*\n_${MESSAGE_TEMPLATES[group.label]}_\n${group.users.map(fmtUserLine).join('\n')}`,
      },
    });
  }

  try {
    const res = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) {
      console.error('[retention-notify] Slack 送信失敗:', res.status, await res.text());
      return { notified: false, totalCount, byLabel };
    }
    return { notified: true, totalCount, byLabel };
  } catch (e) {
    console.error('[retention-notify] Slack 送信例外:', e);
    return { notified: false, totalCount, byLabel };
  }
}
