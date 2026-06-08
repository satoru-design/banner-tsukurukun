import { getPrisma } from '@/lib/prisma';

export interface WinningHint {
  dimension: string;
  value: string;
  score: number;
}

const MIN_SCORE = 0.5;

/** 勝ちヒント配列 → 生成プロンプトに前置する日本語指示文（純ロジック） */
export function formatWinningPatternsPrefix(hints: WinningHint[]): string {
  const strong = hints.filter((h) => h.score >= MIN_SCORE);
  if (strong.length === 0) return '';
  const lines = strong
    .sort((a, b) => b.score - a.score)
    .map((h) => `- ${h.dimension}: ${h.value}（実績スコア ${h.score.toFixed(2)}）`);
  return [
    '【過去配信の勝ち要因（成果データに基づく。優先的に踏襲すること）】',
    ...lines,
    '',
  ].join('\n');
}

/** 最新窓の WinningPattern を読み、各 dimension のトップ値を返す */
export async function getLatestWinningHints(accountId: string, limitPerDim = 1): Promise<WinningHint[]> {
  const prisma = getPrisma();
  const latest = await prisma.winningPattern.findFirst({ where: { accountId }, orderBy: { windowEnd: 'desc' } });
  if (!latest) return [];
  const rows = await prisma.winningPattern.findMany({
    where: { accountId, windowEnd: latest.windowEnd },
    orderBy: { score: 'desc' },
  });
  const seen = new Map<string, number>();
  const out: WinningHint[] = [];
  for (const r of rows) {
    const n = seen.get(r.dimension) ?? 0;
    if (n >= limitPerDim) continue;
    seen.set(r.dimension, n + 1);
    out.push({ dimension: r.dimension, value: r.value, score: Number(r.score) });
  }
  return out;
}
