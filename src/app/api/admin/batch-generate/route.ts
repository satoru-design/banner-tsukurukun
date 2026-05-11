import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { verifyBatchGenerateAuth } from '@/lib/batch-generate/auth';
import { getBatchGenerateAdminUser } from '@/lib/batch-generate/admin-user';
import {
  buildIroncladImagePromptWithPrefix,
  getIroncladSizeMeta,
  type IroncladMaterials,
} from '@/lib/prompts/ironclad-banner';
import { generateWithFallback } from '@/lib/image-providers';
import { getPrisma } from '@/lib/prisma';
import { buildBriefSnapshot } from '@/lib/generations/snapshot';
import { uploadGenerationImage } from '@/lib/generations/blob-client';

export const runtime = 'nodejs';
// 順次生成で最大 20 本 × 各 ~30s = ~10min を想定。Vercel Pro 上限 800s 以内に収める。
export const maxDuration = 800;

const MAX_BATCH_SIZE = 20;

type BatchResult =
  | { index: number; ok: true; imageUrl: string; generationId: string; provider: string }
  | { index: number; ok: false; error: string };

export async function POST(req: Request): Promise<Response> {
  // 1. 認証
  if (!verifyBatchGenerateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. パース
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 3. バリデーション
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be object' }, { status: 400 });
  }
  const materials = (body as { materials?: unknown }).materials;
  if (!Array.isArray(materials)) {
    return NextResponse.json({ error: 'materials must be an array' }, { status: 400 });
  }
  if (materials.length === 0) {
    return NextResponse.json({ error: 'materials must have at least 1 item' }, { status: 400 });
  }
  if (materials.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `materials exceeds max batch size (${MAX_BATCH_SIZE})` },
      { status: 400 },
    );
  }

  // 4. admin user 解決
  let adminUser;
  try {
    adminUser = await getBatchGenerateAdminUser();
  } catch (e) {
    console.error('[batch-generate] admin user resolve failed:', e);
    return NextResponse.json(
      { error: 'Admin user resolution failed', details: (e as Error).message },
      { status: 500 },
    );
  }

  const requestId = randomUUID();
  const results: BatchResult[] = [];

  // 5. 順次生成
  const prisma = getPrisma();
  for (let i = 0; i < materials.length; i++) {
    const mat = materials[i] as IroncladMaterials;

    // 個別バリデーション
    if (!mat.product || !mat.target || !mat.purpose) {
      results.push({
        index: i,
        ok: false,
        error: 'product, target, purpose are required',
      });
      continue;
    }
    if (!Array.isArray(mat.copies) || mat.copies.length !== 4) {
      results.push({ index: i, ok: false, error: 'copies must be 4-tuple' });
      continue;
    }
    if (!Array.isArray(mat.designRequirements) || mat.designRequirements.length !== 4) {
      results.push({ index: i, ok: false, error: 'designRequirements must be 4-tuple' });
      continue;
    }
    const sizeMeta = getIroncladSizeMeta(mat.size);
    if (!sizeMeta) {
      results.push({ index: i, ok: false, error: `Unknown size: ${mat.size}` });
      continue;
    }

    try {
      const finalPrompt = buildIroncladImagePromptWithPrefix(mat);
      const referenceImageUrls = [
        mat.productImageUrl,
        mat.badgeImageUrl1,
        mat.badgeImageUrl2,
      ].filter((u): u is string => Boolean(u && u.trim()));
      const copyBundle = {
        mainCopy: mat.copies[0],
        subCopy: mat.copies[1],
        ctaText: mat.cta,
        primaryBadgeText: mat.copies[2],
        secondaryBadgeText: mat.copies[3],
      };

      console.log(`[batch-generate ${requestId}] generating index=${i} size=${mat.size}`);
      const result = await generateWithFallback('gpt-image', {
        prompt: finalPrompt,
        aspectRatio: sizeMeta.aspectRatio,
        apiSizeOverride: sizeMeta.apiSize,
        referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
        referenceMode: 'composite',
        copyBundle,
      });

      // Generation + GenerationImage を admin user 名義で保存（usage 増分なし・透かしなし）
      const snapshot = buildBriefSnapshot(mat);
      const generation = await prisma.generation.create({
        data: {
          userId: adminUser.id,
          briefSnapshot: snapshot as unknown as object,
          isPreview: false,
        },
      });
      const blobUrl = await uploadGenerationImage(
        adminUser.id,
        generation.id,
        mat.size,
        result.base64,
      );
      await prisma.generationImage.create({
        data: {
          generationId: generation.id,
          size: mat.size,
          blobUrl,
          provider: result.providerId,
          providerMetadata: result.providerMetadata as unknown as object,
        },
      });

      results.push({
        index: i,
        ok: true,
        imageUrl: blobUrl,
        generationId: generation.id,
        provider: result.providerId,
      });
    } catch (e) {
      console.error(`[batch-generate ${requestId}] index=${i} failed:`, e);
      results.push({
        index: i,
        ok: false,
        error: (e as Error).message,
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  return NextResponse.json({
    success: succeeded > 0,
    requestId,
    results,
    summary: { total: materials.length, succeeded, failed },
  });
}
