import OpenAI, { toFile } from 'openai';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
  AspectRatio,
} from './types';
import { buildBakeTextInstruction } from './prompt-helpers';

const IMAGE_MODEL = 'gpt-image-1';
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

/**
 * 参考画像なし: Images API の通常 generate
 */
async function generateTextOnly(
  openai: OpenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const size = toSize(params.aspectRatio);
  const bakeInstruction = params.copyBundle
    ? `${buildBakeTextInstruction(params.copyBundle)}\n\n---\n\n`
    : '';
  // 日本語テキスト指示を先頭に置き、prompt本体（補助）は後ろ
  const finalPrompt = `${bakeInstruction}[Visual direction (secondary)]\n${params.prompt}`;

  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: finalPrompt,
    size,
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
 * orchestrator を介さないため日本語テキスト指示がそのまま gpt-image-1 に届く。
 */
async function generateWithReferencesEdit(
  openai: OpenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const size = toSize(params.aspectRatio);
  const referenceImageUrls = params.referenceImageUrls ?? [];

  const bakeInstruction = params.copyBundle
    ? `${buildBakeTextInstruction(params.copyBundle)}\n\n---\n\n`
    : '';

  // 日本語テキスト指示を最前面に、visual direction は後方支援
  const finalPrompt =
    `${bakeInstruction}` +
    `[Style reference]\n以下の参考広告バナーと同等のクオリティ・世界観・タイポグラフィ・構図で、` +
    `完成バナーを1枚生成してください。参考画像のレイアウト・色使い・日本語フォント・バッジ/CTAスタイルを最優先。\n\n` +
    `[Visual direction (secondary)]\n${params.prompt}`;

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
      return toFile(buf, `ref-${idx}.${ext}`, { type: mime });
    }),
  );

  const response = await openai.images.edit({
    model: IMAGE_MODEL,
    image: files,
    prompt: finalPrompt,
    size,
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
      mode: 'references-edit',
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
  const size = toSize(params.aspectRatio);
  const referenceImageUrls = params.referenceImageUrls ?? [];

  const bakeInstruction = params.copyBundle
    ? `\n\n${buildBakeTextInstruction(params.copyBundle)}`
    : '';

  const userContent: Array<
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string; detail: 'high' }
  > = [
    {
      type: 'input_text',
      text:
        `以下の参考広告バナーと同等のクオリティ・世界観・タイポグラフィ・構図で、` +
        `指定プロンプトに沿った完成バナーを image_generation tool で 1 枚生成してください。\n\n` +
        `【プロンプト】\n${params.prompt}` +
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
    tools: [{ type: 'image_generation', size, quality: 'high' }],
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
  displayName: 'GPT Image (gpt-image-1)',

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
