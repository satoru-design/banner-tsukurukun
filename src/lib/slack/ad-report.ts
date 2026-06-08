import { detectFatiguedAds, type FatiguedAd } from '@/lib/feedback-loop/fatigue-query';
import { getAdSnapshotRows, type SnapshotBucket } from '@/lib/feedback-loop/ad-snapshot';
import { getPrisma } from '@/lib/prisma';
import { getAccountWebhook } from '@/lib/feedback-loop/accounts';
import { yen, count, ratioPct, fixedTable } from './format';

const MIN_SCORE = 0.5;

export interface WinningHintFull {
  dimension: string;
  value: string;
  avgCpa: number | null;
  avgCpc: number | null;
  avgCtr: number | null;
  adCount: number;
  conversions: number;
  score: number;
}

export function formatWinningReport(input: {
  rangeLabel: string;
  hints: WinningHintFull[];
  fatigued: FatiguedAd[];
}): string {
  const lines: string[] = [`🏆 AdLoop 勝ちクリエイティブ分析（${input.rangeLabel}）`];
  const strong = input.hints.filter((h) => h.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
  if (strong.length === 0) {
    lines.push('今週は有意な勝ち要因なし（データ不足）');
  } else {
    lines.push('score≥0.5 のみ（= 次回生成へ反映される要因）');
    for (const h of strong) {
      const cpa = h.avgCpa === null ? '–' : yen(h.avgCpa);
      const cpc = h.avgCpc === null ? '–' : yen(h.avgCpc);
      lines.push(
        ` ・${h.dimension}: ${h.value}（CPA ${cpa} / CPC ${cpc} / CTR ${ratioPct(h.avgCtr)} ・広告${h.adCount}本・CV${h.conversions}件）`,
      );
    }
  }
  if (input.fatigued.length > 0) {
    lines.push('', `⚠️ 疲労で要差し替え（${input.fatigued.length}件）`);
    for (const f of input.fatigued) {
      lines.push(` ・${f.adName ?? f.adId}（${f.detail}）`);
    }
  }
  lines.push('', '💡 次回への示唆');
  lines.push(
    strong.length > 0
      ? ' 次回の自動生成は上記の勝ち要因を優先反映します。'
      : ' データが貯まり次第、勝ち要因を自動反映します。',
  );
  if (input.fatigued.length > 0) {
    lines.push(' ⚠️ 疲労広告はMeta管理画面でOFFを検討してください。');
  }
  return lines.join('\n');
}

export function formatSnapshotTable(title: string, buckets: SnapshotBucket[]): string {
  if (buckets.length === 0) return `📅 ${title}\nデータなし`;
  const headers = ['期間', '広告費', '表示', 'クリック', 'CTR', 'CPC', 'CV', 'CPA'];
  const widths = [15, 7, 6, 8, 6, 5, 4, 8];
  const rows = buckets.map((b) => [
    b.label,
    yen(b.spend),
    count(b.impressions),
    count(b.clicks),
    ratioPct(b.ctr),
    b.cpc === null ? '–' : yen(b.cpc),
    count(b.conversions),
    b.cpa === null ? '–' : yen(b.cpa),
  ]);
  return `📅 ${title}\n\`\`\`\n${fixedTable(headers, rows, widths)}\n\`\`\``;
}

async function post(text: string, webhookUrl: string | null): Promise<void> {
  if (!webhookUrl) { console.warn('[ad-report] webhook 未設定のためスキップ'); return; }
  const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!res.ok) console.error(`[ad-report] Slack 送信失敗 ${res.status}`);
}

async function getLatestWinningFull(accountId: string): Promise<WinningHintFull[]> {
  const prisma = getPrisma();
  const latest = await prisma.winningPattern.findFirst({ where: { accountId }, orderBy: { windowEnd: 'desc' } });
  if (!latest) return [];
  const rows = await prisma.winningPattern.findMany({
    where: { accountId, windowEnd: latest.windowEnd },
    orderBy: { score: 'desc' },
  });
  const seen = new Set<string>();
  const out: WinningHintFull[] = [];
  for (const r of rows) {
    if (seen.has(r.dimension)) continue;
    seen.add(r.dimension);
    out.push({
      dimension: r.dimension,
      value: r.value,
      avgCpa: r.avgCpa === null ? null : Number(r.avgCpa),
      avgCpc: r.avgCpc === null ? null : Number(r.avgCpc),
      avgCtr: r.avgCtr === null ? null : Number(r.avgCtr),
      adCount: r.adCount,
      conversions: r.conversions,
      score: Number(r.score),
    });
  }
  return out;
}

/** 週次: 勝ち要因 + 週次スナップショット(16週) を1メッセージ送信 */
export async function sendWeeklyAdReport(account: { id: string; slug: string }, rangeLabel: string): Promise<void> {
  const [hints, fatigued, weekly] = await Promise.all([
    getLatestWinningFull(account.id),
    detectFatiguedAds(account.id),
    getAdSnapshotRows(account.id, 'weekly', 16),
  ]);
  const part1 = formatWinningReport({ rangeLabel, hints, fatigued });
  const part2 = formatSnapshotTable('AdLoop 週次スナップショット 直近16週', weekly);
  await post(`${part1}\n\n${part2}`, getAccountWebhook(account.slug));
}

/** 月次: 月次スナップショット(6ヶ月) を送信 */
export async function sendMonthlyAdSnapshot(account: { id: string; slug: string }): Promise<void> {
  const monthly = await getAdSnapshotRows(account.id, 'monthly', 6);
  await post(formatSnapshotTable('AdLoop 月次スナップショット 直近6ヶ月', monthly), getAccountWebhook(account.slug));
}
