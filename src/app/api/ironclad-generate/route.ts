import { NextResponse } from 'next/server';
import {
  buildIroncladImagePromptWithPrefix,
  getIroncladSizeMeta,
  type IroncladMaterials,
} from '@/lib/prompts/ironclad-banner';
import { generateWithFallback } from '@/lib/image-providers';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { incrementUsage } from '@/lib/plans/usage';
import { isUsageLimitReached, effectiveUsageCount } from '@/lib/plans/usage-check';
import { USAGE_LIMIT_FREE, USAGE_LIMIT_PRO, USAGE_LIMIT_BUSINESS, getHardcap } from '@/lib/plans/limits';
import { getPrisma } from '@/lib/prisma';
import {
  buildBriefSnapshot,
  snapshotIdentityKey,
  type BriefSnapshot,
} from '@/lib/generations/snapshot';
import { uploadGenerationImage } from '@/lib/generations/blob-client';
import { applyPreviewWatermark } from '@/lib/image-providers/watermark';
import { sendMeteredUsage } from '@/lib/billing/usage-records';
import {
  generateCleanImageAndQueueVideo,
  type CoVideoOptions,
} from '@/lib/generations/clean-image';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Phase B.3: admin 同時動画生成のリクエスト拡張部分。
 * IroncladMaterials とは別 namespace で扱い、cron が拾う GenerationVideo を pending で作成する。
 */
interface VideoCogenRequest {
  generateVideo?: boolean;
  videoProvider?: 'veo-3.1-fast' | 'veo-3.1-lite';
  videoDurationSeconds?: 4 | 6 | 8;
  videoPromptJa?: string;
}

