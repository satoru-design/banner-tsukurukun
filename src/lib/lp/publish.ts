import { getPrisma } from '@/lib/prisma';
import type { LpSection } from './types';
import { generateOgImage } from './og-generator';
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
  if (targetSlug !== lp.slug) {
    const dup = await prisma.landingPage.findFirst({
      where: {
        userId: args.userId,
        slug: targetSlug,
        NOT: { id: args.landingPageId },
      },
      select: { id: true },
    });
    if (dup) throw new Error(`slug "${targetSlug}" は既に使用中`);
  }

  const sections = lp.sections as unknown as LpSection[];
  const heroProps = sections.find((s) => s.type === 'hero')?.props as
    | { headline?: string }
    | undefined;
  const headline = heroProps?.headline ?? lp.title;
  const { ogImageUrl } = await generateOgImage({
    landingPageId: lp.id,
    headline,
  });

  await prisma.landingPage.update({
    where: { id: lp.id },
    data: {
      slug: targetSlug,
      status: 'published',
      publishedAt: new Date(),
      ogImageUrl,
      ...(args.analyticsConfig && {
        analyticsConfig: args.analyticsConfig as unknown as object,
      }),
    },
  });

  const userSlug = await findUniqueUserSlug(prisma, args.userId);
  const publishedUrl = `https://lpmaker-pro.com/site/${userSlug}/${targetSlug}`;

  return { slug: targetSlug, ogImageUrl, publishedUrl };
}
