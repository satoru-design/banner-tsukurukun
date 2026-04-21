import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { productName, target, competitorInsights, lpText } = await req.json();

    if (!productName && !competitorInsights && !lpText) {
      return NextResponse.json({ error: 'Product Name or Insights or LP Text is required' }, { status: 400 });
    }

    const systemPrompt = `
あなたは世界最高峰のダイレクトレスポンス・コピーライター兼広告クリエイティブディレクターです。
与えられた商材情報（および競合/過去バナーの分析インサイト）をもとに、以下の4つのマーケティング・アングル（訴求軸）で、クリック率（CTR）を最大化するための広告コピーとデザイン仕様を策定してください。

【4つのアングル】
1. Benefit（ベネフィット・得られる理想の未来）
2. Fear（フィア・回避すべきリスク・不安）
3. Authority（権威性・No.1・実績・安心感）
4. Empathy（共感・ターゲットの悩みへの寄り添い）

【フォーマット要件】
以下のJSON配列フォーマットだけで回答してください。Markdownのバッククォートなども含めないでください。

[
  {
    "strategy": {
      "angle": "訴求軸名（例：Benefit）",
      "target_insight": "ターゲットがこのバナーを見てどう感じるべきか"
    },
    "copy": {
      "main_copy": "強調したい単語を必ず<mark></mark>で一つだけ囲んだ20文字以内の強力なコピー",
      "sub_copy": "メインコピーを補足する、具体的で魅力的な35文字以内のサブコピー",
      "cta_text": "思わずクリックしたくなるボタン文言（例：今すぐ無料で試す）"
    },
    "design_specs": {
      "tone_and_manner": "デザインの雰囲気（例：清潔感のあるミニマル、エネルギッシュなポップ、信頼感のあるビジネス）",
      "color_palette": {
        "main": "メインテキスト用の視認性の高い色（Hex）",
        "accent": "強調色・CTAボタン用の目立つ色（Hex）"
      },
      "layout_id": "配置パターン（z-pattern または split-screen または center-focus のいずれかを必ず指定。迷う場合は split-screen を推奨）",
      "image_gen_prompt": "高画質な背景画像生成用の詳細な英語プロンプト。※抽出されたLPの世界観（和風、モダニズム、メディカル等）や得られたインサイトのトーンを色濃く反映させ、ネガティブスペースを意識した構図を指示すること。テキストは含めない"
    }
  }
]
`;

    const userPrompt = `
商材名: ${productName || '未指定'}
ターゲット層: ${target || '未指定'}
【LPから抽出されたテキスト(Markdown)】
${lpText || 'なし'}

【競合・過去バナーからのインサイト】
${competitorInsights || 'なし'}

最高の成果を出す4つのアングルのバナーコピーと英語画像プロンプトを作成してください。
出力はJSON配列のみ。
`;

    // 注: 元は 'gemini-3.1-pro-preview' を指定していたが、モデル ID が現行 Gemini API で
    // 不安定または存在しないため JSON パースが頻繁に失敗していた。
    // 他ルート（analyze-lp / analyze-banner）で動作実績のある 'gemini-2.5-pro' に統一。
    const generateResponse = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        systemPrompt + "\n\n" + userPrompt
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7
      }
    });

    const outputText = generateResponse.text;
    
    // Attempt to parse json structure
    try {
        if (!outputText) throw new Error("Empty response");
        const cleanJSON = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJSON);
        return NextResponse.json({ variations: parsed });
    } catch(e) {
        console.error("Failed to parse Gemini output:", outputText);
        return NextResponse.json({ error: 'AI出力のJSONパースに失敗しました。', raw: outputText }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Error (generate-copy):', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
