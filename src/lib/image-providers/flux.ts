import Replicate from 'replicate';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
} from './types';

function ensureKey(): string {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) {
    throw new ImageProviderError('flux', 'REPLICATE_API_TOKEN is not set');
  }
  return key;
}

function aspectToFluxArgs(ratio: GenerateParams['aspectRatio']): {
  aspect_ratio: string;
} {
  const map: Record<GenerateParams['aspectRatio'], string> = {
    '1:1': '1:1',
    '16:9': '16:9',
    '9:16': '9:16',
  };
  return { aspect_ratio: map[ratio] };
}

export const fluxProvider: ImageProvider = {
  id: 'flux',
  displayName: 'Replicate FLUX 1.1 pro',

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const replicate = new Replicate({ auth: ensureKey() });
    try {
      const input = {
        prompt: params.prompt,
        ...aspectToFluxArgs(params.aspectRatio),
        output_format: 'png',
        safety_tolerance: 2,
        ...(params.seed !== undefined ? { seed: params.seed } : {}),
      };

      const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
        input,
      });

      // replicate.run() may return a string URL, an array of URLs, or a
      // FileOutput-like object exposing a .url() method (Replicate SDK >= 1.x).
      let url: string | null = null;
      if (typeof output === 'string') {
        url = output;
      } else if (Array.isArray(output)) {
        const first = output[0];
        if (typeof first === 'string') {
          url = first;
        } else if (first && typeof (first as { url?: unknown }).url === 'function') {
          const u = (first as { url: () => string | URL }).url();
          url = typeof u === 'string' ? u : u.toString();
        } else if (first && typeof (first as { url?: unknown }).url === 'string') {
          url = (first as { url: string }).url;
        }
      } else if (output && typeof (output as { url?: unknown }).url === 'function') {
        const u = (output as { url: () => string | URL }).url();
        url = typeof u === 'string' ? u : u.toString();
      }

      if (!url) {
        throw new ImageProviderError(
          'flux',
          `Unexpected output shape: ${JSON.stringify(output).slice(0, 200)}`,
        );
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new ImageProviderError(
          'flux',
          `Failed to fetch result image: ${res.status}`,
        );
      }
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      const contentType = res.headers.get('content-type') ?? 'image/png';

      return {
        base64: `data:${contentType};base64,${b64}`,
        providerId: 'flux',
        providerMetadata: {
          model: 'black-forest-labs/flux-1.1-pro',
          aspectRatio: params.aspectRatio,
          seed: params.seed,
          sourceUrl: url,
        },
      };
    } catch (err) {
      if (err instanceof ImageProviderError) throw err;
      throw new ImageProviderError(
        'flux',
        err instanceof Error ? err.message : 'Unknown error',
        err,
      );
    }
  },
};
