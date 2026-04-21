import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { url, productName, target } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Crawl the LP
    let lpText = '';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch URL');
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Remove scripts, styles, etc.
      $('script, style, noscript, iframe, img').remove();
      lpText = $('body').text().replace(/\s+/g, ' ').slice(0, 8000); // Limit to 8000 chars
    } catch (err) {
      console.error('Scraping error:', err);
      // If scraping fails, proceed with just the product name and target
    }

    // Call Gemini API
    const prompt = `
以下の商材情報とランディングページ(LP)のテキストを元に、広告バナー用の効果的なコピーを作成してください。

商材名: ${productName || '未指定'}
ターゲット層: ${target || '未指定'}
LP内容:
${lpText}

上記から訴求ポイントを分析し、バナー用の「メインコピー（短くキャッチーなもの）」を3つ、「サブコピー（メインを補足するもの）」を3つ提案してください。
出力形式は必ず以下のJSON形式にしてください。他の文章は不要です。
{
  "mainCopies": ["コピー1", "コピー2", "コピー3"],
  "subCopies": ["サブ1", "サブ2", "サブ3"]
}`;

    const generateResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const resultText = generateResponse.text;
    if (!resultText) {
       throw new Error('No content returned from AI');
    }
    const result = JSON.parse(resultText);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
