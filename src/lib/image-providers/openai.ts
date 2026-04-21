import OpenAI from 'openai';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
  AspectRatio,
} from './types';

const IMAGE_MODEL = 'gpt-image-1';
const ORCHESTRATOR_MODEL = 'gpt-5';

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
 * Reference 画像なしのシンプル生成（Images API）
 */
async function generateTextOnly(
  openai: OpenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const size = toSize(params.aspectRatio);
  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: params.prompt,
    size,
    quality: 'high',
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new ImageProviderError('gpt-image', 'No image data returned from OpenAI Images API');
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
 * Reference 画像あり生成（Responses API + image_generation tool）
 * ChatGPT Web 相当の挙動: GPT-5 が参考画像を見て詳細プロンプトを内部生成 → gpt-image-1 を tool 呼び出し
 */
async function generateWithReferences(
  openai: OpenAI,
  params: GenerateParams,
): Promise<GenerateResult> {
  const size = toSize(params.aspectRatio);
  const referenceImageUrls = params.referenceImageUrls ?? [];

  const userContent: Array<
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string; detail: 'high' }
  > = [
    {
      type: 'input_text',
      text:
        `以下の参考広告バナーと同等のクオリティ・世界観・タイポグラフィ・構図で、` +
        `指定プロンプトに沿った新規バナーを image_generation tool で 1 枚生成してください。\n\n` +
        `【プロンプト】\n${params.prompt}\n\n` +
        `【重要】参考画像のレイアウト・色使い・日本語フォント・価格バッジ/CTA スタイルを最優先で模倣。` +
        `プロンプトは補助情報として扱ってください。`,
    },
    ...referenceImageUrls.map(
      (url) =>
        ({ type: 'input_image', image_url: url, detail: 'high' }) as const,
    ),
  ];

  const response = await openai.responses.create({
    model: ORCHESTRATOR_MODEL,
    input: [{ role: 'user', content: userContent }],
    tools: [
      {
        type: 'image_generation',
        size,
        quality: 'high',
      },
    ],
  });

  // Responses API の output 配列から image_generation_call の結果を取り出す
  // SDK の型には image_generation_call variant が含まれていないため unknown 経由で narrow する。
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
      mode: 'references',
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

    try {
      return hasRefs
        ? await generateWithReferences(openai, params)
        : await generateTextOnly(openai, params);
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
