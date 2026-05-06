/**
 * GET /api/generate-video/[id]
 *  Phase B.1 動画ジョブの状態を取得。フロントエンドが2秒間隔でポーリングする。
 *
 * 認可: video.generation.userId === session.user.id のみ
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const prisma = getPrisma();
    const video = await prisma.generationVideo.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        provider: true,
        format: true,
        aspectRatio: true,
        durationSeconds: true,
        generateAudio: true,
        blobUrl: true,
        errorMessage: true,
        costUsd: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        generation: { select: { userId: true } },
      },
    });

    if (!video || video.generation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: video.id,
      status: video.status,
      provider: video.provider,
      format: video.format,
      aspectRatio: video.aspectRatio,
      durationSeconds: video.durationSeconds,
      generateAudio: video.generateAudio,
      blobUrl: video.blobUrl,
      errorMessage: video.errorMessage,
      costUsd: video.costUsd?.toString() ?? '0',
      createdAt: video.createdAt,
      startedAt: video.startedAt,
      completedAt: video.completedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('generate-video GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
