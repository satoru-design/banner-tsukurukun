/**
 * LP Maker Pro 2.0 — LP 全体オーケストレーター
 *
 * Task 4: 固定セクション配列でコピー生成 + DB 保存。
 * Task 5: AI 自動セクション選定 (selectSectionsForBrief) に差し替え済み。
 * Task 6: KV 画像生成 (gpt-image-2 + Vercel Blob) をコピー生成と並列で実行し、
 *         hero.props.imageUrl に注入する。
 */
import { getPrisma } from '@/lib/prisma';
import type { LpBrief, LpSection } from './types';
import { generateSectionCopy } from './copy-generator';
import { selectSectionsForBrief } from './section-selector';
import { generateKvImage } from './image-generator';

export async function generateLandingPage(args: {
  userId: string;
  brief: LpBrief;
}): Promise<{ landingPageId: string; sections: LpSection[]; title: string; kvImageUrl: string }> {
  const prisma = getPrisma();

  // ステップ 1: AI 自動セクション選定（Gemini 2.5 Pro が 7〜9 セクションを判断）
  const sectionTypes = await selectSectionsForBrief(args.brief);

  // ステップ 2: 仮の LandingPage を作成（KV 画像の Blob path に landingPageId を使うため先に発行）
  const slug = `lp-${Date.now().toString(36)}`;
  const lp = await prisma.landingPage.create({
    data: {
      userId: args.userId,
      slug,
      title: args.brief.productName,
      status: 'draft',
      brief: args.brief as unknown as object,
      sections: [] as unknown as object,
    },
  });

  // ステップ 3: コピー生成と KV 画像生成を並列実行
  const [sectionResults, kvResult] = await Promise.all([
    Promise.all(
      sectionTypes.map(async (type, idx): Promise<LpSection> => {
        const props = await generateSectionCopy(args.brief, type);
        return { type, order: idx, enabled: true, props };
      })
    ),
    generateKvImage({ brief: args.brief, landingPageId: lp.id }),
  ]);

  // ステップ 4: hero セクションの props に kvImageUrl を注入
  const finalSections = sectionResults.map((s) =>
    s.type === 'hero'
      ? { ...s, props: { ...s.props, imageUrl: kvResult.kvImageUrl } }
      : s
  );

  const heroProps = finalSections.find((s) => s.type === 'hero')?.props as
    | { headline?: string }
    | undefined;
  const title = heroProps?.headline ?? args.brief.productName;

  // ステップ 5: LandingPage を更新（最終タイトル + セクション）
  await prisma.landingPage.update({
    where: { id: lp.id },
    data: {
      title,
      sections: finalSections as unknown as object,
    },
  });

  // ステップ 6: 生成履歴保存
  await prisma.landingPageGeneration.createMany({
    data: finalSections.map((s) => ({
      landingPageId: lp.id,
      sectionType: s.type,
      prompt: JSON.stringify({ brief: args.brief, sectionType: s.type }),
      output: s.props as unknown as object,
    })),
  });

  return {
    landingPageId: lp.id,
    sections: finalSections,
    title,
    kvImageUrl: kvResult.kvImageUrl,
  };
}
