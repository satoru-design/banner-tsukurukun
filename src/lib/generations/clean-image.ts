/**
 * Phase B.3: 動画化用「文字なしクリーン素材」の生成 + GenerationVideo 投入。
 *
 * メイン静止画 (gpt-image-2 で文字焼き込み) と並行して、Imagen 4 Ultra で
 * "同じ商品・同じ被写体" を文字なしで生成し、Veo I2V の入力として保存する。
 *
 * Vibe Coding 六条:
 *  1. セキュリティ: BLOB_READ_WRITE_TOKEN 利用、ユーザー所有 Generation のみに紐づけ
 *  2. コスト: imagen4 1 回 + GenerationVideo 1 件 (cron が拾って Veo 投入)。admin 限定で抑制
 *  3. 法規: 文字焼き込み無し画像は商標リスク低減
 *  4. データ: GenerationVideo.inputImageUrl に clean blob URL を保存して再利用可
 *  5. 性能: メイン生成と直列で 60-90 秒追加。maxDuration=300 内に収まる
 *  6. 検証: imagen4 fallback なし (Imagen ↔ Flux 切替は意味ないので preferred only)
 */
import { generateWithFallback } from '@/lib/image-providers';
import { put } from '@vercel/blob';
import { getPrisma } from '@/lib/prisma';
import type { IroncladMaterials } from '@/lib/prompts/ironclad-banner';
import { buildVeoPrompts } from './video-prompt-knowledge';

export type VideoProviderId = 'veo-3.1-fast' | 'veo-3.1-lite';
export type VideoDurationSeconds = 4 | 6 | 8;
export type VeoAspectRatio = '9:16' | '16:9';

export interface CoVideoOptions {
  provider?: VideoProviderId;
  durationSeconds?: VideoDurationSeconds;
  promptJa?: string;
  /**
   * Phase B.5: 動画用 aspect ratio (1+)。各 AR で 1 本ずつ動画生成。
   * 1:1 は Veo 非対応のため受け付けない (UI 側で除外している前提)。
   */
  aspectRatios: VeoAspectRatio[];
}

const NEGATIVE_PROMPT =
  'text, letters, kanji, hiragana, katakana, alphabet, words, captions, headlines, signage, sign, watermark, logo, banner, label, button, badge, price tag, callout, sticker, written language, typography, font';

/**
 * クリーン素材用 prompt。「商品 + 自然な被写体・背景・光」を描写し、
 * 文字焼き込み指示を一切含めない。
 */
function buildCleanPrompt(m: IroncladMaterials, aspectRatio: VeoAspectRatio): string {
  const product = m.product || '商品';
  const target = m.target || '一般消費者';
  const tone = m.tone || 'professional';

  return [
    `Photorealistic commercial advertising photograph for video reference.`,
    `Subject: ${product}, presented to ${target}.`,
    `Tone/mood: ${tone}.`,
    `Composition: clean studio or natural setting, well-lit, single hero subject centered.`,
    `Aspect ratio: ${aspectRatio}.`,
    `Absolutely NO text overlays, NO captions, NO headlines, NO logos, NO watermarks, NO price tags, NO labels.`,
    `The image must be entirely visual: only the product, possibly a person interacting with it, and natural background.`,
    `Cinematic lighting, shallow depth of field, magazine-cover quality.`,
  ].join('\n');
}

interface CleanImageResult {
  videoIds: string[];
  totalEstimatedCostUsd: number;
}

/**
 * Phase B.3: clean image 生成 + Vercel Blob 保存 + GenerationVideo pending 作成。
 *
 * 失敗してもメインの静止画生成は維持する想定。呼び出し側で try/catch しベストエフォート扱い。
 */
export async function generateCleanImageAndQueueVideo(args: {
  userId: string;
  generationId: string;
  materials: IroncladMaterials;
  options: CoVideoOptions;
}): Promise<CleanImageResult> {
  const { userId, generationId, materials, options } = args;
  const provider: VideoProviderId = options.provider ?? 'veo-3.1-fast';
  const durationSeconds: VideoDurationSeconds = options.durationSeconds ?? 8;
  const aspectRatios = options.aspectRatios.length > 0 ? options.aspectRatios : ['9:16' as const];

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  const prisma = getPrisma();

  // 各 AR について「clean image 生成 → Blob 保存 → Sonnet prompt 生成 → GenerationVideo pending 作成」を並列実行
  const refs = materials.productImageUrl ? [materials.productImageUrl] : undefined;
  const costPerSec = provider === 'veo-3.1-lite' ? 0.4 : 0.15;
  const costPerVideo = +(costPerSec * durationSeconds).toFixed(4);

  const results = await Promise.all(
    aspectRatios.map(async (veoAspect) => {
      // STEP 1: Imagen 4 で clean 素材生成 (この AR で)
      const cleanPrompt = buildCleanPrompt(materials, veoAspect);
      const cleanResult = await generateWithFallback('imagen4', {
        prompt: cleanPrompt,
        aspectRatio: veoAspect,
        referenceImageUrls: refs,
        negativePrompt: NEGATIVE_PROMPT,
      });

      // STEP 2: Vercel Blob に保存 (AR ごとに別ファイル)
      const base64 = cleanResult.base64.split(',')[1] ?? cleanResult.base64;
      const buf = Buffer.from(base64, 'base64');
      const safeAr = veoAspect.replace(':', 'x');
      const path = `generations/${userId}/${generationId}/_clean_for_video_${safeAr}.png`;
      const blob = await put(path, buf, { access: 'public', contentType: 'image/png', token });

      // STEP 3: Sonnet で Veo 用 prompt
      const veoPrompts = await buildVeoPrompts({
        product: materials.product,
        target: materials.target,
        tone: materials.tone,
        aspectRatio: veoAspect,
        durationSeconds,
        userDirection: options.promptJa,
      });

      // STEP 4: GenerationVideo pending 作成
      const video = await prisma.generationVideo.create({
        data: {
          generationId,
          format: `${veoAspect} ${durationSeconds}s (admin co-gen)`,
          aspectRatio: veoAspect,
          status: 'pending',
          provider,
          inputImageUrl: blob.url,
          durationSeconds,
          generateAudio: provider === 'veo-3.1-lite',
          prompt: veoPrompts.promptEn,
          promptJa: veoPrompts.promptJa,
          costUsd: 0,
          providerMetadata: {
            estimatedCostUsd: costPerVideo,
            coGenerated: true,
            cleanProvider: cleanResult.providerId,
            cleanAspectRatio: veoAspect,
            originalSize: materials.size,
            negativePrompt: veoPrompts.negativePrompt,
          },
        },
        select: { id: true },
      });
      return { videoId: video.id, costUsd: costPerVideo };
    }),
  );

  return {
    videoIds: results.map((r) => r.videoId),
    totalEstimatedCostUsd: +results.reduce((s, r) => s + r.costUsd, 0).toFixed(4),
  };
}
