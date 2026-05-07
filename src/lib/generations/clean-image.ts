/**
 * Phase B.3: 動画化用「文字なしクリーン素材」の生成 + GenerationVideo 投入。
 *
 * メイン静止画 (gpt-image-1 で文字焼き込み) と並行して、Imagen 4 Ultra で
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
import type { IroncladMaterials, IroncladSize } from '@/lib/prompts/ironclad-banner';
import { getIroncladSizeMeta } from '@/lib/prompts/ironclad-banner';
import { buildVeoPrompts } from './video-prompt-knowledge';

export type VideoProviderId = 'veo-3.1-fast' | 'veo-3.1-lite';
export type VideoDurationSeconds = 4 | 6 | 8;

export interface CoVideoOptions {
  provider?: VideoProviderId;
  durationSeconds?: VideoDurationSeconds;
  promptJa?: string;
}

const NEGATIVE_PROMPT =
  'text, letters, kanji, hiragana, katakana, alphabet, words, captions, headlines, signage, sign, watermark, logo, banner, label, button, badge, price tag, callout, sticker, written language, typography, font';

/**
 * クリーン素材用 prompt。「商品 + 自然な被写体・背景・光」を描写し、
 * 文字焼き込み指示を一切含めない。
 */
function buildCleanPrompt(m: IroncladMaterials, aspectRatio: string): string {
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

/**
 * Generation の aspectRatio から Veo 対応の aspectRatio に変換。
 * 4:5 / 1.91:1 等は Veo が直接サポートしないので、最も近い枠 (9:16 or 16:9 or 1:1) に丸める。
 */
function mapToVeoAspectRatio(aspectRatio: string): '9:16' | '16:9' | '1:1' {
  if (aspectRatio === '9:16' || aspectRatio === '16:9' || aspectRatio === '1:1') {
    return aspectRatio;
  }
  // 4:5, 2:3 等は縦長扱い → 9:16
  if (/^\d+:\d+$/.test(aspectRatio)) {
    const [w, h] = aspectRatio.split(':').map(Number);
    if (h > w) return '9:16';
    if (w > h) return '16:9';
    return '1:1';
  }
  return '9:16';
}

/**
 * size 文字列から aspectRatio を取得 (Generation テーブル size に対応)。
 */
function aspectRatioFromSize(size: IroncladSize): string {
  const meta = getIroncladSizeMeta(size);
  return meta?.aspectRatio ?? '9:16';
}

interface CleanImageResult {
  videoId: string;
  cleanBlobUrl: string;
  veoAspectRatio: '9:16' | '16:9' | '1:1';
  estimatedCostUsd: number;
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
  const aspectRatio = aspectRatioFromSize(materials.size);
  const veoAspect = mapToVeoAspectRatio(aspectRatio);

  // ----- STEP 1: Imagen 4 で clean 素材生成 -----
  // composite mode を避け、reference は productImageUrl のみ (バッジは文字含むため除外)
  const cleanPrompt = buildCleanPrompt(materials, veoAspect);
  const refs = materials.productImageUrl ? [materials.productImageUrl] : undefined;

  const cleanResult = await generateWithFallback('imagen4', {
    prompt: cleanPrompt,
    aspectRatio: veoAspect, // Imagen に Veo 互換アスペクト比で生成させる (リサイズ問題を回避)
    referenceImageUrls: refs,
    negativePrompt: NEGATIVE_PROMPT,
  });

  // ----- STEP 2: Vercel Blob に保存 -----
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  const base64 = cleanResult.base64.split(',')[1] ?? cleanResult.base64;
  const buf = Buffer.from(base64, 'base64');
  const path = `generations/${userId}/${generationId}/_clean_for_video.png`;
  const blob = await put(path, buf, { access: 'public', contentType: 'image/png', token });

  // ----- STEP 3: Sonnet で Veo 用 prompt 3 点セットを生成 -----
  // research に基づく Veo 3.1 prompt engineering ベストプラクティスを system prompt 化
  // (src/lib/generations/video-prompt-knowledge.ts 参照)
  const veoPrompts = await buildVeoPrompts({
    product: materials.product,
    target: materials.target,
    tone: materials.tone,
    aspectRatio: veoAspect,
    durationSeconds,
    userDirection: options.promptJa,
  });

  // ----- STEP 4: GenerationVideo pending 作成 (cron が拾って Veo 投入) -----
  // 概算コスト: Veo 3.1 Fast = $0.15/sec, Veo 3.1 Lite = $0.40/sec (audio 込)
  const costPerSec = provider === 'veo-3.1-lite' ? 0.4 : 0.15;
  const estimatedCostUsd = +(costPerSec * durationSeconds).toFixed(4);

  const prisma = getPrisma();
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
      prompt: veoPrompts.promptEn, // Veo に渡す英語プロンプト
      promptJa: veoPrompts.promptJa, // 日本語サマリ (UI 表示用)
      costUsd: 0,
      providerMetadata: {
        estimatedCostUsd,
        coGenerated: true,
        cleanProvider: cleanResult.providerId,
        cleanAspectRatio: veoAspect,
        originalSize: materials.size,
        // Phase B.3: cron が provider.run() に渡せるよう保存
        negativePrompt: veoPrompts.negativePrompt,
      },
    },
    select: { id: true },
  });

  return {
    videoId: video.id,
    cleanBlobUrl: blob.url,
    veoAspectRatio: veoAspect,
    estimatedCostUsd,
  };
}
