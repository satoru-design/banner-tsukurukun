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
import { incrementLpUsage, getLpUsageStatus } from './limits';
import { sendLpMeteredUsage } from '@/lib/billing/lp-usage-records';

export async function generateLandingPage(args: {
  userId: string;
  brief: LpBrief;
}): Promise<{ landingPageId: string; sections: LpSection[]; title: string; kvImageUrl: string }> {
  const prisma = getPrisma();

  // ステップ 1: AI 自動セクション選定（Gemini 2.5 Pro が 7〜9 セクションを判断）
  const sectionTypes = await selectSectionsForBrief(args.brief);

  // ステップ 2: 仮の LandingPage を作成（KV 画像の Blob path に landingPageId を使うため先に発行）
  // I-5 fix: 同一 user 同一 ms の slug 衝突回避にランダムサフィックス
  const slug = `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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

  try {
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

    // I-4 fix: title は productName 固定（headline は sections[hero].props.headline に存続）。
    // 安定した dashboard / sitemap / OGP fallback を保証。
    const title = args.brief.productName;

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

    // D11 Task 17: usage 加算 + Pro 超過時メータード課金
    //   加算は同期で実行（次回 generate の hard cap 判定に反映するため）。
    //   メータード送信は fire-and-forget（Stripe API 失敗で生成は止めない）。
    await incrementLpUsage(args.userId);
    const usageAfter = await getLpUsageStatus(args.userId);
    if (
      usageAfter.plan === 'pro' &&
      usageAfter.currentUsage > usageAfter.softLimit &&
      usageAfter.stripeCustomerId
    ) {
      sendLpMeteredUsage({
        stripeCustomerId: usageAfter.stripeCustomerId,
        landingPageId: lp.id,
      }).catch((err) => {
        console.error('[orchestrator] sendLpMeteredUsage failed', err);
      });
    }

    return {
      landingPageId: lp.id,
      sections: finalSections,
      title,
      kvImageUrl: kvResult.kvImageUrl,
    };
  } catch (err) {
    // C-1 fix: 生成失敗時の orphan LP クリーンアップ。
    // ステップ 2 で先に空 LP を作っているため、ステップ 3-6 のいずれかが throw すると
    // title=productName / sections=[] の空行が残ってしまう。これを削除してから再 throw。
    console.error('[orchestrator] generation failed, deleting orphan LP', lp.id, err);
    await prisma.landingPage.delete({ where: { id: lp.id } }).catch((deleteErr) => {
      console.error('[orchestrator] orphan cleanup failed', deleteErr);
    });
    throw err;
  }
}
