/**
 * Phase 4: 拒否理由の保存・取得ヘルパー。
 *
 * Slack 承認 UI（将来）または手動 curl で /api/admin/batch-reject 経由で
 * 拒否情報が入る。batch-generate 時に直近 N 件を取得して prompt に注入する。
 */
import { getPrisma } from '@/lib/prisma';

const RECENT_REJECTS_LIMIT = 20;

export async function saveBatchReject(input: {
  reason: string;
  materials: unknown;
  generationId?: string;
  adId?: string;
}) {
  const prisma = getPrisma();
  return prisma.batchReject.create({
    data: {
      reason: input.reason,
      materials: input.materials as object,
      generationId: input.generationId ?? null,
      adId: input.adId ?? null,
    },
  });
}

export async function getRecentRejectReasons(): Promise<string[]> {
  const prisma = getPrisma();
  const rows = await prisma.batchReject.findMany({
    orderBy: { createdAt: 'desc' },
    take: RECENT_REJECTS_LIMIT,
    select: { reason: true },
  });
  return rows.map((r) => r.reason).filter((s) => s && s.trim().length > 0);
}
