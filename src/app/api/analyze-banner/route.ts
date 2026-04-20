import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

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
            mimeType: 'image/jpeg',
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
  } catch (error: any) {
    console.error('API Error (analyze-banner):', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
