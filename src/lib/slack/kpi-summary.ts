/**
 * Daily / Weekly / Monthly KPI を Slack に送る統合モジュール。
 *
 * 設計方針（2026-05-11 / 3エージェント合意ベース）:
 * - 北極星指標 = WAU（17サイズ完走したユニーク生成者 / 週）
 * - Aha Moment = Generation の images が17枚揃った状態
 * - PMF前12ユーザー段階のため MRR/Churn/NRR/コホートは Slack 通知に載せない
 * - 通知は「祝福ブロック → 赤信号ブロック → 数値ブロック」の3層構成
 *
 * 呼び出し元:
 * - src/app/api/cron/kpi-daily/route.ts
 * - src/app/api/cron/kpi-weekly/route.ts
 * - src/app/api/cron/kpi-monthly/route.ts
 * - scripts/run-kpi-summary.ts (ad-hoc 動作確認)
 */
import { getPrisma } from '@/lib/prisma';

const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
const AHA_THRESHOLD_IMAGES = 17;
const FREE_ABUSE_GEN_PER_DAY = 50;

// ─────────────────────────────────────────────────────────────
// Time / Format Util
// ─────────────────────────────────────────────────────────────

function nowJstParts() {
  const jst = new Date(Date.now() + TOKYO_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
    weekday: jst.getUTCDay(), // 0=日, 1=月
  };
}

function jstMidnightToUtc(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day) - TOKYO_OFFSET_MS);
}

