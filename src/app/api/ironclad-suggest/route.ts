import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import type { IroncladPattern } from '@/lib/prompts/ironclad-banner';
import { getPrisma } from '@/lib/prisma';
import { buildWinningPatternInjection } from '@/lib/winning-banner/prompt-injection';
import type { AnalysisAbstract } from '@/lib/winning-banner/types';

export const runtime = 'nodejs';
// Phase B.4: structured output + 1回リトライ用に余裕を持たせる
// (Gemini 2.5 Pro 1 回 ≒ 30-50 秒。2 回連投で 100s 想定 → 120s に設定)
export const maxDuration = 120;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Phase B.4: Gemini structured output 用 responseSchema。
 * これを渡すと Gemini が schema に厳密に合致した JSON を返すため、
 * "配列長ずれ・フィールド欠落・余計なネスト" 系のエラーが理論上ほぼ消える。
 *
 * 文字数制限 (コピー1=20字、コピー2=35字 等) は schema レベルでは表現できないので、
 * 引き続き system prompt の自然言語ルールで制御する。
 */
const STRING_ARRAY_4 = {
  type: Type.ARRAY,
  minItems: '4',
  maxItems: '4',
  items: { type: Type.STRING },
} as const;

const NESTED_4x4 = {
  type: Type.ARRAY,
  minItems: '4',
  maxItems: '4',
  items: STRING_ARRAY_4,
} as const;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ['copies', 'designRequirements', 'ctas', 'tones', 'cautions'],
  properties: {
    copies: NESTED_4x4,
    designRequirements: NESTED_4x4,
    ctas: STRING_ARRAY_4,
    tones: STRING_ARRAY_4,
    cautions: STRING_ARRAY_4,
  },
} as const;

interface ReqBody {
  pattern: IroncladPattern;
  product: string;
  target: string;
  purpose: string;
  /** 複数サイズ選択対応。Gemini へのプロンプト構築は先頭サイズのみ使用（候補の傾向は全サイズで概ね共通）。 */
  sizes: string[];
  /** Phase A.8: 勝ちバナー参照を有効化するか。未指定 / false なら既存挙動と完全同一。 */
  useWinningRef?: boolean;
}

export interface IroncladSuggestions {
  /** コピー1〜4、それぞれ 4 候補 */
  copies: [string[], string[], string[], string[]];
  /** デザイン要件1〜4、それぞれ 4 候補 */
  designRequirements: [string[], string[], string[], string[]];
  /** CTA 4候補 */
  ctas: string[];
  /** トーン 4候補 */
  tones: string[];
  /** 注意事項 4候補 */
  cautions: string[];
}

const PATTERN_GUIDANCE: Record<IroncladPattern, string> = {
  '王道': '直接的で分かりやすい訴求。数字とベネフィットを前面に。保守的で実績の裏付けが強いトーン。',
  '綺麗め': '清潔感とミニマリズム。上質な女性誌的な余白・抜け感。過度な煽りは避ける。',
  'インパクト重視': 'スクロールを強制的に止める強い視覚言語。オノマトペ・大文字・極端な数字。',
  '信頼感': '専門家・公的認証・長期実績を強調。派手さを抑え、権威訴求で安心感を構築。',
  'ストーリー型': 'ターゲットの心情や日常シーンを描き、共感から興味へ自然に誘導する流れ。',
  'ラグジュアリー': 'ハイエンドD2C。ゴールド・余白・上質素材。価格より価値提案を優先。',
};

