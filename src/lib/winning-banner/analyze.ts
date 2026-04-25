import { GoogleGenAI } from '@google/genai';
import {
  AnalysisResult,
  CURRENT_ANALYSIS_VERSION,
  WINNING_PATTERN_KEYS,
} from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ANALYZE_PROMPT = `あなたは広告クリエイティブ分析の専門家です。
添付された広告バナー画像を解析し、以下のJSON形式で出力してください。

【最重要原則】
- "abstract" フィールドには、業種・商材を問わず転用可能な抽象的特徴のみを記述
- 具体的な商品名・ブランド名・コピー文言・ロゴテキスト・人物名は "abstract" に絶対に含めないこと
- "concrete" フィールドには分析・デバッグ用に具体情報を記録（こちらには具体名OK）

【出力JSON スキーマ】
{
  "abstract": {
    "palette": string,         // 例: "黄+黒高コントラスト系"
    "copyAngle": string,       // 例: "ベネフィット型・具体数値訴求"
    "cta": string,             // 例: "行動促進型・短文"
    "layout": string,          // 例: "商品オフセンター + テキスト右寄せ"
    "typo": string,            // 例: "ゴシック太字・パワー系"
    "mood": string,            // 例: "明るい・健康的・爽快"
    "pattern": string,         // 必ず以下のいずれか1つ: ${WINNING_PATTERN_KEYS.join(' | ')}
    "abstractTags": string[]   // UI表示用、ちょうど3個。例: ["ベネフィット型", "黄黒系", "ゴシック太字"]
  },
  "concrete": {
    "paletteHex": string[],         // 主要色HEX、最大5個
    "extractedTexts": string[],     // バナー内の全テキスト
    "detectedElements": string[],   // 検出した視覚要素 (商品パッケージ・人物モデル・認証バッジ等)
    "rawObservations": string       // 自由記述の全体観察（最大500字）
  }
}

純粋なJSONのみ出力。Markdown バッククォート禁止。コメント禁止。`;

/**
 * 画像URLを Gemini 2.5 Pro Vision で解析し、抽象+具体の二層構造で返す。
 *
 * 失敗時の挙動:
 * - Gemini API 失敗 / JSON パース失敗 / スキーマ違反 → throw Error
 * - 呼び出し元はキャッチしてユーザーに「解析に失敗しました」表示
 *
 * 漏洩防止:
 * - abstract は最終的にプロンプトに流れるが、Gemini に「抽象のみ」を強制
 * - concrete は DB 保存のみ。プロンプト経路には絶対に流さない（呼び出し元の責任）
 */
export async function analyzeWinningBanner(imageUrl: string): Promise<AnalysisResult> {
  // 画像を fetch して base64 化（Gemini Vision は inline data を要求）
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image: ${imageRes.status}`);
  }
  const imageBuf = Buffer.from(await imageRes.arrayBuffer());
  const mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg';
  const base64 = imageBuf.toString('base64');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      {
        role: 'user',
        parts: [
          { text: ANALYZE_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3, // 解析は決定的に近い方が安定
    },
  });

  const outputText = response.text;
  if (!outputText) {
    throw new Error('Empty Gemini response');
  }

  // 既存パターン (analyze-lp/ironclad-suggest) と同じクリーニング
  const cleaned = outputText.replace(/```json/g, '').replace(/```/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('analyzeWinningBanner: JSON parse failed:', cleaned);
    throw new Error(`Invalid JSON from Gemini: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 構造バリデーション
  validateAnalysisResult(parsed);

  return {
    abstract: (parsed as { abstract: AnalysisResult['abstract'] }).abstract,
    concrete: (parsed as { concrete: AnalysisResult['concrete'] }).concrete,
    version: CURRENT_ANALYSIS_VERSION,
  };
}

function validateAnalysisResult(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Analysis result is not an object');
  }
  const obj = parsed as Record<string, unknown>;
  const abs = obj.abstract as Record<string, unknown> | undefined;
  const con = obj.concrete as Record<string, unknown> | undefined;

  if (!abs || !con) {
    throw new Error('Analysis result missing abstract or concrete');
  }

  const requiredAbsFields = ['palette', 'copyAngle', 'cta', 'layout', 'typo', 'mood', 'pattern', 'abstractTags'];
  for (const f of requiredAbsFields) {
    if (!(f in abs)) {
      throw new Error(`Analysis abstract missing field: ${f}`);
    }
  }

  if (!Array.isArray(abs.abstractTags)) {
    throw new Error('abstractTags must be an array');
  }

  if (typeof abs.pattern !== 'string' || !(WINNING_PATTERN_KEYS as readonly string[]).includes(abs.pattern)) {
    throw new Error(`pattern must be one of ${WINNING_PATTERN_KEYS.join(', ')}, got: ${abs.pattern}`);
  }

  const requiredConFields = ['paletteHex', 'extractedTexts', 'detectedElements', 'rawObservations'];
  for (const f of requiredConFields) {
    if (!(f in con)) {
      throw new Error(`Analysis concrete missing field: ${f}`);
    }
  }
}
