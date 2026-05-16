import type { LpBrief, LpSectionType } from './types';
import { generateSectionCopy } from './copy-generator';

/**
 * 1 セクションの「もう一案」を 3 並列で生成。
 *
 * 同一プロンプトでも Gemini 2.5 Pro の sampling で異なる出力が得られる。
 * 失敗時は部分結果でも返す（最低 1 案あれば OK）。
 */
export async function generateSectionVariants(
  brief: LpBrief,
  sectionType: LpSectionType
): Promise<Record<string, unknown>[]> {
  const results = await Promise.allSettled([
    generateSectionCopy(brief, sectionType),
    generateSectionCopy(brief, sectionType),
    generateSectionCopy(brief, sectionType),
  ]);

  const variants = results
    .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (variants.length === 0) {
    throw new Error('all 3 variants failed');
  }
  return variants;
}
