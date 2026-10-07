import { NextResponse } from 'next/server';
import {
  ImageProviderId,
  AspectRatio,
  generateWithFallback,
} from '@/lib/image-providers';
import { loadStyleProfile, injectIntoImagePrompt } from '@/lib/style-profile/injector';
import { guardGeneration } from '@/lib/plans/generation-guard';
import { incrementUsage } from '@/lib/plans/usage';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_PROVIDERS: ImageProviderId[] = ['imagen4', 'flux', 'gpt-image'];
const VALID_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16'];

/** プロンプト長の上限。超過分はコストにしかならないので受け取る前に弾く。 */
const MAX_PROMPT_LENGTH = 4000;

export async function POST(req: Request) {
  // 従量課金 API を叩く前にログインと月次ハードキャップを確認する。
  // middleware の認証だけに依存すると、迂回された時点で無制限に課金される。
  const guard = await guardGeneration('generate-image');
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const prompt: string | undefined = body.prompt;
    const providerRaw: string = body.provider ?? 'imagen4';
    const ratioRaw: string = body.aspectRatio ?? '1:1';
    const seed: number | undefined =
      typeof body.seed === 'number' ? body.seed : undefined;
    const negativePrompt: string | undefined = body.negativePrompt;
    const styleProfileId: string | null | undefined = body.styleProfileId;
    const copyBundle: {
      mainCopy?: string;
      subCopy?: string;
      ctaText?: string;
      primaryBadgeText?: string;
      secondaryBadgeText?: string;
    } | undefined = body.copyBundle;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `prompt は ${MAX_PROMPT_LENGTH} 文字以内にしてください` },
        { status: 400 },
      );
    }
    if (negativePrompt !== undefined && typeof negativePrompt !== 'string') {
      return NextResponse.json({ error: 'negativePrompt must be a string' }, { status: 400 });
    }
    if (
      typeof negativePrompt === 'string' &&
      negativePrompt.length > MAX_PROMPT_LENGTH
    ) {
      return NextResponse.json(
        { error: `negativePrompt は ${MAX_PROMPT_LENGTH} 文字以内にしてください` },
        { status: 400 },
      );
    }

    const provider = VALID_PROVIDERS.includes(providerRaw as ImageProviderId)
      ? (providerRaw as ImageProviderId)
      : 'imagen4';
    const aspectRatio = VALID_RATIOS.includes(ratioRaw as AspectRatio)
      ? (ratioRaw as AspectRatio)
      : '1:1';

    const styleProfile = await loadStyleProfile(styleProfileId, guard.userId);
    const extendedPrompt = injectIntoImagePrompt(prompt, styleProfile);

    const result = await generateWithFallback(provider, {
      prompt: extendedPrompt,
      aspectRatio,
      seed,
      negativePrompt,
      referenceImageUrls: styleProfile?.referenceImageUrls,
      copyBundle,
    });

    // 生成が成功した分だけカウントする。カウントしないとハードキャップが動かず
    // 同じユーザーが無限にリクエストできてしまう。
    try {
      await incrementUsage(guard.userId);
    } catch (err) {
      console.error('[generate-image] incrementUsage failed:', err);
    }

    return NextResponse.json({
      imageUrl: result.base64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
    });
  } catch (error: unknown) {
    return internalErrorResponse('generate-image', error, '画像生成に失敗しました');
  }
}