function fmtJstDate(d: Date): string {
  const jst = new Date(d.getTime() + TOKYO_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function planEmoji(plan: string): string {
  return plan === 'admin'
    ? ':crown:'
    : plan === 'business'
    ? ':office:'
    : plan === 'pro'
    ? ':star:'
    : plan === 'starter'
    ? ':seedling:'
    : ':bust_in_silhouette:';
}

function pct(num: number, den: number): string {
  if (den === 0) return 'N/A';
  return `${((num / den) * 100).toFixed(0)}%`;
}

/** メアドを匿名化（先頭3文字 + ***@ドメイン頭3文字***） */
function anonymizeEmail(email: string): string {
  const [local, domain] = email.split('@');
  const localHead = local.slice(0, Math.min(3, local.length));
  const domainHead = domain ? domain.slice(0, Math.min(3, domain.length)) : '';
  return `${localHead}***@${domainHead}***`;
}

async function postToSlack(text: string): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (!webhook) {
    console.log('[kpi-summary] SLACK_WEBHOOK_URL_NEW_USER 未設定のためスキップ');
    return;
  }
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Slack post failed: status=${res.status} body=${await res.text().catch(() => '')}`);
  }
}

type UserRow = {
  email: string;
  name: string | null;
  nameOverride: string | null;
  plan: string;
  createdAt: Date;
};

function formatUserLine(u: UserRow): string {
  const dn = (u.nameOverride || u.name || '').trim() || '(no name)';
  return `• ${planEmoji(u.plan)} \`${u.email}\` — ${dn} _(${u.plan}, ${fmtJstDate(u.createdAt)})_`;
}

// ─────────────────────────────────────────────────────────────
// Daily（毎朝 JST 8:00 想定）
// ─────────────────────────────────────────────────────────────

export async function sendDailyKpi(): Promise<{ ok: true }> {
  const prisma = getPrisma();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. 新規登録数（24h / 前日24h / 7d平均）
  const newSignups24h = await prisma.user.count({ where: { createdAt: { gte: last24h } } });
  const newSignupsPrevDay = await prisma.user.count({
    where: { createdAt: { gte: last48h, lt: last24h } },
  });
  const newSignups7d = await prisma.user.count({ where: { createdAt: { gte: last7d } } });
  const avgSignupsPerDay7d = newSignups7d / 7;

  // 2. アクティブ生成者数（24h, distinct userId）
  const generations24h = await prisma.generation.findMany({
    where: { createdAt: { gte: last24h } },
    select: { userId: true, _count: { select: { images: true } } },
  });
  const activeGeneratorIds = new Set(generations24h.map((g) => g.userId));
  const activeGenerators24h = activeGeneratorIds.size;

  // 3. Aha 達成数（24h, images >= 17 のセッションを完走したユニーク userId）
  const ahaUserIds = new Set(
    generations24h.filter((g) => g._count.images >= AHA_THRESHOLD_IMAGES).map((g) => g.userId),
  );
  const ahaUsers24h = ahaUserIds.size;

  // 4. Aha 達成率 = Aha到達 / アクティブ生成者数（活動ベースで判定）
  // 新規ベース (Aha / 当日新規) は n=0/1 で振れすぎるので副指標に
  const ahaRateOfActive = activeGenerators24h > 0 ? ahaUsers24h / activeGenerators24h : 0;
  const ahaRateOfNew = newSignups24h > 0 ? ahaUsers24h / newSignups24h : 0;

  // 5. Free 異常スパイク（plan=free で 1日 50生成超）
  const genCountByUser = generations24h.reduce<Record<string, number>>((acc, g) => {
    acc[g.userId] = (acc[g.userId] ?? 0) + 1;
    return acc;
  }, {});
  const heavyUserIds = Object.entries(genCountByUser)
    .filter(([, n]) => n >= FREE_ABUSE_GEN_PER_DAY)
    .map(([uid]) => uid);
  let freeAbuseUsers: { email: string; count: number }[] = [];
  if (heavyUserIds.length > 0) {
    const heavyUsers = await prisma.user.findMany({
      where: { id: { in: heavyUserIds }, plan: 'free' },
      select: { id: true, email: true },
    });
    freeAbuseUsers = heavyUsers.map((u) => ({
      email: u.email,
      count: genCountByUser[u.id] ?? 0,
    }));
  }

  // 6. 新規課金イベント（24h, Stripe webhook ログから抽出）
  const newPaidEvents = await prisma.webhookEvent.count({
    where: {
      type: { in: ['checkout.session.completed', 'invoice.paid'] },
      receivedAt: { gte: last24h },
    },
  });

  // ─── Slack メッセージ組立 ───
  const dateStr = fmtJstDate(now);
  const lines: string[] = [];
  lines.push(`:bar_chart: *autobanner.jp Daily KPI* — ${dateStr}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');

  // 祝福ブロック
  const celebrate: string[] = [];
  if (newSignups24h > 0) celebrate.push(`:tada: 新規登録 *${newSignups24h}名*`);
  if (ahaUsers24h > 0) celebrate.push(`:sparkles: Aha 到達 *${ahaUsers24h}名*（17サイズ完走）`);
  if (newPaidEvents > 0) celebrate.push(`:moneybag: 新規課金イベント *${newPaidEvents}件*`);
  if (celebrate.length > 0) {
    lines.push('', '*:tada: 祝福*');
    lines.push(...celebrate.map((c) => `  ${c}`));
  }

  // 赤信号ブロック
  const alerts: string[] = [];
  if (avgSignupsPerDay7d >= 1 && newSignups24h < avgSignupsPerDay7d * 0.5) {
    alerts.push(
      `:rotating_light: 新規登録が 7d平均の50%未満（24h=${newSignups24h} / 7d平均=${avgSignupsPerDay7d.toFixed(1)}）`,
    );
  }
  if (activeGenerators24h === 0) {
    alerts.push(`:rotating_light: アクティブ生成者 *0名*（24h）`);
  }
  if (activeGenerators24h > 0 && ahaRateOfActive < 0.2) {
    alerts.push(
      `:rotating_light: Aha 達成率（活動ベース）${pct(ahaUsers24h, activeGenerators24h)} が 20% 未満`,
    );
  }
  if (freeAbuseUsers.length > 0) {
    alerts.push(`:rotating_light: Free 異常スパイク ${freeAbuseUsers.length}名（>= ${FREE_ABUSE_GEN_PER_DAY} 生成/日）`);
    for (const u of freeAbuseUsers) {
      alerts.push(`    └ \`${u.email}\` — ${u.count}件`);
    }
  }
  if (alerts.length > 0) {
    lines.push('', '*:warning: 赤信号*');
    lines.push(...alerts.map((a) => `  ${a}`));
  } else {
    lines.push('', '*:white_check_mark: 赤信号なし*');
  }

  // 数値ブロック
  lines.push('', '*:bar_chart: 数値*');
  lines.push(
    `  • 新規登録（24h）: *${newSignups24h}* 名（前日 ${newSignupsPrevDay} / 7d平均 ${avgSignupsPerDay7d.toFixed(1)}）`,
  );
  lines.push(`  • アクティブ生成者（24h）: *${activeGenerators24h}* 名 / セッション ${generations24h.length}`);
  lines.push(
    `  • Aha 到達率: 活動ベース ${pct(ahaUsers24h, activeGenerators24h)}（${ahaUsers24h}/${activeGenerators24h}） / 新規ベース ${pct(ahaUsers24h, newSignups24h)}（${ahaUsers24h}/${newSignups24h}）`,
  );
  lines.push(`  • Free 異常スパイク: ${freeAbuseUsers.length}名`);
  lines.push(`  • 新規課金イベント（24h）: ${newPaidEvents}件`);

  await postToSlack(lines.join('\n'));
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Weekly（毎週 月曜 JST 9:00 想定 / 先週月曜0時〜今日0時）
// ─────────────────────────────────────────────────────────────

