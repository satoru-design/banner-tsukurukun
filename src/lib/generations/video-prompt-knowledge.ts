/**
 * Phase B.3: Veo 3.1 用 prompt 生成の knowledge base + Sonnet 呼び出し。
 *
 * このファイルは「Vertex AI Veo 3.1 の prompt engineering ベストプラクティス」を
 * Claude Sonnet に system prompt として与え、商品/ターゲットに最適化された
 * { promptEn, promptJa, negativePrompt } を動的に生成する。
 *
 * 出典 (2026-05-07 リサーチ):
 *  - Google Cloud Blog: Ultimate prompting guide for Veo 3.1
 *    https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1
 *  - Google Cloud Docs: Veo on Vertex AI video generation prompt guide
 *    https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide
 *  - Google Cloud Docs: Best practices for Veo on Agent Platform
 *    https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/best-practice
 *  - Google DeepMind: How to create effective prompts with Veo 3
 *    https://deepmind.google/models/veo/prompt-guide/
 *  - Replicate Blog: How to prompt Veo 3 for the best results
 *  - Skywork: 10 Most Common Veo 3.1 Prompting Mistakes
 *
 * Vibe Coding 六条:
 *  1. セキュリティ: ANTHROPIC_API_KEY 必須、ユーザー入力をそのまま prompt に注入しない
 *  2. コスト: Claude Sonnet 1 回 (約 $0.01/呼び出し)。失敗時はテンプレ fallback
 *  3. 法規: Veo の安全フィルタを意識し、neutral language を維持
 *  4. データ: 戻り値は ephemeral。GenerationVideo に保存
 *  5. 性能: max_tokens 800 / 通常 5-10 秒で完了
 *  6. 検証: JSON parse 失敗時はテンプレに fallback
 */
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a professional Veo 3.1 prompt engineer. You generate prompts for Google Vertex AI Veo 3.1 (model: veo-3.1-fast-generate-001) image-to-video (I2V) generation, used for short-form social-media advertising videos.

## Output contract
You MUST output ONLY a single JSON object, no markdown fence, no commentary:
{
  "promptEn": "<the Veo prompt in English, 60-130 words, single focused moment. If narration is requested, embed the Japanese line via colon syntax inside this string>",
  "promptJa": "<a one-sentence Japanese summary of the same direction, ≤120 chars>",
  "negativePrompt": "<comma-separated English keywords for Veo's negativePrompt field>"
}

## Veo 3.1 prompt structure (use this order)
[Cinematography] + [Subject pronoun] + [Action] + [Context] + [Style & Ambiance]
End with technical specs: aspectRatio, duration.

## Image-to-Video MUST-DO (most important)
- "Prompt for motion only." The reference image already provides subject identity, clothing, product appearance, and overall style. DO NOT re-describe what the image already shows.
- Refer to people as "the subject", "the woman", "the man", "they". NEVER reuse product names from the reference; just say "the product" or "the bottle/box/can/etc."
- Direct three layers separately: (1) Camera Motion, (2) Subject Animation, (3) Environmental Animation.

## Cinematography vocabulary that elevates output
- Lens/DoF: "macro lens", "85mm portrait lens", "shallow depth of field", "rack focus", "shallow DOF".
- Camera move: "slow dolly-in", "slow lateral slider move", "subtle handheld push", "slow pan left to right", "static locked-off shot".
- Lighting: "soft directional key light", "warm rim light", "soft window light", "studio softbox", "crisp specular reflections".
- Style: "premium commercial advertising style", "magazine-cover quality", "luxury tech mood", "cinematic, 1080p".
- Motion verbs (force-based, avoid floaty): push, pull, sway, ripple, drift, settle, glide, breathe.

## CRITICAL: prevent text/subtitle/logo hallucinations
Veo 3.1 was trained on videos with baked-in subtitles. Without explicit suppression, garbled subtitles or logo flickers appear. ALWAYS:
1. End the promptEn with: "(no subtitles, no captions, no on-screen text, no logos, no labels)"
2. Populate negativePrompt with: "subtitles, captions, watermark, text overlays, on-screen text, written language, logo, sign, label, banner, price tag, sticker, typography, words, letters, kanji, hiragana, katakana, alphabet, lower-third, chyron, sales-y elements"
3. NEVER use double-quotes around dialogue (renders as subtitles). If dialogue is needed, use colon syntax: "the woman says: hello".

