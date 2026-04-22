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

  lines.push('【このバナーに焼き込むテキスト（完全一致、改変禁止）】');

  if (main) {
    lines.push(`- メインコピー（一番大きく、ヒーロー級のタイポグラフィ）:\n"${main}"`);
  }
  if (sub) {
    lines.push(`- サブコピー（メインより小さく、補足として配置）:\n"${sub}"`);
  }
  if (primary) {
    lines.push(`- プライマリ価格バッジ（目立つ色付き丸/矩形バッジ内）:\n"${primary}"`);
  }
  if (secondary) {
    lines.push(
      `- セカンダリ権威バッジ（"累計○○万本突破!!" のような上部角の金色丸バッジ内）:\n"${secondary}"`,
    );
  }
  if (cta) {
    lines.push(`- CTA ボタンテキスト（下部の矩形ボタン内）:\n"${cta}"`);
  }

  lines.push('');
  lines.push(
    '【厳守事項】',
    '1. 上記の文字列を正確にそのままレンダリングすること。一字一句変えない。',
    '2. 上記以外の日本語テキスト・数字・パーセント記号・造語を画像に描画しないこと。',
    '3. 参考バナーから「928%」「満足度」「実感」等の架空数字や追加コピーを拾って勝手に描画しないこと。',
    '4. 文字は重複描画せず、くっきり鮮明に1回だけレンダリングする。ゴースト/ぼやけ禁止。',
    '5. 日本語フォントは参考画像のトーン（太いゴシック、明朝混在可）に従うこと。',
  );

  return lines.join('\n');
}
