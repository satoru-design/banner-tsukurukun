import { GoogleGenAI } from '@google/genai';
import type {
  VisualStyle,
  Typography,
  PriceBadgeSpec,
  CtaSpec,
  LayoutSpec,
  CopyTone,
} from './schema';
import { fillDefaults } from './defaults';

const MODEL = 'gemini-2.5-pro';

function ensureKey(): string {
  const key =
    process.env.GOOGLE_AI_STUDIO_API_KEY ||
    process.env.GEMINI_API_KEY ||
    '';
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return key;
}

const EXTRACTION_PROMPT = `
あなたは広告クリエイティブ分析のプロフェッショナルです。
提供された参考バナー画像を精読し、共通する「スタイル仕様」を
以下の JSON スキーマで抽出してください。
Markdown ブロックを含めず、純粋な JSON テキストのみ出力してください。

【JSON スキーマ】
{
  "visualStyle": {
    "colorPalette": {
      "primary": "Hex color string",
      "accents": ["Hex", "Hex"],
      "background": "Hex color string"
    },
    "lighting": "high-key | low-key | natural | dramatic | studio",
    "mood": "自由記述・日本語",
    "composition": "自由記述・日本語（例：人物左+商品中央+テキスト右）",
    "imagePromptKeywords": "英語、画像生成プロンプト注入用"
  },
  "typography": {
    "mainCopyStyle": {
      "family": "mincho | gothic | brush | modern-serif | hand-written",
      "orientation": "horizontal | vertical",
      "weight": "normal | bold | black",
      "emphasisRatio": "2x | 3x | 4x",
      "color": "Hex",
      "strokeColor": "Hex or null",
      "strokeWidth": "number or null"
    },
    "subCopyStyle": {
      "family": "mincho | gothic | modern-serif",
      "size": "small | medium | large",
      "color": "Hex"
    },
    "microCopyExamples": ["画像内で実際に読み取れた文字列 3-5 例"]
  },
  "priceBadge": {
    "primary": {
      "shape": "circle-red | circle-gold | rect-red | ribbon-orange | capsule-navy",
      "color": "Hex",
      "textPattern": "初回 ¥{NUMBER} のようなプレースホルダを含むテンプレート",
      "position": "top-left | top-right | bottom-left | bottom-right | center-right | floating-product"
    },
    "secondary": {
      "shape": "circle-flower | ribbon | circle | rect",
      "color": "Hex",
      "textPattern": "累計 {NUMBER} 本突破!! のような",
      "position": "top-left | top-right | bottom-left | bottom-right | center-right | floating-product"
    }
  },
  "cta": {
    "templateId": "cta-green-arrow | cta-orange-arrow | cta-red-urgent | cta-gold-premium | cta-navy-trust",
    "textPattern": "{ACTION}で始める → のような",
    "position": "bottom-center | bottom-left | bottom-right"
  },
  "layout": {
    "personZone": "left | right | center | none",
    "productZone": "left | right | center | bottom",
    "mainCopyZone": "left | right | top | bottom | center",
    "brandLogoPosition": "top-left | top-right | bottom-left | bottom-right | none",
    "decorations": [
      { "type": "ribbon | diagonal-line | frame | particle", "position": "自由記述", "color": "Hex" }
    ]
  },
  "copyTone": {
    "formalityLevel": "casual | neutral | formal",
    "vocabulary": ["よく使われる語彙 3-7 語"],
    "taboos": ["推測される NG 表現 2-3 語"],
    "targetDemographic": "年齢層・性別・悩み等"
  }
}

【抽出ルール】
- 画像ごとに違う要素は多数決で決定
- 色は Hex コードで推定（必ず "#" で始める）
- 判定不能な場合は最も近いデフォルト値を選ぶ（null は使わない）
- secondary バッジが画像に無ければ undefined（キーごと省略）
- decorations が無ければ空配列 []
`;

export interface ExtractedStyle {
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
}

export async function extractStyleFromReferences(
  referenceImageUrls: string[],
): Promise<ExtractedStyle> {
  if (referenceImageUrls.length < 2) {
    throw new Error('At least 2 reference images are required');
  }

  const ai = new GoogleGenAI({ apiKey: ensureKey() });

  const imageParts = await Promise.all(
    referenceImageUrls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const buf = await res.arrayBuffer();
      const base64 = Buffer.from(buf).toString('base64');
      const mime = res.headers.get('content-type') ?? 'image/jpeg';
      return { inlineData: { data: base64, mimeType: mime } };
    }),
  );

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: EXTRACTION_PROMPT },
      ...imageParts,
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  let parsed: Partial<ExtractedStyle>;
  try {
    parsed = JSON.parse(
      text.replace(/```json/g, '').replace(/```/g, '').trim(),
    );
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini JSON: ${err instanceof Error ? err.message : err}`,
    );
  }

  const filled = fillDefaults(parsed);
  return filled;
}
