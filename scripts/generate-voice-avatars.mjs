/**
 * Phase A.15: CustomerVoiceSection 用のアバター画像を gpt-image-2 で生成。
 *
 * 出力: public/lp/avatars/{key}.png（1024x1024）
 *
 * 使い方:
 *   node --env-file=.env scripts/generate-voice-avatars.mjs
 *
 * 必要 env:
 *   - OPENAI_API_KEY
 */
import OpenAI from 'openai';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const PERSONAS = [
  {
    key: 'yk-marketer',
    prompt: `Modern flat vector illustration of a friendly Japanese woman in her late 20s, working as a digital marketing professional. She wears a smart casual blouse, has shoulder-length hair, and a gentle confident smile. She looks directly at the viewer.

Style: Clean minimal vector / illustration with soft gradients, in the visual language of modern SaaS company website avatars (Stripe, Linear, Notion). Bust shot (head and shoulders), perfectly centered, square 1:1 composition. Soft warm beige / off-white solid background. Approachable, trustworthy, friendly aesthetic. Single subject, no text, no logos.`,
  },
  {
    key: 'ts-designer',
    prompt: `Modern flat vector illustration of a friendly Japanese man in his early 30s, working as a creative UI/UX designer. He wears a casual henley shirt or knit polo (creative casual). Short stylish hair, clean-shaven, with a gentle thoughtful smile. He looks directly at the viewer.

Style: Clean minimal vector / illustration with soft gradients, in the visual language of modern SaaS company website avatars (Stripe, Linear, Notion). Bust shot (head and shoulders), perfectly centered, square 1:1 composition. Soft cool blue-gray solid background. Creative, focused, trustworthy aesthetic. Single subject, no text, no logos.`,
  },
  {
    key: 'mo-owner',
    prompt: `Modern flat vector illustration of a confident Japanese woman in her early 30s, owner of a small e-commerce business. She wears a smart business casual blazer over a simple top. Medium-length hair, warm professional smile. She looks directly at the viewer.

Style: Clean minimal vector / illustration with soft gradients, in the visual language of modern SaaS company website avatars (Stripe, Linear, Notion). Bust shot (head and shoulders), perfectly centered, square 1:1 composition. Soft warm peach solid background. Determined, approachable, entrepreneurial aesthetic. Single subject, no text, no logos.`,
  },
];

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const outputDir = 'public/lp/avatars';
await mkdir(outputDir, { recursive: true });

for (const p of PERSONAS) {
  console.log(`Generating ${p.key}...`);
  const result = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: p.prompt,
    size: '1024x1024',
    quality: 'medium',
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image returned for ${p.key}`);
  const buffer = Buffer.from(b64, 'base64');
  const path = `${outputDir}/${p.key}.png`;
  await writeFile(path, buffer);
  console.log(`  -> ${path} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

console.log('\nAll avatars generated.');
