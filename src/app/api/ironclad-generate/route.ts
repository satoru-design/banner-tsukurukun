import { NextResponse } from 'next/server';
import {
  buildIroncladImagePromptWithPrefix,
  SIZE_TO_API_IRONCLAD,
  type IroncladMaterials,
} from '@/lib/prompts/ironclad-banner';
import { generateWithFallback } from '@/lib/image-providers';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const materials = (await req.json()) as IroncladMaterials;

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

    const sizeMeta = SIZE_TO_API_IRONCLAD[materials.size];
    if (!sizeMeta) {
      return NextResponse.json({ error: `Unknown size: ${materials.size}` }, { status: 400 });
    }
    const aspectRatio = sizeMeta.aspectRatio;
    const apiSizeOverride = sizeMeta.apiSize;

    const finalPrompt = buildIroncladImagePromptWithPrefix(materials);

    // 参考画像URLを集約（商品画像・バッジ1・バッジ2）
    const referenceImageUrls = [
      materials.productImageUrl,
      materials.badgeImageUrl1,
      materials.badgeImageUrl2,
    ].filter((u): u is string => Boolean(u && u.trim()));

    // copyBundle: buildBakeTextInstruction 用。鉄板プロンプト本体にも同じ情報が入っているが
    // テキスト描画の強制力を高めるため二重で渡す。
    const copyBundle = {
      mainCopy: materials.copies[0],
      subCopy: materials.copies[1],
      ctaText: materials.cta,
      primaryBadgeText: materials.copies[2],
      secondaryBadgeText: materials.copies[3],
    };

    const result = await generateWithFallback('gpt-image', {
      prompt: finalPrompt,
      aspectRatio,
      apiSizeOverride,
      referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      // Ironclad: アップロードされた素材（商品画像・認証バッジ）をそのまま配置。改変禁止モード。
      referenceMode: 'composite',
      copyBundle,
    });

    return NextResponse.json({
      imageUrl: result.base64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
      promptPreview: finalPrompt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('ironclad-generate error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
