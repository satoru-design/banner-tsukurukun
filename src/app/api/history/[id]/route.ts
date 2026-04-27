/**
 * Phase A.11.5: GET /api/history/[id] 詳細 / DELETE 削除
 *
 * GET: ロック対象は 403、自分の userId 以外も 403
 * DELETE: 自分の userId のもののみ、Blob も prefix 一括削除
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import { deleteGenerationFolder } from '@/lib/generations/blob-client';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!generation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ロック判定: index を出すために createdAt desc で全件取得
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
      return NextResponse.json(
        { error: 'Locked. Upgrade to Pro for full access.' },
        { status: 403 },
      );
    }

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error('GET /api/history/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({ where: { id } });
    if (!generation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Blob を先に削除（DB 削除後だと参照情報が消える）
    await deleteGenerationFolder(user.userId, id).catch((err) => {
      console.error('deleteGenerationFolder failed (continuing):', err);
    });

    // DB cascade で GenerationImage も削除される
    await prisma.generation.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/history/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
