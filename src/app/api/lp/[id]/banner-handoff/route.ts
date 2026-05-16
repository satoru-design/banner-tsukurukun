import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import type { LpSection } from '@/lib/lp/types';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const prisma = getPrisma();

  const lp = await prisma.landingPage.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!lp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sections = lp.sections as unknown as LpSection[];
  const hero = sections.find((s) => s.type === 'hero')?.props as
    | { headline?: string; subheadline?: string }
    | undefined;
  const brief = lp.brief as unknown as {
    productName?: string;
    target?: string;
    offer?: string;
    lpUrl?: string;
  };

  const userSlug = lp.userId.slice(-8);
  const lpPublicUrl =
    lp.status === 'published'
      ? `https://lpmaker-pro.com/site/${userSlug}/${lp.slug}`
      : null;

  // I-3 fix: brief 情報を query string に直接乗せて autobanner.jp 側に渡す。
  //   autobanner.jp 側で読み取る実装は別タスク。今は未対応でも URL は壊れない（無視される）。
  const handoffUrl =
    `https://autobanner.jp/ironclad?prefill=${lp.id}` +
    (lpPublicUrl ? `&lp=${encodeURIComponent(lpPublicUrl)}` : '') +
    `&product=${encodeURIComponent(brief.productName ?? '')}` +
    `&target=${encodeURIComponent(brief.target ?? '')}` +
    `&offer=${encodeURIComponent(brief.offer ?? '')}` +
    `&headline=${encodeURIComponent(hero?.headline ?? '')}`;

  return NextResponse.json({
    handoffUrl,
    brief: {
      productName: brief.productName,
      target: brief.target,
      offer: brief.offer,
      lpUrl: lpPublicUrl ?? brief.lpUrl,
    },
    hero: {
      headline: hero?.headline,
      subheadline: hero?.subheadline,
    },
  });
}
