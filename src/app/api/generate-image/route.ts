import { NextResponse } from 'next/server';
import {
  ImageProviderId,
  AspectRatio,
  generateWithFallback,
} from '@/lib/image-providers';
import { loadStyleProfile, injectIntoImagePrompt } from '@/lib/style-profile/injector';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_PROVIDERS: ImageProviderId[] = ['imagen4', 'flux', 'gpt-image'];
const VALID_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16'];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string | undefined = body.prompt;
    const providerRaw: string = body.provider ?? 'imagen4';
    const ratioRaw: string = body.aspectRatio ?? '1:1';
    const seed: number | undefined =
      typeof body.seed === 'number' ? body.seed : undefined;
    const negativePrompt: string | undefined = body.negativePrompt;
    const styleProfileId: string | null | undefined = body.styleProfileId;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const provider = VALID_PROVIDERS.includes(providerRaw as ImageProviderId)
      ? (providerRaw as ImageProviderId)
      : 'imagen4';
    const aspectRatio = VALID_RATIOS.includes(ratioRaw as AspectRatio)
      ? (ratioRaw as AspectRatio)
      : '1:1';

    const styleProfile = await loadStyleProfile(styleProfileId);
    const extendedPrompt = injectIntoImagePrompt(prompt, styleProfile);

    const result = await generateWithFallback(provider, {
      prompt: extendedPrompt,
      aspectRatio,
      seed,
      negativePrompt,
    });

    return NextResponse.json({
      imageUrl: result.base64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    console.error('API Error (generate-image):', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
