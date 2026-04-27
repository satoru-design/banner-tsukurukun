/**
 * Phase A.11.5: GET /api/history
 *
 * クエリ:
 * - cursor?: string  Generation.id（カーソルベースページング）
 * - limit?: string   1〜50（デフォルト 20）
 *
 * レスポンス:
 * {
 *   sessions: [{ id, createdAt, brief, images, locked, hasFavorite }],
 *   nextCursor: string | null,
 *   lockedCount: number,    // ロック中の総数（Free/Starter のみ非ゼロ）
 *   plan: string,
 * }
 *
 * ロック判定: 直近 N 件以内 OR ★お気に入り含む → unlocked
 * ロック時は images の blobUrl を空文字でマスク（漏洩防止）
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limitStr = url.searchParams.get('limit') ?? '20';
    const limit = Math.min(50, Math.max(1, Number.parseInt(limitStr, 10) || 20));

    const prisma = getPrisma();
    const accessLimit = getHistoryAccessLimit(user.plan);

    // 全件取得（プラン制限・ロック判定のため index 必要）
    const allSessions = await prisma.generation.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: { images: true },
    });

    // ロック判定 + マスキング
    const enriched = allSessions.map((s, idx) => {
      const hasFavorite = s.images.some((img) => img.isFavorite);
      const locked = computeLocked({ index: idx, accessLimit, hasFavorite });
      return {
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        brief: pickBriefFields(s.briefSnapshot as unknown as BriefSnapshot),
        images: s.images.map((img) => ({
          id: img.id,
          size: img.size,
          blobUrl: locked ? '' : img.blobUrl,
          isFavorite: img.isFavorite,
        })),
        locked,
        hasFavorite,
      };
    });

    const lockedCount = enriched.filter((s) => s.locked).length;

    // カーソルページング
    const startIdx = cursor ? enriched.findIndex((s) => s.id === cursor) + 1 : 0;
    const page = enriched.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < enriched.length ? page[page.length - 1]?.id : null;

    return NextResponse.json({
      sessions: page,
      nextCursor: nextCursor ?? null,
      lockedCount,
      plan: user.plan,
    });
  } catch (err) {
    console.error('GET /api/history error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function pickBriefFields(s: BriefSnapshot) {
  return {
    pattern: s.pattern,
    product: s.product,
    target: s.target,
    purpose: s.purpose,
  };
}
