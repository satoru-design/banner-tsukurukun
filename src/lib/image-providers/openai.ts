import OpenAI, { toFile } from 'openai';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
  AspectRatio,
} from './types';
import { buildBakeTextInstruction } from './prompt-helpers';

// gpt-image-2: 日本語テキスト描画・商品画像忠実性・権威バッジ再現性が gpt-image-1 比で大幅改善。
// 組織認証（Business verification）済みアカウントのみアクセス可能。
const IMAGE_MODEL = 'gpt-image-2';
// gpt-5 は orchestrator として要約が強くプロンプトを崩すため gpt-4o を使用。
// gpt-4o は ChatGPT Web の画像生成で実績があり、プロンプト保存性が高い。
const ORCHESTRATOR_MODEL = 'gpt-4o';

function ensureKey(): string {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) {
    throw new ImageProviderError('gpt-image', 'OPENAI_API_KEY is not set');
  }
  return key;
}

function toSize(ratio: AspectRatio): string {
  switch (ratio) {
    case '1:1':
      return '1024x1024';
    case '9:16':
      return '1024x1536';
    case '16:9':
      return '1536x1024';
  }
}

/**
 * apiSizeOverride が渡されればそれを優先、なければ aspectRatio から 3 サイズにマップ。
 * gpt-image-2 は柔軟サイズ対応（16px倍数・≤3:1・総ピクセル 655,360〜8,294,400）。
 */
function resolveApiSize(params: GenerateParams): string {
  if (params.apiSizeOverride && /^\d+x\d+$/.test(params.apiSizeOverride)) {
    return params.apiSizeOverride;
  }
  return toSize(params.aspectRatio);
}

/**
 * 参考画像なし: Images API の通常 generate
 */
async function generateTextOnly(
  openai: OpenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const size = resolveApiSize(params);
  const bakeInstruction = params.copyBundle
    ? `${buildBakeTextInstruction(params.copyBundle)}\n\n---\n\n`
    : '';
  // 日本語テキスト指示を先頭に置き、prompt本体（補助）は後ろ
  const finalPrompt = `${bakeInstruction}[Visual direction (secondary)]\n${params.prompt}`;

  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: finalPrompt,
    // gpt-image-2 は柔軟サイズ対応だが SDK 型が古い union に限定されているためキャスト
    size: size as '1024x1024',
    quality: 'high',
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new ImageProviderError('gpt-image', 'No image data returned from Images API');
  }

  return {
    base64: `data:image/png;base64,${b64}`,
    providerId: 'gpt-image',
    providerMetadata: {
      model: IMAGE_MODEL,
      size,
      aspectRatio: params.aspectRatio,
      mode: 'text-only',
    },
  };
}

/**
 * 参考画像あり: images.edit() エンドポイントを使用。
 * ChatGPT Web の "Upload reference images then generate" と同等の公式パス。
 * orchestrator を介さないため日本語テキスト指示がそのまま gpt-image-2 に届く。
 */
