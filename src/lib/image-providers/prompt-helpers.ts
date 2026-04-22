import type { GenerateParams } from './types';

/**
 * copyBundle から「画像内にこの日本語テキストだけを正確に描画せよ」という
 * 各プロバイダ共通の強い指示文を構築する。
 * 画像モデルの fabricate（勝手な数字/文字生成）を抑え、指定文字列以外の
 * 日本語文字を画像内に出さないよう negative cue を含める。
 */
export function buildBakeTextInstruction(bundle: NonNullable<GenerateParams['copyBundle']>): string {
  const lines: string[] = [];

  const main = (bundle.mainCopy ?? '').trim();
  const sub = (bundle.subCopy ?? '').trim();
  const cta = (bundle.ctaText ?? '').trim();
  const primary = (bundle.primaryBadgeText ?? '').trim();
  const secondary = (bundle.secondaryBadgeText ?? '').trim();

  // 🚨 重要: プロンプト先頭に日本語テキストを「引用符で囲み最優先」で明示。
  // orchestrator/要約で文字が欠落する問題を防ぐ。
  lines.push(
    '🚨 CRITICAL: このバナーには以下の日本語テキストを一字一句完全一致でレンダリングせよ。',
    '置換・省略・意訳禁止。指定文字列以外の日本語テキストは一切画像に描画しないこと。',
    '',
    '【RENDER EXACTLY】',
  );

  if (main) {
    lines.push(`★ MAIN_COPY (largest hero typography):`);
    lines.push(`「${main}」`);
    lines.push('');
  }
  if (sub) {
    lines.push(`★ SUB_COPY (smaller, supporting):`);
    lines.push(`「${sub}」`);
    lines.push('');
  }
  if (primary) {
    lines.push(`★ PRIMARY_BADGE (inside colored circular/rect badge):`);
    lines.push(`「${primary}」`);
    lines.push('');
  }
  if (secondary) {
    lines.push(`★ SECONDARY_BADGE (gold circle at top corner, authority claim):`);
    lines.push(`「${secondary}」`);
    lines.push('');
  }
  if (cta) {
    lines.push(`★ CTA_BUTTON_TEXT (inside bottom button):`);
    lines.push(`「${cta}」`);
    lines.push('');
  }

  lines.push(
    '【STRICT RULES】',
    '1. Render each Japanese string EXACTLY character-by-character. Do NOT substitute 累→果, 選→遅, 慣→賣, 破→根, 突→突 etc.',
    '2. Do NOT invent additional Japanese text, percentages, numbers, or decorative labels.',
    '3. Do NOT copy labels like "928%", "満足度", "実感" from reference banners.',
    '4. Render each text exactly ONCE — no duplicates, no ghost layers.',
    '5. Use bold Gothic Japanese typography similar to reference banners.',
    '6. Japanese characters must be crisp, readable, and properly kerned.',
  );

  return lines.join('\n');
}