function buildSystemPrompt(): string {
  return `あなたは日本のダイレクトレスポンス広告に15年従事したコピーライター兼クリエイティブディレクターです。
Meta広告で高CTR・高CVRを叩き出すバナー素材候補を生成してください。

🚨【字数制限：絶対厳守】🚨
以下の上限を1文字でも超える候補は絶対に出力しないこと。
過去の勝ちパターン傾向（後述）が長文化を示唆していても、字数上限が最優先。
- コピー1: 20字以内（厳守）
- コピー2: 35字以内（厳守）
- コピー3: 25字以内（厳守）
- コピー4: 20字以内（厳守）
- CTA: 12字以内（厳守）
出力前に各候補の文字数を必ず数え、超過したら短縮し直すこと。

【出力仕様】純粋な JSON オブジェクトのみ。Markdown バッククォート禁止。コメント禁止。
以下のスキーマ通りに返す:

{
  "copies": [
    ["候補1a", "候補1b", "候補1c", "候補1d"],
    ["候補2a", "候補2b", "候補2c", "候補2d"],
    ["候補3a", "候補3b", "候補3c", "候補3d"],
    ["候補4a", "候補4b", "候補4c", "候補4d"]
  ],
  "designRequirements": [
    ["要件1a", "要件1b", "要件1c", "要件1d"],
    ["要件2a", "要件2b", "要件2c", "要件2d"],
    ["要件3a", "要件3b", "要件3c", "要件3d"],
    ["要件4a", "要件4b", "要件4c", "要件4d"]
  ],
  "ctas": ["CTA a", "CTA b", "CTA c", "CTA d"],
  "tones": ["トーン a", "トーン b", "トーン c", "トーン d"],
  "cautions": ["注意 a", "注意 b", "注意 c", "注意 d"]
}

【各項目の作り方】

コピー1（メインコピー / 最大ポイント）:
- **20字以内厳守**（超過禁止）
- 数字や核心ベネフィット、オノマトペを強調
- 4候補は異なる切り口で（数字・感情・呼びかけ・オノマトペ等）

コピー2（サブコピー）:
- **35字以内厳守**（超過禁止）
- メインコピーの補強・詳細説明
- 4候補で切り口を変える

コピー3（ターゲット明示 or 期限・価格訴求）:
- **25字以内厳守**（超過禁止）
- 「40代のあなたへ」「今だけ」「初回限定」等

コピー4（CTA直前のダメ押し or 権威訴求）:
- **20字以内厳守**（超過禁止）
- 「累計○万本突破」「○○で1位」等の権威・社会的証明

デザイン要件1〜4:
- 具体的な構図・配色・被写体指示
- 例: 「左にメインコピー、右に40代女性クローズアップ」「背景は白基調、アクセントに緑系ハーブ」
- 4候補はそれぞれ視覚的に差がわかる内容に

CTA:
- 短いアクションフレーズ
- 「今すぐ始める」「公式で購入」「無料で試す」等

トーン:
- 世界観の言語化（2〜4語）
- 例: 「清潔感とナチュラル」「勝ち組40代の余裕」等

注意事項:
- 広告規約・薬機法・景表法準拠の注意点
- 例: 「医療的効能を断定しない」「断食不要を明記」等

【禁止】
- 未確認の受賞歴・認証・実績・ランキング
- 過激・不快・グロテスク・誇大表現
- 身体羞恥・極端なビフォーアフター
- 断定的な医療表現
`;
}

