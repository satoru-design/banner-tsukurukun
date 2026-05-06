/**
 * Phase B.1: 動画ジョブワーカー (Vercel Cron 駆動、毎分起動)
 *
 * 各実行で 'pending' を1件 atomic claim → provider.run() で
 * start + poll + download まで完結 → Vercel Blob upload → status='done'。
 *
 * SDK の getVideosOperation は元の Operation インスタンスを必要とするため、
 * cron 跨ぎで start/poll を分けると "_fromAPIResponse is not a function"
 * になる。1関数呼び出し内で完結させるのが正解。
 *
 * Vercel maxDuration=300秒。Veo Lite 8s で約60-90秒なので余裕あり。
 */

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getVideoProvider, VideoProviderId } from '@/lib/video-providers';
import { uploadGenerationVideo } from '@/lib/generations/video-blob-client';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * 'pending' を1件 atomically claim して 'processing' に遷移させる。
 * 同時実行で同じ行を取らないよう FOR UPDATE SKIP LOCKED を使用。
 */
async function claimPendingJob(): Promise<{ id: string } | null> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "GenerationVideo"
    SET status = 'processing', "startedAt" = NOW()
    WHERE id = (
      SELECT id FROM "GenerationVideo"
      WHERE status = 'pending'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;
  return rows[0] ?? null;
}

async function processOneJob(): Promise<{ jobId: string; status: string } | null> {
  const claimed = await claimPendingJob();
  if (!claimed) return null;

  const prisma = getPrisma();
  const job = await prisma.generationVideo.findUnique({
    where: { id: claimed.id },
    include: { generation: { select: { userId: true } } },
  });
  if (!job) return null;

  try {
    const provider = getVideoProvider(job.provider as VideoProviderId);
    const result = await provider.run({
      prompt: job.prompt,
      inputImageUrl: job.inputImageUrl ?? undefined,
      aspectRatio: job.aspectRatio as '9:16' | '16:9' | '1:1',
      durationSeconds: job.durationSeconds as 4 | 5 | 6 | 8 | 10,
      generateAudio: job.generateAudio,
      trackingId: job.id,
    });

    // Vercel Blob にアップロード
    const blobUrl = await uploadGenerationVideo(
      job.generation.userId,
      job.generationId,
      job.id,
      result.buffer,
      result.mimeType,
    );

    const finalCost = provider.estimateCost(job.durationSeconds, {
      audio: job.generateAudio,
    });

    const mergedMetadata: Record<string, unknown> = {
      ...((job.providerMetadata as Record<string, unknown> | null) ?? {}),
      ...(result.providerMetadata ?? {}),
      resultGcsUri: result.resultUri,
    };

    await prisma.generationVideo.update({
      where: { id: job.id },
      data: {
        status: 'done',
        blobUrl,
        vertexOperationId: (mergedMetadata.operationName as string | undefined) ?? null,
        costUsd: finalCost,
        completedAt: new Date(),
        providerMetadata: mergedMetadata as Parameters<typeof prisma.generationVideo.update>[0]['data']['providerMetadata'],
      },
    });

    return { jobId: job.id, status: 'done' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[process-video-jobs] failed:', job.id, message, stack);
    await prisma.generationVideo.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage: message.slice(0, 500),
        completedAt: new Date(),
        providerMetadata: {
          ...((job.providerMetadata as Record<string, unknown> | null) ?? {}),
          fullErrorMessage: encodeURIComponent(message),
          stack: stack?.slice(0, 2000),
        } as Record<string, unknown> as Parameters<typeof prisma.generationVideo.update>[0]['data']['providerMetadata'],
      },
    });
    return { jobId: job.id, status: 'failed' };
  }
}

export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processOneJob();
  return NextResponse.json({
    ok: true,
    processed: result ? 1 : 0,
    result,
  });
};