async function generateWithReferencesEdit(
  openai: OpenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const size = resolveApiSize(params);
  const referenceImageUrls = params.referenceImageUrls ?? [];

  // 参考画像の扱い方をモード分岐
  // - 'composite': 素材ライブラリから渡された商品画像・認証バッジを「そのまま配置」するモード（Ironclad 用途）
  // - 'style' (default): StyleProfile 由来のリファレンスを「世界観テンプレ」として模倣するモード
  const mode = params.referenceMode ?? 'style';

  // テキスト描画指示。composite モードではプロンプト容量を節約して素材固定指示を優先。
  const bakeInstruction = params.copyBundle
    ? mode === 'composite'
      ? `${buildBakeTextInstruction(params.copyBundle)}\n\n---\n\n`
      : `${buildBakeTextInstruction(params.copyBundle)}\n\n---\n\n`
    : '';

  let finalPrompt: string;

  if (mode === 'composite') {
    // 🚨 composite モード: 添付画像を「絶対に改変しない素材」として扱う
    // プロンプトの最前面に強烈な指示を置き、かつ末尾でもリマインドする (bookend戦略)。
    const compositeHeader =
      `🚨🚨🚨 CRITICAL IMAGE PRESERVATION RULES 🚨🚨🚨\n\n` +
      `INPUT_IMAGES: ${referenceImageUrls.length} image(s) are attached below as INPUT ASSETS.\n\n` +
      `RULE 1 (ABSOLUTE): The attached images ARE the actual product and badge assets.\n` +
      `  You MUST place them in the output banner EXACTLY as provided.\n` +
      `  DO NOT generate a new product container, package, or bottle.\n` +
      `  DO NOT redraw, re-sketch, re-illustrate, re-imagine, or re-brand.\n` +
      `  DO NOT change pouch to bottle, bottle to pouch, or any container shape.\n` +
      `  DO NOT change label text, brand name spelling, logo, color, cap, proportions.\n\n` +
      `RULE 2: Compose the banner AROUND the provided assets. Only generate:\n` +
      `  - Background (models, scenery, splash, gradient, color blocks)\n` +
      `  - Japanese text (headlines, badges as text, CTA button)\n` +
      `  - Decorative elements (arrows, lines, shapes)\n\n` +
      `RULE 3: Lighting / shadow adjustments on the pasted assets are OK.\n` +
      `  Cropping a portion is OK. Changing form/color/text is FORBIDDEN.\n\n` +
      `RULE 4: If no badge image is attached, DO NOT add a fake certification badge.\n` +
      `  If no product image is attached, DO NOT invent a product visual.\n\n` +
      `---\n\n`;

    const compositeFooter =
      `\n\n---\n\n🚨 FINAL CHECK before output:\n` +
      `- Is the product container in the output IDENTICAL to the attached image? If not, FIX IT.\n` +
      `- Are attached badges used as-is (no redrawing)? If not, FIX IT.\n` +
      `- Did you invent any product / badge / certification not in attachments? If yes, REMOVE IT.\n`;

    finalPrompt =
      compositeHeader +
      bakeInstruction +
      `[Banner brief]\n${params.prompt}` +
      compositeFooter;
  } else {
    finalPrompt =
      bakeInstruction +
      `[Style reference]\n以下の参考広告バナーと同等のクオリティ・世界観・タイポグラフィ・構図で、` +
      `完成バナーを1枚生成してください。参考画像のレイアウト・色使い・日本語フォント・バッジ/CTAスタイルを最優先。\n\n` +
      `[Visual direction]\n${params.prompt}`;
  }

  // URL から File オブジェクトを生成（OpenAI SDK の toFile ヘルパー）
  const files = await Promise.all(
    referenceImageUrls.slice(0, 10).map(async (url, idx) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new ImageProviderError(
          'gpt-image',
          `Failed to fetch reference image ${url}: ${res.status}`,
        );
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') ?? 'image/jpeg';
      const ext = mime.split('/')[1]?.split(';')[0] ?? 'jpg';
      console.log(
        `[gpt-image] ref#${idx}: url=${url.slice(0, 80)}... mime=${mime} bytes=${buf.byteLength}`,
      );
      return toFile(buf, `ref-${idx}.${ext}`, { type: mime });
    }),
  );

  console.log(
    `[gpt-image] calling images.edit: mode=${mode} files=${files.length} size=${size} promptLength=${finalPrompt.length}`,
  );

  const response = await openai.images.edit({
    model: IMAGE_MODEL,
    image: files,
    prompt: finalPrompt,
    // gpt-image-2 柔軟サイズのため SDK の古い union 型をキャスト
    size: size as '1024x1024',
    quality: 'high',
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new ImageProviderError('gpt-image', 'No image data returned from images.edit()');
  }

  return {
    base64: `data:image/png;base64,${b64}`,
    providerId: 'gpt-image',
    providerMetadata: {
      model: IMAGE_MODEL,
      size,
      aspectRatio: params.aspectRatio,
      mode: `references-edit-${mode}`,
      referenceCount: referenceImageUrls.length,
    },
  };
}