export async function POST(req: Request) {
  try {
    const rawBody = (await req.json()) as IroncladMaterials & VideoCogenRequest;
    const materials = rawBody;
    const videoCogen: VideoCogenRequest = {
      generateVideo: rawBody.generateVideo === true,
      videoProvider: rawBody.videoProvider,
      videoDurationSeconds: rawBody.videoDurationSeconds,
      videoPromptJa: rawBody.videoPromptJa,
    };

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

    const sizeMeta = getIroncladSizeMeta(materials.size);
    if (!sizeMeta) {
      return NextResponse.json({ error: `Unknown size: ${materials.size}` }, { status: 400 });
    }
    const aspectRatio = sizeMeta.aspectRatio;
    const apiSizeOverride = sizeMeta.apiSize;

    // Phase A.11.3: 上限チェック（fail-fast でコスト保護）
    // Phase A.14: free は preview, pro は metered で通す。starter のみ「ソフト上限」block。
    // Phase A.15: 全プランに「ハードキャップ」追加（コスト暴走 / チャージバック爆弾の防止線）
    // DB から fresh な count を取得（JWT は古い可能性あり）
    const currentUser = await getCurrentUser();
    if (currentUser.userId && Number.isFinite(currentUser.usageLimit)) {
      const prisma = getPrisma();
      const dbUser = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { plan: true, usageCount: true, usageResetAt: true },
      });
      if (dbUser) {
        const checkInput = {
          usageCount: dbUser.usageCount,
          usageLimit: currentUser.usageLimit,
          usageResetAt: dbUser.usageResetAt,
        };
        // Phase A.15: ハードキャップ（プラン別の絶対上限）。Free/Pro/Starter 共通で適用
        const hardcap = getHardcap(dbUser.plan);
        const effectiveCount = effectiveUsageCount(checkInput);
        if (Number.isFinite(hardcap) && effectiveCount >= hardcap) {
          return NextResponse.json(
            {
              error:
                dbUser.plan === 'pro'
                  ? `Pro プランの月間生成上限（${hardcap} 枚）に到達しました。さらにご利用の場合は Plan C（個別商談）よりお問合せください。`
                  : '今月の生成上限に到達しました',
              usageCount: effectiveCount,
              usageLimit: hardcap,
              limitReached: true,
              hardcapReached: true,
            },
            { status: 429 },
          );
        }
        // 既存: starter のソフト上限 block（hardcap = limit なので上の hardcap で既に block されるが残しておく）
        if (isUsageLimitReached(checkInput) && dbUser.plan === 'starter') {
          return NextResponse.json(
            {
              error: '今月の生成上限に到達しました',
              usageCount: effectiveCount,
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
    // Phase A.14: 増分後の plan/usageCount/stripeCustomerId を取得して preview/metered 判定に使う
    let newUsageCount: number | undefined;
    let updatedPlan = 'free';
    let updatedStripeCustomerId: string | null = null;
    if (currentUser.userId) {
      try {
        await incrementUsage(currentUser.userId);
        const prisma = getPrisma();
        const updated = await prisma.user.findUnique({
          where: { id: currentUser.userId },
          select: { plan: true, usageCount: true, stripeCustomerId: true },
        });
        newUsageCount = updated?.usageCount;
        updatedPlan = updated?.plan ?? 'free';
        updatedStripeCustomerId = updated?.stripeCustomerId ?? null;
      } catch (err) {
        console.error('incrementUsage failed:', err);
      }
    }

    // Phase A.14: Free プラン 4 回目以降は PREVIEW 透かしを焼き込む
    const isPreview =
      updatedPlan === 'free' &&
      typeof newUsageCount === 'number' &&
      newUsageCount > USAGE_LIMIT_FREE;

    let finalBase64 = result.base64;
    if (isPreview) {
      try {
        const base64Body = finalBase64.replace(/^data:image\/[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Body, 'base64');
        const watermarked = await applyPreviewWatermark(buffer);
        finalBase64 = watermarked.toString('base64');
      } catch (err) {
        console.error('preview watermark failed, using original:', err);
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
          // Phase A.14: matched が non-preview だが今回 preview なら latch して true に上げる
          if (isPreview && !matched.isPreview) {
            generation = await prisma.generation.update({
              where: { id: matched.id },
              data: { isPreview: true },
            });
          }
        } else {
          generation = await prisma.generation.create({
            data: {
              userId: currentUser.userId,
              briefSnapshot: snapshot as unknown as object,
              isPreview,
            },
          });
        }
        generationId = generation.id;

        // 画像を Blob にアップロード（preview なら透かし入りバッファを base64 化したもの）
        const blobUrl = await uploadGenerationImage(
          currentUser.userId,
          generation.id,
          materials.size,
          finalBase64,
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

        // Phase A.14: Pro 上限超過なら meterEvents 送信（identifier=generation.id で idempotent）
        if (
          updatedPlan === 'pro' &&
          updatedStripeCustomerId &&
          typeof newUsageCount === 'number' &&
          newUsageCount > USAGE_LIMIT_PRO
        ) {
          await sendMeteredUsage(updatedStripeCustomerId, generation.id);
        }
        // Phase A.17.0: Business 上限超過なら meterEvents 送信（同 meter / 単価は Stripe Price で決まる）
        if (
          updatedPlan === 'business' &&
          updatedStripeCustomerId &&
          typeof newUsageCount === 'number' &&
          newUsageCount > USAGE_LIMIT_BUSINESS
        ) {
          try {
            await sendMeteredUsage(updatedStripeCustomerId, generation.id);
          } catch (e) {
            console.error('[ironclad-generate] meterEvents failed (business):', e);
          }
        }
      } catch (err) {
        // 履歴保存失敗はベストエフォート（生成自体は成功扱いを維持）
        console.error('Phase A.11.5 generation save failed:', err);
      }
    }

    // Phase B.3: admin かつ generateVideo=true なら、clean 素材生成 + GenerationVideo pending 投入
    let videoId: string | undefined;
    let videoEstimatedCostUsd: number | undefined;
    if (videoCogen.generateVideo && currentUser.userId && generationId) {
      if (updatedPlan !== 'admin') {
        console.warn('[ironclad-generate] generateVideo requested by non-admin, ignored');
      } else {
        try {
          const opts: CoVideoOptions = {
            provider: videoCogen.videoProvider,
            durationSeconds: videoCogen.videoDurationSeconds,
            promptJa: videoCogen.videoPromptJa,
          };
          const cogen = await generateCleanImageAndQueueVideo({
            userId: currentUser.userId,
            generationId,
            materials,
            options: opts,
          });
          videoId = cogen.videoId;
          videoEstimatedCostUsd = cogen.estimatedCostUsd;
        } catch (err) {
          console.error('[ironclad-generate] video co-gen failed:', err);
          // ベストエフォート: 静止画は成功扱いのまま、UI 側でエラーを別途表示
        }
      }
    }

    return NextResponse.json({
      imageUrl: finalBase64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
      promptPreview: finalPrompt,
      usageCount: newUsageCount,
      generationId,
      isPreview,
      videoId,
      videoEstimatedCostUsd,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('ironclad-generate error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
