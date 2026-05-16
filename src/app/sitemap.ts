import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getPrisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // I-3 fix: lpmaker-pro.com ホスト以外では空配列を返す（autobanner.jp/sitemap.xml に LP URL を漏らさない）
  const h = await headers();
  const host = (h.get('host') ?? '').toLowerCase();
  if (!host.includes('lpmaker-pro.com')) return [];

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
