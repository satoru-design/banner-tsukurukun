import { NextResponse } from 'next/server';
import {
  buildIroncladImagePromptWithPrefix,
  getIroncladSizeMeta,
  type IroncladMaterials,
} from '@/lib/prompts/ironclad-banner';
import { generateWithFallback } from '@/lib/image-providers';
import { incrementUsage } from '@/lib/plans/usage';
import { guardGeneration } from '@/lib/plans/generation-guard';
import { USAGE_LIMIT_FREE, USAGE_LIMIT_PRO, USAGE_LIMIT_BUSINESS } from '@/lib/plans/limits';
import { getPrisma } from '@/lib/prisma';
import {
  buildBriefSnapshot,
  snapshotIdentityKey,
  type BriefSnapshot,
} from '@/lib/generations/snapshot';
import { uploadGenerationImage } from '@/lib/generations/blob-client';
import { applyPreviewWatermark } from '@/lib/image-providers/watermark';
import { sendMeteredUsage } from '@/lib/billing/usage-records';
import { filterAvailableUrls } from '@/lib/assets/url-availability';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';
// Phase B.8: gpt-image-2 のレイテンシが時間帯により非常に高くなる現象に対応
// maxDuration を Vercel Pro 上限の 800s まで引き上げ
export const maxDuration = 800;

/**
 * Phase B.7: 動画 co-gen は別エンドポイント (/api/queue-cogen-videos) に分離済。
 * このエンドポイントは静止画生成のみを担当する。
 *
 * Phase B.8: タイムアウト問題のデバッグ用に主要ステップに timestamp ログを追加。
 *   gpt-image-2 / DB / Blob のどこが遅いかを Vercel logs で特定するため。
 */

export async function POST(req: Request) {
  const reqStart = Date.now();
  const ts = (label: string) => {
    const elapsed = Date.now() - reqStart;
    console.log(`[ironclad-generate] +${(elapsed / 1000).toFixed(1)}s: ${label}`);
  };

  // fail-closed: 以前は userId が null のとき上限チェックごと素通りしていたため、
  // middleware を迂回されると無認証・無制限で gpt-image が叩けた。
  // 従量課金の呼び出し前にセッションとハードキャップを route 側で確定させる。
  const guard = await guardGeneration('ironclad-generate');
  if (!guard.ok) return guard.response;

  try {
    const materials = (await req.json()) as IroncladMaterials;
    ts('body parsed');

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

    // Phase A.11.3 / A.14 / A.15 の上限チェックは guardGeneration() に集約した。
    // （ログイン必須 → DB の fresh な usageCount → プラン別ハードキャップ → starter ソフト上限）
    const currentUser = { userId: guard.userId };

    const finalPrompt = buildIroncladImagePromptWithPrefix(materials);

    // 参考画像URLを集約（商品画像・バッジ1・バッジ2）。
    // Asset 削除や Blob 障害で死んでいる URL は事前にドロップする。
    // gpt-image-2 (images.edit / Responses API) は参照URLの 404 で全体を 400 にするため、
    // 死んだ URL を含むと「再試行しても永久に失敗するゾンビ Generation」が生まれる。
    const { available: referenceImageUrls, dropped: droppedRefs } = await filterAvailableUrls([
      materials.productImageUrl,
      materials.badgeImageUrl1,
      materials.badgeImageUrl2,
    ]);
    if (droppedRefs.length > 0) {
      ts(`dropped ${droppedRefs.length} dead reference URL(s)`);
    }

    // copyBundle: buildBakeTextInstruction 用。鉄板プロンプト本体にも同じ情報が入っているが
    // テキスト描画の強制力を高めるため二重で渡す。
    const copyBundle = {
      mainCopy: materials.copies[0],
      subCopy: materials.copies[1],
      ctaText: materials.cta,
      primaryBadgeText: materials.copies[2],
      secondaryBadgeText: materials.copies[3],
    };

    ts(`calling gpt-image (refs=${referenceImageUrls.length}, size=${materials.size})`);
    const result = await generateWithFallback('gpt-image', {
      prompt: finalPrompt,
      aspectRatio,
      apiSizeOverride,
      referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      // Ironclad: アップロードされた素材（商品画像・認証バッジ）をそのまま配置。改変禁止モード。
      referenceMode: 'composite',
      copyBundle,
    });
    ts('gpt-image returned');

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

        ts('uploading image to Blob');
        // 画像を Blob にアップロード（preview なら透かし入りバッファを base64 化したもの）
        const blobUrl = await uploadGenerationImage(
          currentUser.userId,
          generation.id,
          materials.size,
          finalBase64,
        );
        ts('blob upload done');

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
          if ((process.env.PAYMENT_PROVIDER ?? 'stripe') !== 'stores') {
            await sendMeteredUsage(updatedStripeCustomerId, generation.id);
          }
        }
        // Phase A.17.0: Business 上限超過なら meterEvents 送信（同 meter / 単価は Stripe Price で決まる）
        if (
          updatedPlan === 'business' &&
          updatedStripeCustomerId &&
          typeof newUsageCount === 'number' &&
          newUsageCount > USAGE_LIMIT_BUSINESS
        ) {
          try {
            if ((process.env.PAYMENT_PROVIDER ?? 'stripe') !== 'stores') {
              await sendMeteredUsage(updatedStripeCustomerId, generation.id);
            }
          } catch (e) {
            console.error('[ironclad-generate] meterEvents failed (business):', e);
          }
        }
      } catch (err) {
        // 履歴保存失敗はベストエフォート（生成自体は成功扱いを維持）
        console.error('Phase A.11.5 generation save failed:', err);
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
    });
  } catch (error: unknown) {
    return internalErrorResponse('ironclad-generate', error, 'バナー生成に失敗しました');
  }
}
