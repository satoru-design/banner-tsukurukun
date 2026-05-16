import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { LP_SECTION_TYPES, type LpBrief, type LpSectionType } from '@/lib/lp/types';
import { generateSectionVariants } from '@/lib/lp/copy-variants';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, type } = await params;

  if (!LP_SECTION_TYPES.includes(type as LpSectionType)) {
    return NextResponse.json({ error: 'Invalid section type' }, { status: 400 });
  }

  const prisma = getPrisma();

  // admin gate (Sprint 3 D11 で plan-based に置換)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  if (user?.plan !== 'admin') {
    return NextResponse.json({ error: 'Admin only until Sprint 3', adminOnly: true }, { status: 403 });
  }

  const lp = await prisma.landingPage.findFirst({
    where: { id, userId: session.user.id },
    select: { brief: true },
  });
  if (!lp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const variants = await generateSectionVariants(
      lp.brief as unknown as LpBrief,
      type as LpSectionType
    );

    await prisma.landingPageGeneration.createMany({
      data: variants.map((v) => ({
        landingPageId: id,
        sectionType: type,
        prompt: JSON.stringify({ regenerate: true, sectionType: type }),
        output: v as unknown as object,
      })),
    });

    return NextResponse.json({ variants });
  } catch (err) {
    console.error('[/api/lp/[id]/section/[type]/regenerate] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
