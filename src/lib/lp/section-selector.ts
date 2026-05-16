/**
 * LP Maker Pro 2.0 — AI 自動セクション選定ロジック (D4 Task 5)
 *
 * Brief から最適な 7〜9 セクション組合せを Gemini 2.5 Pro に判断させる。
 * - hero / final_cta は強制で含める（順序は先頭・末尾固定）
 * - PASONA / AIDMA を意識した順序を Gemini に生成させる
 * - 業種特性（D2C / BtoB SaaS / 高単価）でセクション選択ルールを与える
 * - Gemini が 2 回連続失敗したら既定 9 セクションにフォールバック
 */
import { GoogleGenAI, Type } from '@google/genai';
import type { LpBrief, LpSectionType } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ALL_SECTIONS: LpSectionType[] = [
  'hero',
  'problem',
  'solution',
  'features',
  'numeric_proof',
  'comparison',
  'voice',
  'pricing',
  'faq',
  'inline_cta',
  'final_cta',
];

/** Gemini が失敗したときの既定 9 セクション */
const FALLBACK_SECTIONS: LpSectionType[] = [
  'hero',
  'problem',
  'solution',
  'features',
  'numeric_proof',
  'voice',
  'pricing',
  'faq',
  'final_cta',
];

/**
 * Brief から最適な 7〜9 セクション組合せを Gemini に判断させる。
 *
 * - hero / final_cta は強制含める
 * - それ以外は Gemini が業種・オファー特性から選ぶ
 * - 順序も指定させる（PASONA / AIDMA を意識）
 */
export async function selectSectionsForBrief(brief: LpBrief): Promise<LpSectionType[]> {
  const prompt = `
あなたは LP の構成設計の専門家です。以下のブリーフに最適なセクション組合せを決めてください。

# ブリーフ
- 商品名: ${brief.productName}
- ターゲット: ${brief.target}
- オファー: ${brief.offer}
${brief.lpUrl ? `- 既存 LP URL: ${brief.lpUrl}` : ''}

# 選択可能なセクション
- hero (FV)
- problem (課題提起)
- solution (解決策)
- features (機能紹介)
- numeric_proof (数字訴求)
- comparison (比較表)
- voice (お客様の声)
- pricing (料金)
- faq (FAQ)
- inline_cta (セクション間 CTA)
- final_cta (最終 CTA)

# ルール
- 必ず hero を 1 番目、final_cta を最後に含める
- 合計 7〜9 セクション
- PASONA / AIDMA を意識した順序
- D2C / EC ⇒ voice / pricing 必須
- BtoB SaaS ⇒ comparison 必須
- 高単価商品 ⇒ faq 必須

# 出力フォーマット
順序付き配列で返してください。
`.trim();

  const schema = {
    type: Type.OBJECT,
    required: ['sections'],
    properties: {
      sections: {
        type: Type.ARRAY,
        minItems: '7',
        maxItems: '9',
        items: { type: Type.STRING, enum: [...ALL_SECTIONS] },
      },
    },
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      const text = result.text;
      if (!text) throw new Error('Gemini empty response');
      const parsed = JSON.parse(text) as { sections: LpSectionType[] };

      // 検証 + 補正: hero 先頭 / final_cta 末尾 / 重複排除
      const middle: LpSectionType[] = parsed.sections.filter(
        (s) => s !== 'hero' && s !== 'final_cta'
      );
      const ordered: LpSectionType[] = ['hero', ...middle, 'final_cta'];

      const seen = new Set<LpSectionType>();
      const dedup = ordered.filter((s) => {
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      });

      return dedup;
    } catch (err) {
      console.error(`[section-selector] attempt=${attempt} error`, err);
      if (attempt === 2) {
        // fallback: 既定 9 セクション
        return FALLBACK_SECTIONS;
      }
    }
  }
  throw new Error('unreachable');
}
