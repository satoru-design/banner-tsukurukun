import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { loadStyleProfile, injectIntoCopyPrompt } from '@/lib/style-profile/injector';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { productName, target, competitorInsights, lpText, styleProfileId } = await req.json();

    if (!productName && !competitorInsights && !lpText) {
      return NextResponse.json({ error: 'Product Name or Insights or LP Text is required' }, { status: 400 });
    }

    const styleProfile = await loadStyleProfile(styleProfileId);

    const systemPrompt = `
あなたは日本のダイレクトレスポンス広告に 15 年従事したコピーライター兼クリエイティブディレクターです。
banavo.net 上位バナーと同等の CTR（目標 1%+）を叩き出すコピーを生成してください。

【8 アングル】それぞれで 1 本ずつ、計 8 本を生成してください。

抽象 4 層（課題発見の切り口）
1. benefit   : 得られる理想の未来を描写
2. fear      : 何もしないと失うものを提示
3. authority : No.1 / 実績 / 専門家の裏付け
4. empathy   : ターゲットの内心を代弁

具体 4 層（表現技法）
5. numeric   : 数字を main_copy または sub_copy に必ず含める（%・円・種類数・年数など）
6. target    : 「〇〇なあなたへ」「40 代男性必見」のような呼びかけで始める
7. scene     : 使用する時間・場所・状況を具体描写（例:「朝の 5 分で」「出張先で」）
8. sensory   : オノマトペ・触感・視覚効果で五感を刺激（例:「とろける」「さらさら」）

【各アングル共通の制約】
- main_copy: 20 文字以内、<mark></mark> で強調 1 単語のみ囲む（必須）
  強調対象の優先順位: ①数字 → ②核心ベネフィット → ③オノマトペ → ④動詞
- sub_copy: 35 文字以内、main を補強。\n で改行可
- emphasis_ratio: "2x" | "3x"（numeric / sensory / fear は 3x、それ以外は 2x）
- priceBadge: LP の価格情報から自動生成。情緒系 (sensory/empathy) は null 可
- ctaTemplate: 下記 5 種から商材 × 緊急度で選択
- urgency: "low" | "high"（LP に「期間限定」「本日限り」「残り〇〇」があれば high）

【CTA テンプレート 5 種】
- cta-green-arrow   : 健康食品・通販（緑、矢印 true）
- cta-orange-arrow  : EC 全般（オレンジ、矢印 true）
- cta-red-urgent    : 期間限定・セール（赤、矢印 true、緊急度高）
- cta-gold-premium  : プレミアム D2C（金、矢印 false）
- cta-navy-trust    : BtoB・金融・医療（ネイビー、矢印 false）

【価格バッジ形状 5 種】
- circle-red      : 赤丸（セール・定番）
- circle-gold     : 金丸（プレミアム・D2C）
- rect-red        : 赤角丸（緊急・限定）
- ribbon-orange   : リボン型（キャンペーン）
- capsule-navy    : カプセル型ネイビー（BtoB）

【価格バッジ位置】
- top-left / top-right / bottom-left / bottom-right / center-right / floating-product

【JSON 出力フォーマット】純粋な JSON 配列のみ、Markdown のバッククォートも含めないでください。
[
  {
    "strategy": {
      "angle_id": "benefit",
      "angle_label": "ベネフィット",
      "target_insight": "このバナーを見た人がどう感じるべきか"
    },
    "copy": {
      "main_copy": "<mark>強調語</mark>を含む 20 字以内",
      "sub_copy": "35 字以内、\\n 改行可",
      "emphasis_ratio": "2x"
    },
    "priceBadge": {
      "text": "初回限定 ¥980",
      "shape": "circle-red",
      "color": "#E63946",
      "position": "bottom-left",
      "emphasisNumber": "980"
    },
    "ctaTemplate": {
      "id": "cta-orange-arrow",
      "text": "今すぐ購入",
      "arrow": true
    },
    "urgency": "low",
    "design_specs": {
      "tone_and_manner": "清潔感のあるミニマル",
      "color_palette": { "main": "#1B1B1B", "accent": "#E63946" },
      "layout_id": "z-pattern",
      "image_gen_prompt": "英語プロンプト。アングル固有キーワードを含む。"
    }
  }
]

8 アングル全てで生成してください。情緒系 (sensory/empathy) で価格訴求が合わない場合は priceBadge を null にしてください。
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
    const extendedSystemPrompt = injectIntoCopyPrompt(systemPrompt, styleProfile);

    const generateResponse = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        extendedSystemPrompt + "\n\n" + userPrompt
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
