import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * 解析対象 URL の検証。
 *
 * 以前は受け取った文字列をそのまま `https://r.jina.ai/${url}` に連結していたため、
 * 相対パスや `..` を混ぜて Jina 側のパスを書き換えられる状態だった。
 * http(s) の絶対 URL だけを受け、encodeURIComponent してから連結する。
 */
function parseTargetUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u;
}

export async function POST(req: Request) {
  // Gemini 2.5 Pro を呼ぶ従量課金 route なので route 側でもログインを必須にする。
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url: rawUrl } = await req.json();

    const target = parseTargetUrl(rawUrl);
    if (!target) {
      return NextResponse.json(
        { error: 'URL is required (http(s) の絶対 URL を指定してください)' },
        { status: 400 },
      );
    }

    let lpText = '';
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(target.toString())}`, {
        headers: {
          'Accept': 'text/plain',
        }
      });
      if (jinaRes.ok) {
        lpText = await jinaRes.text();
        lpText = lpText.slice(0, 15000); // Limit context size
      } else {
        return NextResponse.json({ error: 'Failed to extract text from URL.' }, { status: 400 });
      }
    } catch (e: unknown) {
      console.error('[analyze-lp] Jina Reader fetch failed:', e);
      return NextResponse.json({ error: 'Error connecting to Jina Reader.' }, { status: 502 });
    }

    const prompt = `
あなたは世界最高峰のダイレクトレスポンス・クリエイティブディレクターです。
提供されたLPのテキストデータを精読し、以下のポイントを抽出・推測し、JSONフォーマットで構造化して回答してください。
Markdownブロックなどを含めず、純粋なJSONテキストのみ出力してください。

【出力キー】
- "inferred_product_name": 推測される主要な商材名またはサービス名
- "inferred_target_demographic": 推測されるターゲット層・デモグラフィック属性（年齢層、性別、悩み、ライフスタイル等）
- "main_appeal": LP全体を通じたメインの訴求ポイント・切り口（例：価格、簡便さ、実績）
- "worldview": LPのデザイントーンや世界観（例：高級感のある和風、エネルギッシュなスポーツ系、清潔感のあるメディカル系など）
- "insight": このLPの中で最もユーザーの心を動かすと思われる要素（感情的インサイト）
- "pricing": {
    "initialOffer": "初回限定価格の文字列（例: '初回限定 ¥980'）、なければ null",
    "discount": "割引率や割引額の文字列（例: '50%OFF' or '2,500円OFF'）、なければ null",
    "urgency": "期間限定・先着・残りわずか等のトリガーが LP にあれば 'high'、なければ 'low'"
  }
- "productCategory": "health | cosme | travel | btob | ec-general のいずれか"
`;

    const generateResponse = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        { text: prompt },
        { text: `【LPテキスト】\n${lpText}` }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const resultText = generateResponse.text;
    if (!resultText) {
       throw new Error('No content returned from AI');
    }
    
    let parsed: unknown;
    try {
      const cleanJSON = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJSON);
    } catch (e) {
      console.error("JSON Parsing Error in analyze-lp:", resultText);
      throw new Error(`Invalid JSON format returned from AI: ${e}`);
    }

    return NextResponse.json({ insights: parsed, lpText });
  } catch (error: unknown) {
    return internalErrorResponse('analyze-lp', error, 'LP の解析に失敗しました');
  }
}
