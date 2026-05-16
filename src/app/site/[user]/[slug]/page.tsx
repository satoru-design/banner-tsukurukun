import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPrisma } from '@/lib/prisma';
import type { LpSection } from '@/lib/lp/types';
import { SectionRenderer } from '@/components/lp-maker/SectionRenderer';
import { AnalyticsInjector } from '@/components/lp-maker/AnalyticsInjector';

export const dynamic = 'force-static';
export const revalidate = 60;

async function fetchPublishedLp(userSlug: string, lpSlug: string) {
  const prisma = getPrisma();
  // userSlug = userId 末尾 8 文字（publish.ts と一致）
  const user = await prisma.user.findFirst({
    where: { id: { endsWith: userSlug } },
    select: { id: true },
  });
  if (!user) return null;

  const lp = await prisma.landingPage.findFirst({
    where: { userId: user.id, slug: lpSlug, status: 'published' },
  });
  return lp;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string; slug: string }>;
}): Promise<Metadata> {
  const { user, slug } = await params;
  const lp = await fetchPublishedLp(user, slug);
  if (!lp) return { title: 'Not Found' };

  return {
    title: lp.title,
    openGraph: {
      title: lp.title,
      images: lp.ogImageUrl ? [{ url: lp.ogImageUrl, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: lp.title,
      images: lp.ogImageUrl ? [lp.ogImageUrl] : [],
    },
  };
}

export default async function PublicLpPage({
  params,
}: {
  params: Promise<{ user: string; slug: string }>;
}) {
  const { user, slug } = await params;
  const lp = await fetchPublishedLp(user, slug);
  if (!lp) notFound();

  const sections = (lp.sections as unknown as LpSection[])
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const config = (lp.analyticsConfig as unknown as Record<string, string>) ?? {};

  return (
    <>
      <AnalyticsInjector config={config} />
      <main>
        {sections.map((s, i) => (
          <SectionRenderer key={`${s.type}-${i}`} section={s} />
        ))}
        <footer className="bg-slate-950 text-slate-500 text-xs text-center py-4">
          Powered by{' '}
          <a href="https://lpmaker-pro.com" className="text-emerald-400 hover:underline">
            LP Maker Pro
          </a>
        </footer>
      </main>
    </>
  );
}
