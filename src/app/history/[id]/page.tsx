/**
 * Phase A.11.5: /history/[id] 詳細ページ。
 * Server Component で getCurrentUser + DB 取得 → HistoryDetail に渡す。
 */
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import { Header } from '@/components/layout/Header';
import { HistoryDetail } from './HistoryDetail';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.userId) {
    redirect(`/signin?callbackUrl=/history/${id}`);
  }

  const prisma = getPrisma();
  const generation = await prisma.generation.findUnique({
    where: { id },
    include: {
      images: true,
      generationVideos: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!generation) notFound();
  if (generation.userId !== user.userId) notFound();

  // ロック判定
  const allSessions = await prisma.generation.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, images: { select: { isFavorite: true } } },
  });
  const accessLimit = getHistoryAccessLimit(user.plan);
  const idx = allSessions.findIndex((s) => s.id === id);
  const hasFavorite = allSessions[idx]?.images.some((img) => img.isFavorite) ?? false;
  const locked = computeLocked({ index: idx, accessLimit, hasFavorite });
  if (locked) {
    // ロック対象は一覧に戻して訴求モーダル経由に統一
    redirect('/history');
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <HistoryDetail
          detail={{
            id: generation.id,
            createdAt: generation.createdAt.toISOString(),
            briefSnapshot: generation.briefSnapshot as unknown as BriefSnapshot,
            images: generation.images.map((img) => ({
              id: img.id,
              size: img.size,
              blobUrl: img.blobUrl,
              provider: img.provider,
              isFavorite: img.isFavorite,
              favoritedAt: img.favoritedAt?.toISOString() ?? null,
              createdAt: img.createdAt.toISOString(),
            })),
            videos: generation.generationVideos.map((v) => ({
              id: v.id,
              status: v.status,
              provider: v.provider,
              aspectRatio: v.aspectRatio,
              durationSeconds: v.durationSeconds,
              blobUrl: v.blobUrl,
              inputImageUrl: v.inputImageUrl,
              errorMessage: v.errorMessage,
              createdAt: v.createdAt.toISOString(),
              completedAt: v.completedAt?.toISOString() ?? null,
            })),
          }}
        />
      </main>
    </div>
  );
}
