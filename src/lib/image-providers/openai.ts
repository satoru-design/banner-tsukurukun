import OpenAI from 'openai';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
  AspectRatio,
} from './types';

const MODEL = 'gpt-image-1';

function ensureKey(): string {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) {
    throw new ImageProviderError('gpt-image', 'OPENAI_API_KEY is not set');
  }
  return key;
}

function toSize(ratio: AspectRatio): '1024x1024' | '1024x1536' | '1536x1024' {
  switch (ratio) {
    case '1:1':
      return '1024x1024';
    case '9:16':
      return '1024x1536';
    case '16:9':
      return '1536x1024';
  }
}

export const gptImageProvider: ImageProvider = {
  id: 'gpt-image',
  displayName: 'GPT Image (gpt-image-1)',

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const openai = new OpenAI({ apiKey: ensureKey() });
    const size = toSize(params.aspectRatio);

    try {
      const response = await openai.images.generate({
        model: MODEL,
        prompt: params.prompt,
        size,
        quality: 'high',
        n: 1,
      });

      const first = response.data?.[0];
      const b64 = first?.b64_json;
      if (!b64) {
        throw new ImageProviderError(
          'gpt-image',
          'No image data returned from OpenAI',
        );
      }

      return {
        base64: `data:image/png;base64,${b64}`,
        providerId: 'gpt-image',
        providerMetadata: {
          model: MODEL,
          size,
          aspectRatio: params.aspectRatio,
          seedRequested: params.seed,
          seedApplied: false,
        },
      };
    } catch (err) {
      if (err instanceof ImageProviderError) throw err;
      throw new ImageProviderError(
        'gpt-image',
        err instanceof Error ? err.message : 'Unknown error',
        err,
      );
    }
  },
};
