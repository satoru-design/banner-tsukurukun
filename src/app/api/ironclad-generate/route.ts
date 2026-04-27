import { NextResponse } from 'next/server';
import {
  buildIroncladImagePromptWithPrefix,
  SIZE_TO_API_IRONCLAD,
  type IroncladMaterials,
} from '@/lib/prompts/ironclad-banner';
import { generateWithFallback } from '@/lib/image-providers';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { incrementUsage } from '@/lib/plans/usage';
import { isUsageLimitReached, effectiveUsageCount } from '@/lib/plans/usage-check';
import { getPrisma } from '@/lib/prisma';
import {
  buildBriefSnapshot,
  snapshotIdentityKey,
  type BriefSnapshot,
} from '@/lib/generations/snapshot';
import { uploadGenerationImage } from '@/lib/generations/blob-client';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const materials = (await req.json()) as IroncladMaterials;

    // 最低限バリデーション
    if (!materials.product || !materials.target || !materials.purpose) {
      return NextResponse.json(
        { error: 'product, target, purpose are required' },
        { status: 400 },
      );
    }
    if (!Array.isArray(materials.copies) || materials.copies.length !== 4) {
      return NextResponse.json({ error: 'copies must be 4-tuple' }, { status: 400 });
    }
    if (!Array.isArray(materials.designRequirements) || materials.designRequirements.length !== 4) {
      return NextResponse.json(
        { error: 'designRequirements must be 4-tuple' },
        { status: 400 },
      );
    }

    const sizeMeta = SIZE_TO_API_IRONCLAD[materials.size];
    if (!sizeMeta) {
      return NextResponse.json({ error: `Unknown size: ${materials.size}` }, { status: 400 });
    }
    const aspectRatio = sizeMeta.aspectRatio;
    const apiSizeOverride = sizeMeta.apiSize;

    // Phase A.11.3: 上限チェック（fail-fast でコスト保護）
    // DB から fresh な count を取得（JWT は古い可能性あり）
    const currentUser = await getCurrentUser();
    if (currentUser.userId && Number.isFinite(currentUser.usageLimit)) {
      const prisma = getPrisma();
      const dbUser = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { usageCount: true, usageResetAt: true },
      });
      if (dbUser) {
        const checkInput = {
          usageCount: dbUser.usageCount,
          usageLimit: currentUser.usageLimit,
          usageResetAt: dbUser.usageResetAt,
        };
        if (isUsageLimitReached(checkInput)) {
          const effective = effectiveUsageCount(checkInput);
          return NextResponse.json(
            {
              error: '今月の生成回数上限に到達しました',
              usageCount: effective,
              usageLimit: currentUser.usageLimit,
              limitReached: true,
            },
            { status: 429 },
          );
        }
      }
    }

    const finalPrompt = buildIroncladImagePromptWithPrefix(materials);

    // 参考画像URLを集約（商品画像・バッジ1・バッジ2）
    const referenceImageUrls = [
      materials.productImageUrl,
      materials.badgeImageUrl1,
      materials.badgeImageUrl2,
    ].filter((u): u is string => Boolean(u && u.trim()));

    // copyBundle: buildBakeTextInstruction 用。鉄板プロンプト本体にも同じ情報が入っているが
    // テキスト描画の強制力を高めるため二重で渡す。
    const copyBundle = {
      mainCopy: materials.copies[0],
      subCopy: materials.copies[1],
      ctaText: materials.cta,
      primaryBadgeText: materials.copies[2],
      secondaryBadgeText: materials.copies[3],
    };

    const result = await generateWithFallback('gpt-image', {
      prompt: finalPrompt,
      aspectRatio,
      apiSizeOverride,
      referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      // Ironclad: アップロードされた素材（商品画像・認証バッジ）をそのまま配置。改変禁止モード。
      referenceMode: 'composite',
      copyBundle,
    });

    // Phase A.11.0: 生成成功時に使用回数カウントアップ（失敗時はカウントしない）
    // Phase A.11.3: 新 usageCount をレスポンスに含めてクライアント update() に渡す
    let newUsageCount: number | undefined;
    if (currentUser.userId) {
      try {
        await incrementUsage(currentUser.userId);
        const prisma = getPrisma();
        const updated = await prisma.user.findUnique({
          where: { id: currentUser.userId },
          select: { usageCount: true },
        });
        newUsageCount = updated?.usageCount;
      } catch (err) {
        console.error('incrementUsage failed:', err);
      }
    }

    // Phase A.11.5: 履歴保存（Generation + GenerationImage）
    let generationId: string | undefined;
    if (currentUser.userId) {
      try {
        const snapshot = buildBriefSnapshot(materials);
        const identityKey = snapshotIdentityKey(snapshot);
        const prisma = getPrisma();

        // 同セッション判定: 過去 5 分以内に同じブリーフがあればマージ
        const recentSessions = await prisma.generation.findMany({
          where: {
            userId: currentUser.userId,
            createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        const matched = recentSessions.find((g) => {
          const s = g.briefSnapshot as unknown as BriefSnapshot;
          return snapshotIdentityKey(s) === identityKey;
        });

        let generation;
        if (matched) {
          generation = matched;
        } else {
          generation = await prisma.generation.create({
            data: {
              userId: currentUser.userId,
              briefSnapshot: snapshot as unknown as object,
            },
          });
        }
        generationId = generation.id;

        // 画像を Blob にアップロード
        const blobUrl = await uploadGenerationImage(
          currentUser.userId,
          generation.id,
          materials.size,
          result.base64,
        );

        await prisma.generationImage.create({
          data: {
            generationId: generation.id,
            size: materials.size,
            blobUrl,
            provider: result.providerId,
            providerMetadata: result.providerMetadata as unknown as object,
          },
        });
      } catch (err) {
        // 履歴保存失敗はベストエフォート（生成自体は成功扱いを維持）
        console.error('Phase A.11.5 generation save failed:', err);
      }
    }

    return NextResponse.json({
      imageUrl: result.base64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
      promptPreview: finalPrompt,
      usageCount: newUsageCount,
      generationId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('ironclad-generate error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
