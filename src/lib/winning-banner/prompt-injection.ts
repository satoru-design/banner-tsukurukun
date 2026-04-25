import type { AnalysisAbstract } from './types';

/**
 * 直近 N 件の analysisAbstract を集約し、
 * suggest プロンプトに注入する「過去の勝ちパターン傾向」テキストを生成する。
 *
 * 入力された abstract のみ使用。concrete は絶対に触らない（型レベルで保証）。
 *
 * 業種跨ぎ対応の保険文言を末尾に必ず付与し、
 * Gemini が「ブリーフ優先・傾向は参考程度」と判断できるようにする。
 */
export function buildWinningPatternInjection(abstracts: AnalysisAbstract[]): string {
  if (abstracts.length === 0) return '';

  const palettes = unique(abstracts.map((a) => a.palette));
  const copyAngles = unique(abstracts.map((a) => a.copyAngle));
  const ctas = unique(abstracts.map((a) => a.cta));
  const layouts = unique(abstracts.map((a) => a.layout));
  const typos = unique(abstracts.map((a) => a.typo));
  const moods = unique(abstracts.map((a) => a.mood));

  // pattern は出現頻度カウント
  const patternCounts = new Map<string, number>();
  for (const a of abstracts) {
    patternCounts.set(a.pattern, (patternCounts.get(a.pattern) ?? 0) + 1);
  }
  const patternsByFreq = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `${p}(${n}件)`)
    .join(', ');

  return `

[過去の勝ちパターン傾向（直近${abstracts.length}件集約）]
配色: ${palettes.join(' / ')}
コピー切り口: ${copyAngles.join(' / ')}
CTA: ${ctas.join(' / ')}
レイアウト: ${layouts.join(' / ')}
タイポ: ${typos.join(' / ')}
ムード: ${moods.join(' / ')}
訴求パターン: ${patternsByFreq}

⚠ 重要な解釈指示:
上記傾向は過去の勝ちバナーから抽出されたもので、業種・商材が今回のブリーフと
異なる場合があります。**ブリーフで指定された商材性質・ターゲットを最優先**し、
過去傾向は「視覚スタイル・コピー切り口の方向性のヒント」として柔軟に解釈してください。
一致しない要素は無視して構いません。

🚨 **字数制限は絶対優先**:
過去傾向が長文化を示唆していても、システムプロンプトで指定された
コピー字数上限（コピー1: 20字 / コピー2: 35字 / コピー3: 25字 / コピー4: 20字 / CTA: 12字）は
1文字も超えてはいけません。傾向反映と字数制限が衝突した場合、字数制限を優先してください。
`;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter((s) => s && s.trim())));
}
