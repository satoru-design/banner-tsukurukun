import { getPrisma } from '@/lib/prisma';
import type { LpSection } from './types';
import { generateOgImage } from './og-generator';
import { notifyNewLpPublished } from '@/lib/slack/notify-new-lp';
import type { PrismaClient } from '@prisma/client';

/**
 * userId の末尾 N 文字で他 user と衝突しない最短のスラグを返す。
 */
async function findUniqueUserSlug(prisma: PrismaClient, userId: string): Promise<string> {
  for (const len of [8, 12, 16, 24]) {
    const candidate = userId.slice(-len);
    const collisions = await prisma.user.count({
      where: {
        id: { endsWith: candidate },
        NOT: { id: userId },
      },
    });
    if (collisions === 0) return candidate;
  }
  return userId; // full id fallback
}

/**
 * LP を公開状態に遷移。
 * - slug の uniqueness 確認
 * - OGP 画像生成
 * - status='published'、publishedAt セット
 */
export async function publishLandingPage(args: {
  userId: string;
  landingPageId: string;
  desiredSlug?: string;
  analyticsConfig?: Record<string, string>;
}): Promise<{ slug: string; ogImageUrl: string; publishedUrl: string }> {
  const prisma = getPrisma();

  const lp = await prisma.landingPage.findFirst({
    where: { id: args.landingPageId, userId: args.userId },
  });
  if (!lp) throw new Error('LP not found');

  const targetSlug = args.desiredSlug?.trim() || lp.slug;

  // I-2 fix: slug + status + analyticsConfig の update を先に実行
  // uniqueness は DB 制約 @@unique([userId, slug]) で担保、P2002 catch で 409
  try {
    await prisma.landingPage.update({
      where: { id: lp.id },
      data: {
        slug: targetSlug,
        status: 'published',
        publishedAt: new Date(),
        ...(args.analyticsConfig && {
          analyticsConfig: args.analyticsConfig as unknown as object,
        }),
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new Error(`slug "${targetSlug}" は既に使用中`);
    }
    throw err;
  }

  // OGP 生成は後 (失敗しても publish は成立、後で再 publish で再生成可能)
  const sections = lp.sections as unknown as LpSection[];
  const heroProps = sections.find((s) => s.type === 'hero')?.props as
    | { headline?: string }
    | undefined;
  const headline = heroProps?.headline ?? lp.title;

  let ogImageUrl = '';
  try {
    const result = await generateOgImage({ landingPageId: lp.id, headline });
    ogImageUrl = result.ogImageUrl;
    await prisma.landingPage.update({
      where: { id: lp.id },
      data: { ogImageUrl },
    });
  } catch (err) {
    console.error('[publish] OGP gen failed, continuing without OGP', err);
  }

  // D14: Slack 通知 (fire-and-forget)
  const userForSlack = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { email: true, name: true, plan: true },
  });
  if (userForSlack) {
    notifyNewLpPublished({
      lp: { id: lp.id, title: lp.title, userId: lp.userId, slug: targetSlug },
      user: userForSlack,
    }).catch((e) => console.error('[publish] slack notify failed', e));
  }

  const userSlug = await findUniqueUserSlug(prisma, args.userId);
  const publishedUrl = `https://lpmaker-pro.com/site/${userSlug}/${targetSlug}`;

  return { slug: targetSlug, ogImageUrl, publishedUrl };
}
