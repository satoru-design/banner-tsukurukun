import { GoogleGenAI } from '@google/genai';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
} from './types';

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

export const imagen4Provider: ImageProvider = {
  id: 'imagen4',
  displayName: 'Google Imagen 4 Ultra',

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const ai = new GoogleGenAI({ apiKey: ensureKey() });
    try {
      // NOTE: AI Studio 経由の Imagen 4 は seed パラメータ非対応のため渡さない。
      // 再現性のある生成が必要な場合は FLUX 1.1 pro を選択すること。
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-ultra-generate-001',
        prompt: params.prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: params.aspectRatio,
          ...(params.negativePrompt
            ? { negativePrompt: params.negativePrompt }
            : {}),
        },
      });

      const firstImage = response.generatedImages?.[0];
      const bytes = firstImage?.image?.imageBytes;
      const mimeType = firstImage?.image?.mimeType ?? 'image/png';
      if (!bytes) {
        throw new ImageProviderError(
          'imagen4',
          'No image bytes returned from Imagen 4',
        );
      }

      return {
        base64: `data:${mimeType};base64,${bytes}`,
        providerId: 'imagen4',
        providerMetadata: {
          model: 'imagen-4.0-ultra-generate-001',
          aspectRatio: params.aspectRatio,
          seed: params.seed,
        },
      };
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
