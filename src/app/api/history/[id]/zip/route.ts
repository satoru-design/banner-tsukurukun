/**
 * Phase A.11.5: GET /api/history/[id]/zip
 *
 * Pro+ のみ。実際の ZIP 生成はクライアント側 (jszip)。
 * このエンドポイントは画像 URL リストを返すだけ。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
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

    // Phase A.17.0: Pro / Business / admin で利用可（一括 ZIP DL は両有料プランの標準機能）
    if (user.plan !== 'pro' && user.plan !== 'business' && user.plan !== 'admin') {
      return NextResponse.json(
        { error: 'ZIP DL は Pro プラン以上で利用可能です' },
        { status: 403 },
      );
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

    // Pro+ なのでロック対象になる事は通常ないが、保険として判定
    const allSessions = await prisma.generation.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, images: { select: { isFavorite: true } } },
    });
    const idx = allSessions.findIndex((s) => s.id === id);
    const hasFavorite = allSessions[idx]?.images.some((img) => img.isFavorite) ?? false;
    const locked = computeLocked({
      index: idx,
      accessLimit: getHistoryAccessLimit(user.plan),
      hasFavorite,
    });
    if (locked) {
      return NextResponse.json({ error: 'Locked' }, { status: 403 });
    }

    const snapshot = generation.briefSnapshot as unknown as BriefSnapshot;
    const safeProductName = (snapshot.product || 'banner').replace(
      /[^a-zA-Z0-9ぁ-んァ-ヶ一-龥-]/g,
      '_',
    ).slice(0, 30);
    const ts = generation.createdAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    return NextResponse.json({
      filenamePrefix: `${safeProductName}_${ts}`,
      images: generation.images.map((img) => ({
        size: img.size,
        blobUrl: img.blobUrl,
        filename: `${safeProductName}_${img.size.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
      })),
    });
  } catch (err) {
    console.error('GET /api/history/[id]/zip error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
