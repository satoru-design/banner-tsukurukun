/**
 * Phase A.19: 毎朝の日次 KPI 自動分析 + Slack 投稿
 *
 * 1. 過去 24h (JST 0:00-23:59 相当) の新規登録・生成・Paid 転換を本番 DB から集計
 * 2. 過去 7 日トレンドと前日比を計算
 * 3. Claude (Sonnet 4.5) で「3 行の所感」+「1 行の今日の打ち手」を生成
 * 4. Slack (SLACK_WEBHOOK_URL_NEW_USER) に Block Kit で投稿
 *
 * 発火: /api/cron/daily-kpi-analysis (毎朝 0:00 UTC = 9:00 JST)
 *
 * 注: 広告コスト・CTR は別 sheet (autobanner-kpi GAS) で集計済み。
 * このスクリプトは DB-side 指標のみ。Sheet 連携は後段で。
 */
import Anthropic from '@anthropic-ai/sdk';
import { getPrisma } from '@/lib/prisma';

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL_NEW_USER ?? '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Gx4BmIlhOaZAAjB52li1kvskC8p6awl95jRqflA_IcM/edit?gid=0#gid=0';

interface NewUserRow {
  email: string;
  name: string | null;
  generationCount: number;
}

interface GenerationRow {
  email: string;
  product: string;
  imageCount: number;
}

export interface DailyKpi {
  dateLabel: string; // JST 日付ラベル
  newUsersExternal: NewUserRow[];
  externalGenerations: GenerationRow[];
  totalExternalGenerations: number;
  totalExternalImages: number;
  paidConversions: number;
  // トレンド
  previousDayUsersExternal: number;
  weeklyNewUsersExternal: number;
  weeklyAvgUsers: number;
  // 累計
  totalUsers: number;
  totalActivePaid: number;
}

const HOUR = 60 * 60 * 1000;

/** JST 基準で「昨日の 0:00〜23:59」相当の UTC レンジを返す */
function getYesterdayJstRange(): { start: Date; end: Date; label: string } {
  // JST = UTC+9。JST 0:00 = UTC 15:00 of prev day
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * HOUR);
  const jstYesterdayMidnight = new Date(
    Date.UTC(
      jstNow.getUTCFullYear(),
      jstNow.getUTCMonth(),
      jstNow.getUTCDate() - 1,
      0,
      0,
      0,
    ),
  );
  // JST 0:00 を UTC に戻す → UTC = JST - 9h
  const start = new Date(jstYesterdayMidnight.getTime() - 9 * HOUR);
  const end = new Date(start.getTime() + 24 * HOUR);
  const label = `${jstYesterdayMidnight.getUTCFullYear()}-${String(jstYesterdayMidnight.getUTCMonth() + 1).padStart(2, '0')}-${String(jstYesterdayMidnight.getUTCDate()).padStart(2, '0')}`;
  return { start, end, label };
}

