import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '', // defaults to process.env.ANTHROPIC_API_KEY
});

export async function POST(req: Request) {
  try {
    const { url, productName, target, competitorInsights } = await req.json();

    if (!url && !productName) {
      return NextResponse.json({ error: 'URL or Product Name is required' }, { status: 400 });
    }

    let lpText = '';
    if (url) {
       // Use Jina Reader to get clean markdown from LP
       try {
         const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
           headers: {
             'Accept': 'text/plain',
             // 'Authorization': `Bearer ${process.env.JINA_API_KEY}` // Required if using auth
           }
         });
         if (jinaRes.ok) {
           lpText = await jinaRes.text();
           lpText = lpText.slice(0, 15000); // Limit context size for Claude
         }
       } catch (e: any) {
         console.warn("Jina reader failed:", e);
       }
    }

    const systemPrompt = `
あなたは世界最高峰のダイレクトレスポンス・コピーライターであり、バナー広告のクリエイティブ・ディレクターです。
与えられた商材情報（および競合/過去バナーの分析インサイト）をもとに、以下の4つのマーケティング・アングル（訴求軸）でバナー用のコピーと背景画像のプロンプトを作成してください。

【4つのアングル】
1. Benefit（ベネフィット・得られる理想の未来）
2. Fear（フィア・回避すべきリスク・不安）
3. Authority（権威性・No.1・実績・安心感）
4. Empathy（共感・ターゲットの悩みへの寄り添い）

【フォーマット要件】
以下のJSON配列フォーマットだけで回答してください。Markdownのバッククォートなども含めないでください。
[
  {
    "angle": "Benefit",
    "mainCopy": "短いキャッチコピー(20文字以内)",
    "subCopy": "メインを補足する文章(30文字以内)",
    "imagePrompt": "背景画像生成AI(Flux)用の英語プロンプト。"
  },
  ...
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

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const outputText = (message.content[0] as any).text;
    
    // Attempt to parse json structure
    try {
        // Strip markdown backticks if claude adds them
        const cleanJSON = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJSON);
        return NextResponse.json({ variations: parsed });
    } catch(e) {
        console.error("Failed to parse Claude output:", outputText);
        return NextResponse.json({ error: 'AI出力のJSONパースに失敗しました。', raw: outputText }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Error (generate-copy):', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