function buildUserPrompt(body: ReqBody): string {
  const sizesLabel = body.sizes.join(' / ');
  return `以下のブリーフに合う素材候補を生成してください。

【パターン】${body.pattern}
（方針: ${PATTERN_GUIDANCE[body.pattern]}）

【商材】${body.product}

【ターゲット】${body.target}

【目的・コンセプト】${body.purpose}

【生成対象サイズ】${sizesLabel}
（複数サイズで統一感を持たせたい。デザイン要件は汎用的に記述し、極端な1サイズ特化指示は避ける）

出力は上記スキーマ通りの JSON オブジェクトのみ。
`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body.product || !body.target || !body.purpose || !body.pattern) {
      return NextResponse.json(
        { error: 'pattern, product, target, purpose are required' },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.sizes) || body.sizes.length === 0) {
      return NextResponse.json({ error: 'sizes must be a non-empty array' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(body);

    // Phase A.8: 勝ちパターン注入（useWinningRef=true かつ機能有効時のみ）
    let winningInjection = '';
    const winningEnabled = process.env.WINNING_BANNER_ENABLED !== 'false';
    if (body.useWinningRef === true && winningEnabled) {
      try {
        const prisma = getPrisma();
        const recent = await prisma.asset.findMany({
          where: { type: 'winning_banner' },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });
        const abstracts = recent
          .map((r) => r.analysisAbstract as AnalysisAbstract | null)
          .filter((a): a is AnalysisAbstract => a !== null);
        winningInjection = buildWinningPatternInjection(abstracts);
      } catch (winErr) {
        // 勝ちバナー集約失敗は致命的ではない。空注入で既存挙動にフォールバック。
        console.warn('Winning banner injection failed, falling back to no-injection:', winErr);
      }
    }

    // gemini-2.5-pro: 本プロジェクトで実績ある安定モデル（analyze-lp / analyze-banner / generate-copy と同じ）。
    // gemini-3.1-flash-lite-preview / gemini-3.1-pro-preview は現行 Gemini API で JSON レスポンスが
    // 不安定な場合があり、パース失敗の事故があったため 2.5-pro に統一。
    //
    // Phase B.4: responseSchema (structured output) で配列長/フィールドを Gemini 側に強制。
    //   1 回目: temperature 0.85 で多様性を出す。
    //   失敗時は 1 回だけ temperature 0.3 に下げて再試行 (低温は schema 適合率が高い)。
    //   過去の 3 回ループは maxDuration=60 を超えて 504 を起こしたので 1 回に抑制。
    const fullPrompt = systemPrompt + '\n\n' + userPrompt + winningInjection;

    type CallResult = {
      ok: true;
      suggestions: IroncladSuggestions;
    } | {
      ok: false;
      reason: 'empty' | 'parse' | 'schema';
      raw: string;
    };

    async function callOnce(temperature: number): Promise<CallResult> {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [fullPrompt],
        config: {
          responseMimeType: 'application/json',
          // structured output: Gemini は schema に厳密に合致した JSON を返す
          responseSchema: RESPONSE_SCHEMA,
          temperature,
        },
      });
      const outputText = response.text ?? '';
      if (!outputText) return { ok: false, reason: 'empty', raw: '' };

      let parsed: unknown;
      try {
        const cleaned = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        return { ok: false, reason: 'parse', raw: outputText };
      }

      // schema チェック (responseSchema があるので普通失敗しないが念のため)
      const p = parsed as Partial<IroncladSuggestions>;
      const ok =
        Array.isArray(p.copies) &&
        p.copies.length === 4 &&
        p.copies.every((arr) => Array.isArray(arr) && arr.length === 4) &&
        Array.isArray(p.designRequirements) &&
        p.designRequirements.length === 4 &&
        p.designRequirements.every((arr) => Array.isArray(arr) && arr.length === 4) &&
        Array.isArray(p.ctas) &&
        Array.isArray(p.tones) &&
        Array.isArray(p.cautions);
      if (!ok) return { ok: false, reason: 'schema', raw: outputText };

      return { ok: true, suggestions: parsed as IroncladSuggestions };
    }

    let result = await callOnce(0.85);
    if (!result.ok) {
      console.warn(
        `[ironclad-suggest] 1st attempt failed (reason=${result.reason}). Retrying with temperature=0.3`,
      );
      result = await callOnce(0.3);
    }

    if (!result.ok) {
      console.error('[ironclad-suggest] both attempts failed', {
        reason: result.reason,
        rawSnippet: result.raw.slice(0, 400),
      });
      const userMsg =
        result.reason === 'empty'
          ? 'AIが空の応答を返しました。再生成してください'
          : result.reason === 'parse'
            ? 'AI出力のJSONパースに失敗しました。再生成してください'
            : 'AI出力のスキーマが期待と異なります。再生成してください';
      return NextResponse.json({ error: userMsg }, { status: 500 });
    }

    return NextResponse.json({ suggestions: result.suggestions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('ironclad-suggest error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
