/**
 * Phase A.11.5: PUT /api/history/image/[imageId]/favorite
 *
 * Body: { isFavorite: boolean }
 * プラン別制限:
 * - Free: 常に 403（お気に入り使用不可、Pro 訴求）
 * - Starter: 既に 5 枚 ★ 済 + 新規 ★ → 429
 * - Pro / Plan C: 制限なし
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getFavoriteLimit } from '@/lib/plans/history-limits';

export const runtime = 'nodejs';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = getFavoriteLimit(user.plan);
    if (limit === 0) {
      return NextResponse.json(
        { error: 'お気に入りは Pro プランで開放されます' },
        { status: 403 },
      );
    }

    const body = (await req.json()) as { isFavorite?: unknown };
    if (typeof body.isFavorite !== 'boolean') {
      return NextResponse.json({ error: 'isFavorite must be boolean' }, { status: 400 });
    }

    const prisma = getPrisma();
    const image = await prisma.generationImage.findUnique({
      where: { id: imageId },
      include: { generation: true },
    });
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (image.generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 新規 ★ 化の場合、上限チェック
    if (body.isFavorite && !image.isFavorite && Number.isFinite(limit)) {
      const currentCount = await prisma.generationImage.count({
        where: {
          generation: { userId: user.userId },
          isFavorite: true,
        },
      });
      if (currentCount >= limit) {
        return NextResponse.json(
          {
            error: `お気に入り上限に到達しました（${limit} 枚）`,
            limit,
            current: currentCount,
          },
          { status: 429 },
        );
      }
    }

    const updated = await prisma.generationImage.update({
      where: { id: imageId },
      data: {
        isFavorite: body.isFavorite,
        favoritedAt: body.isFavorite ? new Date() : null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      isFavorite: updated.isFavorite,
      favoritedAt: updated.favoritedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error('PUT /api/history/image/[imageId]/favorite error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
