/**
 * LP Maker Pro 2.0 — Gemini 2.5 Pro 構造化出力ジェネレータ
 *
 * 参考: src/app/api/ironclad-suggest/route.ts (Phase B.4)
 * - responseSchema で JSON 形状を強制
 * - 1 回まで自動リトライ
 */
import { GoogleGenAI, Type } from '@google/genai';
import type { LpBrief, LpSectionType } from './types';
import { buildSystemPrompt, buildUserPromptForSection } from './copy-prompts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function schemaForSection(sectionType: LpSectionType) {
  switch (sectionType) {
    case 'hero':
      return {
        type: Type.OBJECT,
        required: ['headline', 'subheadline', 'ctaText'],
        properties: {
          headline: { type: Type.STRING },
          subheadline: { type: Type.STRING },
          ctaText: { type: Type.STRING },
        },
      };
    case 'problem':
      return {
        type: Type.OBJECT,
        required: ['headline', 'items'],
        properties: {
          headline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['title', 'description'],
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'solution':
      return {
        type: Type.OBJECT,
        required: ['headline', 'description'],
        properties: {
          headline: { type: Type.STRING },
          description: { type: Type.STRING },
        },
      };
    case 'features':
      return {
        type: Type.OBJECT,
        required: ['headline', 'items'],
        properties: {
          headline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            minItems: '4',
            maxItems: '4',
            items: {
              type: Type.OBJECT,
              required: ['title', 'description'],
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                iconHint: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'numeric_proof':
      return {
        type: Type.OBJECT,
        required: ['items'],
        properties: {
          items: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['number', 'label'],
              properties: {
                number: { type: Type.STRING },
                label: { type: Type.STRING },
                note: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'comparison':
      return {
        type: Type.OBJECT,
        required: ['headline', 'rowLabels', 'columns'],
        properties: {
          headline: { type: Type.STRING },
          rowLabels: { type: Type.ARRAY, minItems: '5', maxItems: '5', items: { type: Type.STRING } },
          columns: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['name', 'rows'],
              properties: {
                name: { type: Type.STRING },
                rows: { type: Type.ARRAY, minItems: '5', maxItems: '5', items: { type: Type.STRING } },
              },
            },
          },
        },
      };
    case 'voice':
      return {
        type: Type.OBJECT,
        required: ['headline', 'items'],
        properties: {
          headline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['quote', 'author'],
              properties: {
                quote: { type: Type.STRING },
                author: { type: Type.STRING },
                proofBadge: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'pricing':
      return {
        type: Type.OBJECT,
        required: ['headline', 'plans'],
        properties: {
          headline: { type: Type.STRING },
          plans: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['name', 'price', 'features', 'ctaText'],
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.STRING },
                features: { type: Type.ARRAY, minItems: '4', maxItems: '4', items: { type: Type.STRING } },
                ctaText: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'faq':
      return {
        type: Type.OBJECT,
        required: ['headline', 'items'],
        properties: {
          headline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            minItems: '6',
            maxItems: '6',
            items: {
              type: Type.OBJECT,
              required: ['question', 'answer'],
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'inline_cta':
    case 'final_cta':
      return {
        type: Type.OBJECT,
        required: ['headline', 'buttonText'],
        properties: {
          headline: { type: Type.STRING },
          buttonText: { type: Type.STRING },
          note: { type: Type.STRING },
        },
      };
  }
}

export async function generateSectionCopy(
  brief: LpBrief,
  sectionType: LpSectionType
): Promise<Record<string, unknown>> {
  const systemPrompt = buildSystemPrompt(brief);
  const userPrompt = buildUserPromptForSection(sectionType, brief);
  const schema = schemaForSection(sectionType);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      const text = result.text;
      if (!text) throw new Error('Gemini empty response');
      const parsed = JSON.parse(text);
      return parsed;
    } catch (err) {
      console.error(`[copy-generator] section=${sectionType} attempt=${attempt} error`, err);
      if (attempt === 2) throw err;
    }
  }
  throw new Error('unreachable');
}
