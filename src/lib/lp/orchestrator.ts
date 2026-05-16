/**
 * LP Maker Pro 2.0 — LP 全体オーケストレーター
 *
 * Task 4: 固定セクション配列でコピー生成 + DB 保存。
 * Task 5: AI 自動セクション選定 (selectSectionsForBrief) に差し替え済み。
 * Task 6 で KV 画像生成（gpt-image-2 / Gemini Imagen）を追加予定。
 */
import { getPrisma } from '@/lib/prisma';
import type { LpBrief, LpSection } from './types';
import { generateSectionCopy } from './copy-generator';
import { selectSectionsForBrief } from './section-selector';

export async function generateLandingPage(args: {
  userId: string;
  brief: LpBrief;
}): Promise<{ landingPageId: string; sections: LpSection[]; title: string }> {
  const prisma = getPrisma();

  // ステップ 1: AI 自動セクション選定（Gemini 2.5 Pro が 7〜9 セクションを判断）
  const sectionTypes = await selectSectionsForBrief(args.brief);

  // ステップ 2: 並列でコピー生成
  const sectionResults = await Promise.all(
    sectionTypes.map(async (type, idx): Promise<LpSection> => {
      const props = await generateSectionCopy(args.brief, type);
      return { type, order: idx, enabled: true, props };
    })
  );

  const heroProps = sectionResults.find((s) => s.type === 'hero')?.props as
    | { headline?: string }
    | undefined;
  const title = heroProps?.headline ?? args.brief.productName;

  const slug = `lp-${Date.now().toString(36)}`;

  const lp = await prisma.landingPage.create({
    data: {
      userId: args.userId,
      slug,
      title,
      status: 'draft',
      brief: args.brief as unknown as object,
      sections: sectionResults as unknown as object,
    },
  });

  await prisma.landingPageGeneration.createMany({
    data: sectionResults.map((s) => ({
      landingPageId: lp.id,
      sectionType: s.type,
      prompt: JSON.stringify({ brief: args.brief, sectionType: s.type }),
      output: s.props as unknown as object,
    })),
  });

  return { landingPageId: lp.id, sections: sectionResults, title };
}
