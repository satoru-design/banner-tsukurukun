import { GoogleGenAI } from '@google/genai';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
} from './types';

const IMAGEN_MODEL = 'imagen-4.0-ultra-generate-001';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

const GOOGLE_AI_KEY =
  process.env.GOOGLE_AI_STUDIO_API_KEY ||
  process.env.GEMINI_API_KEY ||
  '';

function ensureKey(): string {
  if (!GOOGLE_AI_KEY) {
    throw new ImageProviderError(
      'imagen4',
      'GOOGLE_AI_STUDIO_API_KEY (or GEMINI_API_KEY) is not set',
    );
  }
  return GOOGLE_AI_KEY;
}

/**
 * Reference 画像なしの Imagen 4 Ultra パス（従来互換）
 */
async function generateTextOnly(
  ai: GoogleGenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const response = await ai.models.generateImages({
    model: IMAGEN_MODEL,
    prompt: params.prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: params.aspectRatio,
      ...(params.negativePrompt ? { negativePrompt: params.negativePrompt } : {}),
    },
  });

  const firstImage = response.generatedImages?.[0];
  const bytes = firstImage?.image?.imageBytes;
  const mimeType = firstImage?.image?.mimeType ?? 'image/png';
  if (!bytes) {
    throw new ImageProviderError('imagen4', 'No image bytes returned from Imagen 4');
  }

  return {
    base64: `data:${mimeType};base64,${bytes}`,
    providerId: 'imagen4',
    providerMetadata: {
      model: IMAGEN_MODEL,
      aspectRatio: params.aspectRatio,
      mode: 'text-only',
      seedRequested: params.seed,
      seedApplied: false,
    },
  };
}

/**
 * Reference 画像あり → Gemini 2.5 Flash Image（multi-image input + generation）に切替。
 * StyleProfile の全参考画像を渡し、プロンプトは補助として使う。
 */
async function generateWithReferences(
  ai: GoogleGenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const referenceImageUrls = params.referenceImageUrls ?? [];

  const imageParts = await Promise.all(
    referenceImageUrls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new ImageProviderError(
          'imagen4',
          `Failed to fetch reference image ${url}: ${res.status}`,
        );
      }
      const buf = await res.arrayBuffer();
      const base64 = Buffer.from(buf).toString('base64');
      const mime = res.headers.get('content-type') ?? 'image/jpeg';
      return { inlineData: { data: base64, mimeType: mime } };
    }),
  );

  const instructionText =
    `以下の参考広告バナーと同等のクオリティ・世界観・タイポグラフィ・構図で、` +
    `指定プロンプトに沿った新規バナーを 1 枚生成してください。\n\n` +
    `【プロンプト】\n${params.prompt}\n\n` +
    `【重要】参考画像のレイアウト・色使い・日本語フォント・価格バッジ/CTA スタイルを最優先で模倣。` +
    `プロンプトは補助情報として扱ってください。aspect ratio: ${params.aspectRatio}.`;

  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [{ text: instructionText }, ...imageParts],
  });

  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  const b64 = imagePart?.inlineData?.data;
  const mimeType = imagePart?.inlineData?.mimeType ?? 'image/png';

  if (!b64) {
    throw new ImageProviderError(
      'imagen4',
      'No inline image data in Gemini 2.5 Flash Image response',
    );
  }

  return {
    base64: `data:${mimeType};base64,${b64}`,
    providerId: 'imagen4',
    providerMetadata: {
      model: GEMINI_IMAGE_MODEL,
      aspectRatio: params.aspectRatio,
      mode: 'references',
      referenceCount: referenceImageUrls.length,
    },
  };
}

export const imagen4Provider: ImageProvider = {
  id: 'imagen4',
  displayName: 'Google Imagen 4 Ultra / Gemini 2.5 Flash Image',

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const ai = new GoogleGenAI({ apiKey: ensureKey() });
    const hasRefs = (params.referenceImageUrls?.length ?? 0) > 0;

    try {
      return hasRefs
        ? await generateWithReferences(ai, params)
        : await generateTextOnly(ai, params);
    } catch (err) {
      if (err instanceof ImageProviderError) throw err;
      throw new ImageProviderError(
        'imagen4',
        err instanceof Error ? err.message : 'Unknown error',
        err,
      );
    }
  },
};