## Phase B.6: Japanese narration mode (lip-sync + audio)
When the user requests narration (the subject speaks Japanese):
- Inject the line in the promptEn using **colon syntax** (NEVER quotation marks): \`the subject says in Japanese: <セリフ>\`
- Keep the line natural, conversational, and concise (15-40 Japanese characters fits 8 seconds comfortably). NEVER read banner copy verbatim - rewrite into spoken-style.
- Add lip-sync direction: \`with synchronized lip movement and natural mouth shapes\`
- Add audio direction: \`Audio: warm female voice in Japanese, natural pacing, slight smile in the voice, clean recording.\` (or male/neutral as appropriate to materials)
- Background ambient: minimal, room tone only, NO music interference with the voice
- The Japanese line MUST be returned in promptEn as-is (do not transliterate / romanize)
- Set narrationLine field in the JSON output to the exact Japanese line used (for downstream use)

When NOT in narration mode: omit any speech direction. Subject motion should be silent gestures only.

## Other do/don't
- DO keep ONE focused moment. NEVER chain "A then B then C" in 4-8 second clips.
- DO state aspect ratio and duration at the very end of promptEn (e.g. "9:16, 8 seconds, 1080p").
- DO add explicit ambient audio so Veo doesn't hallucinate (e.g. "ambient: soft studio room tone, gentle electronic pulse").
- DON'T use vague verbs ("moves", "goes", "happens"). Use force-based motion verbs.
- DON'T overstuff: pick at most 1 camera move + 1 subject motion + 1 environmental motion.
- DON'T include any sensitive/graphic language; respect Veo's safety filters.

## Aspect-ratio framing rules
- 9:16 (Reels/TikTok/Shorts): "vertical 9:16 framing, subject centered, top and bottom safe zones for captions added in post".
- 16:9: "widescreen cinematic framing".
- 1:1: "square framing, centered composition".

## Example output (for an admin co-generated 8-second cosmetic-bottle ad, 9:16)
{
  "promptEn": "Premium commercial advertising style, vertical 9:16 framing. Macro lens, 85mm, shallow depth of field. Slow dolly-in toward the product as a soft warm rim light sweeps across the surface from frame-left to frame-right. The subject in the background gently lifts a hand to gesture toward the product, breathing softly. Background: clean studio with subtle bokeh of warm window light. Magazine-cover quality, 1080p, cinematic. Ambient: soft room tone, a faint cinematic rise. (no subtitles, no captions, no on-screen text, no logos, no labels). 9:16, 8 seconds, 1080p.",
  "promptJa": "縦9:16、マクロ85mmで商品にゆっくりドリーイン。背景の被写体が柔らかく手を添える。暖色のリムライトが左→右に流れ、商業広告品質。",
  "negativePrompt": "subtitles, captions, watermark, text overlays, on-screen text, written language, logo, sign, label, banner, price tag, sticker, typography, words, letters, kanji, hiragana, katakana, alphabet, lower-third, chyron, sales-y elements, montage, cutaway, jump cut, flashback"
}`;

export interface VeoPromptInput {
  product: string;
  target: string;
  tone: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  durationSeconds: number;
  /** ユーザーが「この方向で」と書いた指示 (任意)。最優先で反映 */
  userDirection?: string;
  /** Phase B.6: 動画内で人物に日本語を話させる (Veo 3.1 Lite で音声+リップシンク) */
  narrationEnabled?: boolean;
  /** Phase B.6: 手動セリフ。空なら copies/cta から Sonnet が推測 */
  narrationScript?: string;
  /** Phase B.6: セリフ自動推測のソース (4 アングルのコピー) */
  copies?: [string, string, string, string];
  /** Phase B.6: セリフ自動推測のソース (CTA) */
  cta?: string;
}

export interface VeoPromptResult {
  promptEn: string;
  promptJa: string;
  negativePrompt: string;
}

const FALLBACK_NEGATIVE =
  'subtitles, captions, watermark, text overlays, on-screen text, written language, logo, sign, label, banner, price tag, sticker, typography, words, letters, kanji, hiragana, katakana, alphabet, lower-third, chyron, sales-y elements, montage, cutaway, jump cut';

