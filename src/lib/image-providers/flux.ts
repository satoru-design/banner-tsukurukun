import Replicate from 'replicate';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
} from './types';
import { buildBakeTextInstruction } from './prompt-helpers';

const FLUX_TEXT_MODEL = 'black-forest-labs/flux-1.1-pro';
const FLUX_KONTEXT_MODEL = 'black-forest-labs/flux-kontext-pro';
const ALLOWED_HOSTS = ['replicate.delivery', 'pbxt.replicate.delivery'];

function ensureKey(): string {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) {
    throw new ImageProviderError('flux', 'REPLICATE_API_TOKEN is not set');
  }
  return key;
}

function aspectToFluxArgs(ratio: GenerateParams['aspectRatio']): { aspect_ratio: string } {
  const map: Record<GenerateParams['aspectRatio'], string> = {
    '1:1': '1:1',
    '16:9': '16:9',
    '9:16': '9:16',
  };
  return { aspect_ratio: map[ratio] };
}

type ReplicateOutput = unknown;

function extractUrl(output: ReplicateOutput): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof (first as { url?: unknown }).url === 'function') {
      const u = (first as { url: () => string | URL }).url();
      return typeof u === 'string' ? u : u.toString();
    }
    if (first && typeof (first as { url?: unknown }).url === 'string') {
      return (first as { url: string }).url;
    }
  } else if (output && typeof (output as { url?: unknown }).url === 'function') {
    const u = (output as { url: () => string | URL }).url();
    return typeof u === 'string' ? u : u.toString();
  }
  return null;
}

async function downloadAsBase64(
  url: string,
  signal: AbortSignal,
): Promise<{ base64: string; contentType: string }> {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !ALLOWED_HOSTS.some((d) => parsed.hostname.endsWith(d))
  ) {
    throw new ImageProviderError('flux', `Untrusted image URL host: ${parsed.hostname}`);
  }

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new ImageProviderError('flux', `Failed to fetch result image: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  const contentType = res.headers.get('content-type') ?? 'image/png';
  return { base64: b64, contentType };
}

/**
 * Reference 画像なしパス: FLUX 1.1 pro（text-to-image、従来互換）
 */
async function generateTextOnly(
  replicate: Replicate,
  params: GenerateParams,
  signal: AbortSignal,
): Promise<GenerateResult> {
  const bakeInstruction = params.copyBundle
    ? `\n\n${buildBakeTextInstruction(params.copyBundle)}`
    : '';
  const finalPrompt = `${params.prompt}${bakeInstruction}`;

  const input = {
    prompt: finalPrompt,
    ...aspectToFluxArgs(params.aspectRatio),
    output_format: 'png',
    safety_tolerance: 2,
    ...(params.seed !== undefined ? { seed: params.seed } : {}),
  };

  const output = await replicate.run(FLUX_TEXT_MODEL, { input, signal });
  const url = extractUrl(output);
  if (!url) {
    throw new ImageProviderError(
      'flux',
      `Unexpected output shape: ${JSON.stringify(output).slice(0, 200)}`,
    );
  }

  const { base64, contentType } = await downloadAsBase64(url, signal);

  return {
    base64: `data:${contentType};base64,${base64}`,
    providerId: 'flux',
    providerMetadata: {
      model: FLUX_TEXT_MODEL,
      aspectRatio: params.aspectRatio,
      seed: params.seed,
      sourceUrl: url,
      mode: 'text-only',
    },
  };
}

/**
 * Reference 画像ありパス: FLUX Kontext Pro（image-to-image、1枚参照）
 * 複数の参考画像が渡された場合は先頭1枚のみ利用（Kontext は単一参照のため）。
 */
async function generateWithReferences(
  replicate: Replicate,
  params: GenerateParams,
  signal: AbortSignal,
): Promise<GenerateResult> {
  const referenceImageUrls = params.referenceImageUrls ?? [];
  const primaryRef = referenceImageUrls[0];
  if (!primaryRef) {
    throw new ImageProviderError('flux', 'referenceImageUrls empty in reference mode');
  }

  const bakeInstruction = params.copyBundle
    ? `\n\n${buildBakeTextInstruction(params.copyBundle)}`
    : '';

  const kontextPrompt =
    `Match the advertising style, Japanese typography, color palette, layout, and badge/CTA design of the reference image. ` +
    `Generate a new banner that follows these guidelines: ${params.prompt}${bakeInstruction}`;

  const input = {
    input_image: primaryRef,
    prompt: kontextPrompt,
    ...aspectToFluxArgs(params.aspectRatio),
    output_format: 'png',
    safety_tolerance: 2,
    ...(params.seed !== undefined ? { seed: params.seed } : {}),
  };

  const output = await replicate.run(FLUX_KONTEXT_MODEL, { input, signal });
  const url = extractUrl(output);
  if (!url) {
    throw new ImageProviderError(
      'flux',
      `Unexpected Kontext output shape: ${JSON.stringify(output).slice(0, 200)}`,
    );
  }

  const { base64, contentType } = await downloadAsBase64(url, signal);

  return {
    base64: `data:${contentType};base64,${base64}`,
    providerId: 'flux',
    providerMetadata: {
      model: FLUX_KONTEXT_MODEL,
      aspectRatio: params.aspectRatio,
      seed: params.seed,
      sourceUrl: url,
      mode: 'references',
      referenceCount: referenceImageUrls.length,
      referenceUsed: 1,
    },
  };
}

export const fluxProvider: ImageProvider = {
  id: 'flux',
  displayName: 'FLUX 1.1 pro / Kontext Pro',

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const replicate = new Replicate({ auth: ensureKey() });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    const hasRefs = (params.referenceImageUrls?.length ?? 0) > 0;
    try {
      return hasRefs
        ? await generateWithReferences(replicate, params, controller.signal)
        : await generateTextOnly(replicate, params, controller.signal);
    } catch (err) {
      if (err instanceof ImageProviderError) throw err;
      throw new ImageProviderError(
        'flux',
        err instanceof Error ? err.message : 'Unknown error',
        err,
      );
    } finally {
      clearTimeout(timer);
    }
  },
};
