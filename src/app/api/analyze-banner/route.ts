import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { sniffImageMime } from '@/lib/uploads/image-validation';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/** Gemini vision に投げる画像の上限。大きいほど課金が増えるので route で弾く。 */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  // Gemini 2.5 Pro vision を呼ぶ従量課金 route なので route 側でもログインを必須にする。
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // 実体が画像であること、サイズが上限以内であることを確認する。
    let decoded: Buffer;
    try {
      decoded = Buffer.from(base64Data, 'base64');
    } catch {
      return NextResponse.json({ error: 'Image data is not valid base64' }, { status: 400 });
    }
    if (decoded.byteLength === 0) {
      return NextResponse.json({ error: 'Image data is empty' }, { status: 400 });
    }
    if (decoded.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `画像サイズが上限 (${MAX_IMAGE_BYTES / 1024 / 1024}MB) を超えています` },
        { status: 400 },
      );
    }
    const sniffedMime = sniffImageMime(decoded);
    if (!sniffedMime) {
      return NextResponse.json(
        { error: '画像ファイルとして認識できませんでした' },
        { status: 400 },
      );
    }

    const prompt = `
あなたは世界最高峰のダイレクトレスポンス・クリエイティブディレクターです。
提供されたバナー画像（過去の高成果バナー、または競合のバナー）を精読し、以下のポイントをJSONフォーマットで構造化して回答してください。
Markdownブロックなどを含めず、JSON形式のみ出力してください。

【出力キー】
- "dominant_emotion": このバナーがターゲットに抱かせる主要な感情（例：危機感、安心感）
- "main_appeal": メインの訴求ポイント・切り口（例：価格、簡便さ、実績）
- "demographic_prediction": 予測されるターゲット層・デモグラフィック属性（年齢層、性別、ライフスタイル等）
- "visual_layout": 画像の構図や配色の特徴
- "insight": なぜこのバナーが効果的だと考えられるか
- "counter_strategy": これを上回る（競合を出し抜く、またはこの知恵を活用する）ためのアイディア
`;

    const generateResponse = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          inlineData: {
            mimeType: sniffedMime,
            data: base64Data
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const resultText = generateResponse.text;
    if (!resultText) {
       throw new Error('No content returned from AI');
    }
    
    // Parse
    const result = JSON.parse(resultText);

    return NextResponse.json({ insights: result });
  } catch (error: unknown) {
    return internalErrorResponse('analyze-banner', error, 'バナー解析に失敗しました');
  }
}
