/**
 * POST /api/suggest-video-prompt
 *  Phase B.1 動画化ダイアログの「AI に書いてもらう」用エンドポイント。
 *  バナー画像 + (任意) ブリーフ情報を Claude Sonnet 4.6 vision に渡し、
 *  日本語で動きの指示文を1案生成して返す。
 *
 * 入力: { inputImageUrl, generationId? }
 * 出力: { promptJa: string }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_IMAGE_HOSTS = ['public.blob.vercel-storage.com'];

function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

const SYSTEM_PROMPT = `あなたは広告動画ディレクター。
ユーザーから渡されるバナー画像を見て、それを5〜8秒のリール広告動画に動画化するための「動きの指示」を日本語で1つだけ提案する。

ルール:
- 文章は1〜2文。最大100文字。
- 「カメラがゆっくりズームアウトしながら」「左から右にパン」「微風で髪が揺れる」など、具体的なカメラワークと被写体の動きを必ず含める。
- 画像内の文字（コピー、価格、CTA）は動かさず、被写体・背景・カメラだけ動かす指示にする。
- 不自然な動きや過剰な変化は避ける。
- 出力は JSON ではなく、提案文章のみ1行で出力。前置きや説明は不要。`;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.plan !== 'admin') {
      return NextResponse.json(
        { error: '動画化は現在 admin 限定 (β)' },
        { status: 403 },
      );
    }

    const body = (await req.json()) as {
      inputImageUrl?: string;
      generationId?: string;
    };

    const inputImageUrl = body.inputImageUrl?.trim();
    if (!inputImageUrl || !isAllowedImageUrl(inputImageUrl)) {
      return NextResponse.json(
        { error: 'Valid inputImageUrl is required (Vercel Blob host only)' },
        { status: 400 },
      );
    }

    // ブリーフ情報を取得 (商品名・ターゲット・コピーをコンテキストに)
    let briefContext = '';
    if (body.generationId) {
      const prisma = getPrisma();
      const gen = await prisma.generation.findUnique({
        where: { id: body.generationId },
        select: { userId: true, briefSnapshot: true },
      });
      if (gen && gen.userId === session.user.id) {
        const b = (gen.briefSnapshot as Record<string, unknown>) ?? {};
        briefContext = [
          b.product ? `商品: ${b.product}` : '',
          b.target ? `ターゲット: ${b.target}` : '',
          Array.isArray(b.copies) && b.copies[0] ? `メインコピー: ${b.copies[0]}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }
    }

    // 画像を fetch して base64 化 (Anthropic vision 入力)
    const imgRes = await fetch(inputImageUrl);
    if (!imgRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${imgRes.status}` },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const mimeType = imgRes.headers.get('content-type') || 'image/png';
    const base64 = buf.toString('base64');

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 },
      );
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userText = briefContext
      ? `以下のバナー画像を動画化する指示を1つ提案してください。\n\n参考情報:\n${briefContext}`
      : 'このバナー画像を動画化する指示を1つ提案してください。';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
                data: base64,
              },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    const promptJa = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

    if (!promptJa) {
      return NextResponse.json(
        { error: 'AI returned empty suggestion' },
        { status: 500 },
      );
    }

    return NextResponse.json({ promptJa });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('suggest-video-prompt error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
