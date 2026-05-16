/**
 * LP Maker Pro 2.0 — KV / セクション画像生成 (D5 Task 6)
 *
 * gpt-image-2 で LP のヒーロー画像 (KV) を生成し、Vercel Blob に保存する。
 *
 * - Phase 1: KV (1536x1024) 1 枚のみ。セクション別画像は Phase 2 で追加。
 * - 既存パターン参考: src/lib/image-providers/openai.ts (gpt-image-2 呼び出し),
 *   src/lib/generations/blob-client.ts (@vercel/blob put 呼び出し)。
 */
import OpenAI from 'openai';
import { put } from '@vercel/blob';
import type { LpBrief } from './types';

function ensureOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return key;
}

function ensureBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  return token;
}

/**
 * LP の KV（ヒーロー画像）を gpt-image-2 で生成し Vercel Blob に保存。
 *
 * Phase 1: KV 1 枚のみ。セクション別画像は Phase 2 で追加。
 */
export async function generateKvImage(args: {
  brief: LpBrief;
  landingPageId: string;
}): Promise<{ kvImageUrl: string }> {
  const openai = new OpenAI({ apiKey: ensureOpenAiKey() });
  const token = ensureBlobToken();

  const prompt = buildKvPrompt(args.brief);

  console.log('[image-generator] generating KV for', args.landingPageId);

  const result = await openai.images.generate({
    model: 'gpt-image-2',
    prompt,
    // gpt-image-2 は柔軟サイズ対応だが SDK 型が古い union に限定されているためキャスト
    size: '1536x1024' as '1024x1024',
    quality: 'medium',
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('gpt-image-2 returned no image');
  }

  const buffer = Buffer.from(b64, 'base64');
  const blob = await put(
    `lp-maker/${args.landingPageId}/kv.png`,
    buffer,
    {
      access: 'public',
      contentType: 'image/png',
      token,
    },
  );

  return { kvImageUrl: blob.url };
}

function buildKvPrompt(brief: LpBrief): string {
  return `
高品質な日本市場向け LP のファーストビュー（ヒーロー）画像を生成してください。

# 商材
${brief.productName}

# ターゲット
${brief.target}

# 厳守ルール
- 写実的な実在人物の生成は禁止（モデル素材は別途ユーザーが用意）
- 抽象的・印象的なシーン、商品の世界観を表現する背景画像
- 余白を残し、テキストオーバーレイ用にコピー領域を空ける
- 日本市場向けの色彩・トーン
- 文字を画像内に描画しない（後でコピーを HTML でオーバーレイするため）
- ブランドの品格を保つ高解像度な仕上がり
`.trim();
}
