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
日本市場向け LP のファーストビュー画像を生成してください。広告クリエイティブとして「目を引き、商品の世界観を伝える」ことが目的です。

# 商材
${brief.productName}
${brief.industryCategory ? `業種: ${brief.industryCategory}` : ''}
${brief.usp ? `USP: ${brief.usp.slice(0, 200)}` : ''}

# ターゲット
${brief.target}

# 「AI 生成画像っぽさ」絶対禁止ルール (最重要)

## 禁止する陳腐な構図・モチーフ
- 禅・石積み (cairn / zen stones)
- 湖畔・朝日・霧・自然のヒーリングシーン
- 抽象的な手・指・植物の組み合わせ
- 「Wellness」「Mindfulness」感のあるステレオタイプ画像
- グラデーション背景に半透明オブジェクトのみの抽象画
- "高品質" "上質" "プレミアム" 感だけの空疎な雰囲気画像

## 推奨する構図
- ターゲットの「具体的な生活シーン」を切り取る (商品が登場しないでも、ターゲットの 1 日の場面)
- 例: 朝の鏡前、キッチンでの 1 杯、デスクで仕事中、休日のリビング
- ターゲットの感情が伝わる「光と陰影」の使い方
- 業種に応じた具体的環境 (コスメ→ドレッサー、SaaS→オフィス、食品→食卓)
- リアルな素材感 (布・紙・木・金属の質感)

## 厳守ルール
- 写実的な実在人物の顔は生成禁止（モデル素材は別途ユーザーが用意）。手・後ろ姿・横顔のみ可
- 余白を残し、テキストオーバーレイ用にコピー領域を空ける（左 1/3 or 上 1/3 を空けるのが理想）
- 日本人ターゲットなら日本的な小物・空間を含む（畳・障子・湯呑等のステレオタイプではなく、日本のリアルな家庭環境）
- 文字を画像内に描画しない（後でコピーを HTML でオーバーレイ）
- ブランドの品格を保つ高解像度
`.trim();
}