export async function collectDailyKpi(): Promise<DailyKpi> {
  const prisma = getPrisma();
  const { start: dayStart, end: dayEnd, label } = getYesterdayJstRange();
  const dayBeforeStart = new Date(dayStart.getTime() - 24 * HOUR);
  const weekStart = new Date(dayEnd.getTime() - 7 * 24 * HOUR);

  // 新規登録（外部 / Free のみ）
  const newUsers = await prisma.user.findMany({
    where: { createdAt: { gte: dayStart, lt: dayEnd }, plan: 'free' },
    select: {
      email: true,
      name: true,
      _count: { select: { generations: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 外部生成（admin 除外）
  const generations = await prisma.generation.findMany({
    where: {
      createdAt: { gte: dayStart, lt: dayEnd },
      user: { plan: { not: 'admin' } },
    },
    select: {
      briefSnapshot: true,
      user: { select: { email: true } },
      images: { select: { id: true } },
    },
  });

  const externalGenerations: GenerationRow[] = generations.map((g) => {
    const snap = g.briefSnapshot as { product?: string } | null;
    return {
      email: g.user?.email ?? '(unknown)',
      product: snap?.product ?? '(unknown)',
      imageCount: g.images.length,
    };
  });

  // 前日（48-24h 前）
  const previousDayUsers = await prisma.user.count({
    where: { createdAt: { gte: dayBeforeStart, lt: dayStart }, plan: 'free' },
  });

  // 直近 7 日
  const weeklyNewUsers = await prisma.user.count({
    where: { createdAt: { gte: weekStart, lt: dayEnd }, plan: 'free' },
  });

  // Paid 転換数（昨日中に有料化したユーザー）
  const paidConversions = await prisma.user.count({
    where: {
      planStartedAt: { gte: dayStart, lt: dayEnd },
      plan: { in: ['starter', 'pro', 'business'] },
    },
  });

  const totalUsers = await prisma.user.count();
  const totalActivePaid = await prisma.user.count({
    where: { plan: { in: ['starter', 'pro', 'business'] } },
  });

  const totalExternalImages = externalGenerations.reduce(
    (s, g) => s + g.imageCount,
    0,
  );

  return {
    dateLabel: label,
    newUsersExternal: newUsers.map((u) => ({
      email: u.email,
      name: u.name,
      generationCount: u._count.generations,
    })),
    externalGenerations,
    totalExternalGenerations: externalGenerations.length,
    totalExternalImages,
    paidConversions,
    previousDayUsersExternal: previousDayUsers,
    weeklyNewUsersExternal: weeklyNewUsers,
    weeklyAvgUsers: weeklyNewUsers / 7,
    totalUsers,
    totalActivePaid,
  };
}

export async function generateInsight(kpi: DailyKpi): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return '(Claude API キー未設定。所感は生成されていません)';
  }
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const prompt = `あなたは autobanner.jp（AI バナー生成 B2B SaaS）の運用パートナーです。
小池さん（株式会社 4th Avenue Lab 代表 / 元 楽天・RIZAP・ネクイノ）に対して、本日朝の KPI を見て簡潔に所感と打ち手を提案してください。

# サービス状況 (2026-05 時点)
- ローンチ後 1 ヶ月。Meta 広告を主流入源として運用中。
- 撤退ライン: 累計広告費 ¥150,000 で Paid 1 件出なければ広告停止。
- 直近の打ち手: Audience Network 除外、Free 上限 3→10、Pro 7 日無料 Trial 実装、ファネル計測。
- 既知の課題: 登録後リテンション低い（初回生成後の離脱大）。

# 昨日（${kpi.dateLabel} JST）の指標
- 新規登録（外部・Free のみ）: ${kpi.newUsersExternal.length} 名
${kpi.newUsersExternal.length > 0 ? kpi.newUsersExternal.map((u) => `  - ${u.email}（${u.name ?? '-'} / 当日生成 ${u.generationCount}）`).join('\n') : '  （なし）'}
- 外部生成セッション: ${kpi.totalExternalGenerations} / 画像 ${kpi.totalExternalImages} 枚
${
  kpi.externalGenerations.length > 0
    ? kpi.externalGenerations
        .slice(0, 10)
        .map((g) => `  - ${g.email} → ${g.product}（${g.imageCount} 枚）`)
        .join('\n')
    : '  （なし）'
}
- Paid 転換: ${kpi.paidConversions} 件

# トレンド比較
- 前日の新規登録: ${kpi.previousDayUsersExternal} 名
- 直近 7 日平均: ${kpi.weeklyAvgUsers.toFixed(1)} 名/日
- 累計外部登録: ${kpi.totalUsers - kpi.totalActivePaid - 2} 名 (admin 2 名 / 有料 ${kpi.totalActivePaid} 名 を除く)
- 累計 Paid: ${kpi.totalActivePaid} 名

# 回答フォーマット（厳守）
所感: <3 行以内・事実ベース・前日比・週次トレンドに触れる>

今日の打ち手: <80 字以内・具体的アクション 1 つだけ・「今日中にできる」もの>

注:
- 日本語の散文（箇条書きでなく）
- 数字は具体的に
- 「素晴らしい！」等の感情論はカット
- 撤退ラインに対する位置も意識
`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim();
  return text || '(所感生成失敗)';
}

export async function sendToSlack(kpi: DailyKpi, insight: string): Promise<void> {
  if (!SLACK_WEBHOOK) {
    console.warn('[daily-kpi-analysis] SLACK_WEBHOOK_URL_NEW_USER 未設定');
    return;
  }

  const trendArrow =
    kpi.newUsersExternal.length > kpi.previousDayUsersExternal
      ? '📈'
      : kpi.newUsersExternal.length < kpi.previousDayUsersExternal
        ? '📉'
        : '➡️';

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 ${kpi.dateLabel} autobanner.jp 日次 KPI`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*新規登録（外部）*\n${kpi.newUsersExternal.length} 名 ${trendArrow} (前日 ${kpi.previousDayUsersExternal} / 7日平均 ${kpi.weeklyAvgUsers.toFixed(1)})`,
        },
        {
          type: 'mrkdwn',
          text: `*生成セッション*\n${kpi.totalExternalGenerations}（${kpi.totalExternalImages} 枚）`,
        },
        {
          type: 'mrkdwn',
          text: `*Paid 転換*\n${kpi.paidConversions} 件 / 累計 ${kpi.totalActivePaid}`,
        },
        {
          type: 'mrkdwn',
          text: `*累計登録*\n${kpi.totalUsers} 名`,
        },
      ],
    },
  ];

  if (kpi.newUsersExternal.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🆕 新規登録者*\n${kpi.newUsersExternal.map((u) => `• \`${u.email}\` (${u.name ?? '-'}) 当日生成 ${u.generationCount}`).join('\n')}`,
      },
    });
  }

  if (kpi.externalGenerations.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🎨 生成内訳*\n${kpi.externalGenerations
          .slice(0, 8)
          .map((g) => `• ${g.email} → ${g.product}（${g.imageCount} 枚）`)
          .join('\n')}${kpi.externalGenerations.length > 8 ? `\n…他 ${kpi.externalGenerations.length - 8} 件` : ''}`,
      },
    });
  }

  if (insight) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🤖 Claude による所感と今日の打ち手*\n${insight}`,
      },
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `<${SHEET_URL}|広告 KPI シートで詳細を確認> / autobanner.jp DB-side 指標。広告コスト等は別シート参照。`,
      },
    ],
  });

  try {
    const res = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) {
      console.error(
        '[daily-kpi-analysis] Slack 送信失敗:',
        res.status,
        await res.text(),
      );
    }
  } catch (e) {
    console.error('[daily-kpi-analysis] Slack 送信例外:', e);
  }
}

export async function runDailyAnalysis(): Promise<{
  kpi: DailyKpi;
  insight: string;
}> {
  const kpi = await collectDailyKpi();
  const insight = await generateInsight(kpi);
  await sendToSlack(kpi, insight);
  return { kpi, insight };
}
