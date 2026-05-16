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
  // I-1 fix: endsWith に該当する全 user を取得して、複数いる場合は anti-collision check
  const users = await prisma.user.findMany({
    where: { id: { endsWith: userSlug } },
    select: { id: true },
  });
  if (users.length === 0) return null;
  if (users.length > 1) {
    // 複数該当する場合: publish 時のロジックは「衝突がなくなる最短長」を使ったので、
    // ここでは「userSlug 長 ≤ 8 だが他に該当ユーザーがいる」ケースは "URL 解決不能" として 404
    return null;
  }
  const user = users[0];

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