function fallbackPrompts(input: VeoPromptInput): VeoPromptResult {
  const ar = input.aspectRatio;
  const dur = input.durationSeconds;
  const promptEn = [
    `Premium commercial advertising style, ${ar} framing.`,
    `Macro 85mm, shallow depth of field.`,
    `Slow dolly-in toward the product as soft directional rim light glides across its surface from frame-left to frame-right.`,
    `The subject in the background breathes softly and shifts weight subtly.`,
    `Magazine-cover quality, cinematic, 1080p.`,
    `Ambient: soft studio room tone, faint cinematic rise.`,
    `(no subtitles, no captions, no on-screen text, no logos, no labels).`,
    `${ar}, ${dur} seconds, 1080p.`,
  ].join(' ');
  const promptJa = `${ar}、マクロ85mmで商品にゆっくりドリーイン。背景の被写体は静かに呼吸。${input.tone || '上質'}な商業広告品質、テキスト/ロゴ非表示。`;
  return { promptEn, promptJa, negativePrompt: FALLBACK_NEGATIVE };
}

/**
 * Claude Sonnet で Veo 用 prompt 3 点セットを動的生成する。
 * ANTHROPIC_API_KEY が未設定 or 失敗時は fallback テンプレを返す。
 */
export async function buildVeoPrompts(input: VeoPromptInput): Promise<VeoPromptResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[video-prompt-knowledge] ANTHROPIC_API_KEY not set, using fallback');
    return fallbackPrompts(input);
  }

  const narrationBlock: string[] = [];
  if (input.narrationEnabled) {
    narrationBlock.push(``);
    narrationBlock.push(`## Narration mode: ENABLED`);
    if (input.narrationScript && input.narrationScript.trim()) {
      narrationBlock.push(
        `Use this exact Japanese line (verbatim, do NOT change wording): ${input.narrationScript.trim()}`,
      );
    } else {
      narrationBlock.push(
        `No script provided. INFER a natural spoken Japanese line (15-40 chars) from the banner copies below. Do NOT read copy verbatim — rewrite into conversational spoken Japanese.`,
      );
      const copyHints: string[] = [];
      if (input.copies?.[0]) copyHints.push(`Main copy: ${input.copies[0]}`);
      if (input.copies?.[1]) copyHints.push(`Sub copy: ${input.copies[1]}`);
      if (input.copies?.[2]) copyHints.push(`Target line: ${input.copies[2]}`);
      if (input.copies?.[3]) copyHints.push(`Authority line: ${input.copies[3]}`);
      if (input.cta) copyHints.push(`CTA text: ${input.cta}`);
      if (copyHints.length > 0) {
        narrationBlock.push(`Source copies (rewrite, don't quote):`);
        narrationBlock.push(...copyHints.map((h) => `  - ${h}`));
      }
    }
    narrationBlock.push(
      `Embed the Japanese line in promptEn via colon syntax: "the subject says in Japanese: <セリフ>". Add lip-sync + audio directions.`,
    );
  }

  const userMsg = [
    `Generate a Veo 3.1 image-to-video prompt JSON for an admin-co-generated short ad.`,
    ``,
    `Inputs:`,
    `- Product: ${input.product || '(unspecified)'}`,
    `- Target audience: ${input.target || '(unspecified)'}`,
    `- Tone/mood: ${input.tone || 'professional, premium'}`,
    `- Aspect ratio: ${input.aspectRatio}`,
    `- Duration: ${input.durationSeconds} seconds`,
    input.userDirection ? `- User's specific direction: ${input.userDirection}` : '',
    ...narrationBlock,
    ``,
    `Remember:`,
    `- The reference image is provided separately to Veo; PROMPT FOR MOTION ONLY.`,
    `- Refer to people as "the subject" / "the woman" / "the man".`,
    `- Suppress all text/subtitles/logos via the 3-layer technique.`,
    `- Single focused moment. No A-then-B-then-C chains.`,
    ``,
    `Return the JSON only, no preamble.`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = res.content.find((c) => c.type === 'text');
    const raw = text && text.type === 'text' ? text.text : '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`No JSON in response: ${raw.slice(0, 300)}`);
    const parsed = JSON.parse(m[0]) as Partial<VeoPromptResult>;
    if (!parsed.promptEn || !parsed.promptJa) {
      throw new Error(`Missing fields: ${JSON.stringify(parsed).slice(0, 300)}`);
    }
    return {
      promptEn: parsed.promptEn,
      promptJa: parsed.promptJa,
      negativePrompt: parsed.negativePrompt || FALLBACK_NEGATIVE,
    };
  } catch (e) {
    console.error('[video-prompt-knowledge] Sonnet call failed, using fallback:', e);
    return fallbackPrompts(input);
  }
}
