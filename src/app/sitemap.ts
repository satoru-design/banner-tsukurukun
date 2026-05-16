import type { MetadataRoute } from 'next';
import { getPrisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const prisma = getPrisma();
  const lps = await prisma.landingPage.findMany({
    where: { status: 'published' },
    select: { slug: true, userId: true, updatedAt: true },
    take: 1000,
  });

  return lps.map((lp) => ({
    url: `https://lpmaker-pro.com/site/${lp.userId.slice(-8)}/${lp.slug}`,
    lastModified: lp.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));
}