export async function sendWeeklyKpi(): Promise<{ ok: true }> {
  const prisma = getPrisma();
  const { year, month, day } = nowJstParts();
  const thisMonStart = jstMidnightToUtc(year, month, day);
  const lastMonStart = new Date(thisMonStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoMonStart = new Date(thisMonStart.getTime() - 14 * 24 * 60 * 60 * 1000);
  const wauStart = new Date(thisMonStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. WAU（過去7日に Generation 1件以上のユニーク userId）
  const wauGens = await prisma.generation.findMany({
    where: { createdAt: { gte: wauStart } },
    select: { userId: true, _count: { select: { images: true } } },
  });
  const wauSet = new Set(wauGens.map((g) => g.userId));
  const wauAhaSet = new Set(wauGens.filter((g) => g._count.images >= AHA_THRESHOLD_IMAGES).map((g) => g.userId));

  // 2. 先週の新規登録ユーザー（lastMon 〜 thisMon）
  const lastWeekUsers = await prisma.user.findMany({
    where: { createdAt: { gte: lastMonStart, lt: thisMonStart } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, name: true, nameOverride: true, plan: true, createdAt: true },
  });

  // 3. Activation Rate = 先週新規のうち Aha 達成（先週中に images>=17 を完走）
  const lastWeekUserIds = lastWeekUsers.map((u) => u.id);
  let activationCount = 0;
  if (lastWeekUserIds.length > 0) {
    const ahaGens = await prisma.generation.findMany({
      where: {
        userId: { in: lastWeekUserIds },
        createdAt: { gte: lastMonStart, lt: thisMonStart },
      },
      select: { userId: true, _count: { select: { images: true } } },
    });
    const ahaIds = new Set(ahaGens.filter((g) => g._count.images >= AHA_THRESHOLD_IMAGES).map((g) => g.userId));
    activationCount = ahaIds.size;
  }

  // 4. W1 リテンション = 先々週新規のうち先週も生成
  const twoWeekAgoUsers = await prisma.user.findMany({
    where: { createdAt: { gte: twoMonStart, lt: lastMonStart } },
    select: { id: true },
  });
  const twoWeekAgoIds = twoWeekAgoUsers.map((u) => u.id);
  let w1RetentionCount = 0;
  if (twoWeekAgoIds.length > 0) {
    const retGens = await prisma.generation.findMany({
      where: { userId: { in: twoWeekAgoIds }, createdAt: { gte: lastMonStart, lt: thisMonStart } },
      select: { userId: true },
    });
    w1RetentionCount = new Set(retGens.map((g) => g.userId)).size;
  }

  // 5. プラン別ユーザー分布（全期間）
  const allUsers = await prisma.user.findMany({ select: { plan: true } });
  const planCounts = allUsers.reduce<Record<string, number>>((acc, u) => {
    acc[u.plan] = (acc[u.plan] ?? 0) + 1;
    return acc;
  }, {});

  // 6. MVP ユーザー（先週で最も生成セッション数の多い人）
  const lastWeekAllGens = await prisma.generation.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: lastMonStart, lt: thisMonStart } },
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 1,
  });
  let mvp: { email: string; count: number } | null = null;
  if (lastWeekAllGens.length > 0) {
    const top = lastWeekAllGens[0];
    const u = await prisma.user.findUnique({
      where: { id: top.userId },
      select: { email: true },
    });
    if (u) mvp = { email: u.email, count: top._count.userId };
  }

  // 7. 当月の週別登録者数（月曜起点）
  const startOfThisMonthUtc = jstMidnightToUtc(year, month, 1);
  const firstDayJstWeekday = new Date(startOfThisMonthUtc.getTime() + TOKYO_OFFSET_MS).getUTCDay();
  const daysToFirstMonday = (8 - firstDayJstWeekday) % 7;
  const firstMondayUtc = new Date(startOfThisMonthUtc.getTime() + daysToFirstMonday * 24 * 60 * 60 * 1000);
  const weekBuckets: { startJst: string; count: number }[] = [];
  for (let t = firstMondayUtc.getTime(); t <= thisMonStart.getTime(); t += 7 * 24 * 60 * 60 * 1000) {
    const ws = new Date(t);
    const we = new Date(t + 7 * 24 * 60 * 60 * 1000);
    const c = await prisma.user.count({ where: { createdAt: { gte: ws, lt: we } } });
    weekBuckets.push({ startJst: fmtJstDate(ws), count: c });
  }

  // ─── Slack メッセージ組立 ───
  const lastWeekRangeStart = fmtJstDate(lastMonStart);
  const lastWeekRangeEnd = fmtJstDate(new Date(thisMonStart.getTime() - 24 * 60 * 60 * 1000));

  const lines: string[] = [];
  lines.push(`:date: *autobanner.jp Weekly KPI* — ${lastWeekRangeStart} 〜 ${lastWeekRangeEnd}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');

  lines.push('', '*:star2: 北極星指標*');
  lines.push(`  • WAU（週次アクティブ生成者）: *${wauSet.size}* 名`);
  lines.push(`  • WAU のうち Aha 完走者: ${wauAhaSet.size} 名`);
  lines.push(`  • Activation Rate: ${pct(activationCount, lastWeekUsers.length)} （先週新規 ${lastWeekUsers.length}名中 ${activationCount}名がAha到達）`);
  lines.push(
    `  • W1 リテンション: ${pct(w1RetentionCount, twoWeekAgoIds.length)} （先々週新規 ${twoWeekAgoIds.length}名中 ${w1RetentionCount}名が先週も生成）`,
  );

  lines.push('', `*:bust_in_silhouette: 先週の新規登録 ${lastWeekUsers.length}名*`);
  if (lastWeekUsers.length === 0) {
    lines.push('  _(該当なし)_');
  } else {
    for (const u of lastWeekUsers) lines.push(`  ${formatUserLine(u)}`);
  }

  if (mvp) {
    lines.push('', '*:trophy: 先週の MVP ユーザー（インタビュー打診候補）*');
    lines.push(`  ${anonymizeEmail(mvp.email)} — ${mvp.count} セッション生成`);
  }

  lines.push('', '*:office: プラン別ユーザー分布（累計）*');
  const planLine = ['admin', 'business', 'pro', 'starter', 'free']
    .filter((p) => (planCounts[p] ?? 0) > 0)
    .map((p) => `${p}=${planCounts[p]}`)
    .join(' / ');
  lines.push(`  ${planLine || '_(なし)_'}`);

  lines.push('', `*:calendar: 当月（${year}年${month}月）の週別登録者数（月曜起点）*`);
  if (weekBuckets.length === 0) {
    lines.push('  _(当月内にまだ月曜起点週がありません)_');
  } else {
    for (const b of weekBuckets) lines.push(`  • ${b.startJst}週: ${b.count}名`);
  }

  await postToSlack(lines.join('\n'));
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Monthly（毎月1日 JST 9:00 想定）
// ─────────────────────────────────────────────────────────────

export async function sendMonthlyKpi(): Promise<{ ok: true }> {
  const prisma = getPrisma();
  const { year, month } = nowJstParts();
  const startOfThisMonth = jstMidnightToUtc(year, month, 1);
  const lastMonthYear = month === 1 ? year - 1 : year;
  const lastMonth = month === 1 ? 12 : month - 1;
  const startOfLastMonth = jstMidnightToUtc(lastMonthYear, lastMonth, 1);
  const last30dStart = new Date(startOfThisMonth.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. MAU（過去30日に Generation 1件以上のユニーク userId）
  const mauGens = await prisma.generation.findMany({
    where: { createdAt: { gte: last30dStart, lt: startOfThisMonth } },
    select: { userId: true },
  });
  const mau = new Set(mauGens.map((g) => g.userId)).size;

  // 2. 累計登録 / プラン別 / 直近30dアクティブ率
  const allUsers = await prisma.user.findMany({
    where: { createdAt: { lt: startOfThisMonth } },
    orderBy: { createdAt: 'desc' },
    select: { email: true, name: true, nameOverride: true, plan: true, createdAt: true },
  });
  const planCounts = allUsers.reduce<Record<string, number>>((acc, u) => {
    acc[u.plan] = (acc[u.plan] ?? 0) + 1;
    return acc;
  }, {});
  const cumulative = allUsers.length;
  const activeRate = cumulative > 0 ? mau / cumulative : 0;

  // 3. 累計生成本数（先月末まで）
  const totalGenerations = await prisma.generation.count({
    where: { createdAt: { lt: startOfThisMonth } },
  });
  const totalImages = await prisma.generationImage.count({
    where: { createdAt: { lt: startOfThisMonth } },
  });

  // 4. 先月の新規課金イベント
  const lastMonthPaidEvents = await prisma.webhookEvent.count({
    where: {
      type: { in: ['checkout.session.completed', 'invoice.paid'] },
      receivedAt: { gte: startOfLastMonth, lt: startOfThisMonth },
    },
  });

  // ─── Slack メッセージ組立 ───
  const lines: string[] = [];
  lines.push(`:calendar: *autobanner.jp Monthly KPI* — ${lastMonthYear}年${lastMonth}月度`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');

  lines.push('', '*:bar_chart: マクロ指標*');
  lines.push(`  • MAU（過去30日アクティブ生成者）: *${mau}* 名`);
  lines.push(`  • 累計登録: *${cumulative}* 名（直近30dアクティブ率: ${pct(mau, cumulative)}）`);
  const planLine = ['admin', 'business', 'pro', 'starter', 'free']
    .filter((p) => (planCounts[p] ?? 0) > 0)
    .map((p) => `${p}=${planCounts[p]}`)
    .join(' / ');
  lines.push(`  • プラン別: ${planLine || '_(なし)_'}`);
  lines.push(`  • 累計生成セッション: ${totalGenerations} （バナー画像 ${totalImages} 枚）`);
  lines.push(`  • 先月の新規課金イベント: ${lastMonthPaidEvents} 件`);
  lines.push(`  • ユーザーインタビュー実施数: _未追跡（Phase 2 で DB 化予定）_`);

  lines.push('', `*:bust_in_silhouette: 先月末スナップショット — 累計登録 ${cumulative}名*`);
  if (cumulative === 0) {
    lines.push('  _(該当なし)_');
  } else {
    for (const u of allUsers) lines.push(`  ${formatUserLine(u)}`);
  }

  await postToSlack(lines.join('\n'));
  return { ok: true };
}