/**
 * Fallback: Responses API + image_generation tool with gpt-4o orchestrator.
 * images.edit() が失敗した場合のみ使用。
 */
async function generateWithReferencesResponses(
  openai: OpenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const size = resolveApiSize(params);
  const referenceImageUrls = params.referenceImageUrls ?? [];

  const bakeInstruction = params.copyBundle
    ? `\n\n${buildBakeTextInstruction(params.copyBundle)}`
    : '';

  const mode = params.referenceMode ?? 'style';
  const fallbackInstruction =
    mode === 'composite'
      ? `添付された画像は実在の商品画像・認証バッジです。これらを「そのままの素材」として完成バナーに配置してください。` +
        `商品の容器形状・ラベル文字・ロゴ・色・ブランド名を絶対に改変しないこと。新規生成も禁止。\n\n` +
        `指定プロンプトに沿って背景と構図を組み立て、添付素材を改変せず合成した完成バナーを image_generation tool で 1 枚生成してください。`
      : `以下の参考広告バナーと同等のクオリティ・世界観・タイポグラフィ・構図で、` +
        `指定プロンプトに沿った完成バナーを image_generation tool で 1 枚生成してください。`;

  const userContent: Array<
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string; detail: 'high' }
  > = [
    {
      type: 'input_text',
      text:
        fallbackInstruction +
        `\n\n【プロンプト】\n${params.prompt}` +
        bakeInstruction,
    },
    ...referenceImageUrls.map(
      (url) =>
        ({ type: 'input_image', image_url: url, detail: 'high' }) as const,
    ),
  ];

  const response = await openai.responses.create({
    model: ORCHESTRATOR_MODEL,
    input: [{ role: 'user', content: userContent }],
    // SDK の size union 型を柔軟サイズ対応のためキャスト
    tools: [{ type: 'image_generation', size: size as '1024x1024', quality: 'high' }],
  });

  const outputItems = (response.output ?? []) as unknown as Array<{
    type?: string;
    result?: string;
  }>;
  const imageCall = outputItems.find((item) => item?.type === 'image_generation_call');
  const b64 = imageCall?.result;
  if (!b64) {
    throw new ImageProviderError(
      'gpt-image',
      'No image_generation_call result in Responses API output',
    );
  }

  return {
    base64: `data:image/png;base64,${b64}`,
    providerId: 'gpt-image',
    providerMetadata: {
      model: IMAGE_MODEL,
      orchestrator: ORCHESTRATOR_MODEL,
      size,
      aspectRatio: params.aspectRatio,
      mode: 'references-responses',
      referenceCount: referenceImageUrls.length,
    },
  };
}

export const gptImageProvider: ImageProvider = {
  id: 'gpt-image',
  displayName: 'GPT Image (gpt-image-2)',

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const openai = new OpenAI({ apiKey: ensureKey() });
    const hasRefs = (params.referenceImageUrls?.length ?? 0) > 0;

    if (!hasRefs) {
      try {
        return await generateTextOnly(openai, params);
      } catch (err) {
        if (err instanceof ImageProviderError) throw err;
        throw new ImageProviderError(
          'gpt-image',
          err instanceof Error ? err.message : 'Unknown error',
          err,
        );
      }
    }

    // Refs あり: まず images.edit() を試す（orchestrator bypass のため日本語品質高い）
    try {
      return await generateWithReferencesEdit(openai, params);
    } catch (editErr) {
      console.warn(
        '[gpt-image] images.edit() failed, falling back to Responses API:',
        editErr instanceof Error ? editErr.message : editErr,
      );
      try {
        return await generateWithReferencesResponses(openai, params);
      } catch (respErr) {
        if (respErr instanceof ImageProviderError) throw respErr;
        throw new ImageProviderError(
          'gpt-image',
          respErr instanceof Error ? respErr.message : 'Unknown error',
          respErr,
        );
      }
    }
  },
};
