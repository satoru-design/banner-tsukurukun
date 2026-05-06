/**
 * Phase B.1 Day 4: 動画ジョブ非同期ワーカー (Vercel Cron 駆動)
 *
 * 1分ごとに起動して、各実行で:
 *   1. 'pending' を1件 → provider.start() を呼んで 'processing' へ
 *   2. 'processing' を1件 → provider.pollStatus() を呼んで完了確認
 *      - done: download → Vercel Blob upload → 'done' へ
 *      - failed: 'failed' へ
 *      - processing: そのまま (次の cron run でまたチェック)
 *
 * 各 cron run の maxDuration は300秒。1ジョブあたりの処理は最大1〜2分なので
 * 2件処理しても十分間に合う。
 *
 * 同時実行ロックは UPDATE ... WHERE status='pending' RETURNING id で実現。
 */

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import {
  getVideoProvider,
  VideoProviderId,
} from '@/lib/video-providers';
import { uploadGenerationVideo } from '@/lib/generations/video-blob-client';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * 'pending' を1件 atomically claim して 'processing' に遷移させる。
 * 同時実行で同じ行を取らないよう、Postgres の UPDATE ... LIMIT 1 を使用。
 *
 * Prisma は LIMIT 付き UPDATE を直接サポートしないので $queryRaw で実装。
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

async function processPending(): Promise<{ jobId: string; status: string } | null> {
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
    const start = await provider.start({
      prompt: job.prompt,
      inputImageUrl: job.inputImageUrl ?? undefined,
      aspectRatio: job.aspectRatio as '9:16' | '16:9' | '1:1',
      durationSeconds: job.durationSeconds as 4 | 5 | 6 | 8 | 10,
      generateAudio: job.generateAudio,
      trackingId: job.id,
    });

    const mergedMetadata: Record<string, unknown> = {
      ...((job.providerMetadata as Record<string, unknown> | null) ?? {}),
      ...(start.providerMetadata ?? {}),
    };
    await prisma.generationVideo.update({
      where: { id: job.id },
      data: {
        vertexOperationId: start.operationId,
        providerMetadata: mergedMetadata as Parameters<typeof prisma.generationVideo.update>[0]['data']['providerMetadata'],
      },
    });

    return { jobId: job.id, status: 'processing' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[process-video-jobs] start failed:', job.id, message);
    await prisma.generationVideo.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    return { jobId: job.id, status: 'failed' };
  }
}

async function processProcessing(): Promise<{ jobId: string; status: string } | null> {
  const prisma = getPrisma();
  const job = await prisma.generationVideo.findFirst({
    where: { status: 'processing', vertexOperationId: { not: null } },
    orderBy: { startedAt: 'asc' },
    include: { generation: { select: { userId: true } } },
  });
  if (!job || !job.vertexOperationId) return null;

  try {
    const provider = getVideoProvider(job.provider as VideoProviderId);
    const status = await provider.pollStatus(job.vertexOperationId);

    if (status.state === 'processing') {
      // まだ生成中。次回 cron で再ポーリング
      return { jobId: job.id, status: 'processing' };
    }

    if (status.state === 'failed') {
      await prisma.generationVideo.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: status.errorMessage ?? 'Unknown error',
          completedAt: new Date(),
        },
      });
      return { jobId: job.id, status: 'failed' };
    }

    // status.state === 'done' → ダウンロード → Vercel Blob 移送
    if (!status.resultUri) {
      throw new Error('Provider returned done state but no resultUri');
    }
    const { buffer, mimeType } = await provider.download(status.resultUri);
    const blobUrl = await uploadGenerationVideo(
      job.generation.userId,
      job.generationId,
      job.id,
      buffer,
      mimeType,
    );

    const finalCost = provider.estimateCost(job.durationSeconds, {
      audio: job.generateAudio,
    });

    await prisma.generationVideo.update({
      where: { id: job.id },
      data: {
        status: 'done',
        blobUrl,
        costUsd: finalCost,
        completedAt: new Date(),
      },
    });

    return { jobId: job.id, status: 'done' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[process-video-jobs] poll/download failed:', job.id, message);
    await prisma.generationVideo.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
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

  // mode=pending or mode=processing で個別実行も可能 (デバッグ用)
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode'); // null | 'pending' | 'processing'

  const results: Array<{ jobId: string; status: string }> = [];

  if (!mode || mode === 'pending') {
    const r = await processPending();
    if (r) results.push({ ...r, jobId: r.jobId });
  }

  if (!mode || mode === 'processing') {
    const r = await processProcessing();
    if (r) results.push(r);
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
};
