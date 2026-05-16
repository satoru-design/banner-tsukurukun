import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { LP_SECTION_TYPES, type LpBrief, type LpSectionType } from '@/lib/lp/types';
import { generateSectionVariants } from '@/lib/lp/copy-variants';
import { getLpUsageStatus, incrementLpUsage } from '@/lib/lp/limits';
import { sendLpMeteredUsage } from '@/lib/billing/lp-usage-records';

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

  // D11 Task 17: regenerate も LP 生成 1 本としてカウント（コピー生成 + Gemini コスト発生）
  //   hard cap ブロック判定のみ事前実施。usage 加算は成功時のみ実行する。
  const usage = await getLpUsageStatus(session.user.id);
  if (usage.isHardBlocked) {
    return NextResponse.json(
      {
        error: `今月の LP 生成上限 (${usage.hardCap} 本) に達しました`,
        plan: usage.plan,
        currentUsage: usage.currentUsage,
        hardCap: usage.hardCap,
      },
      { status: 429 }
    );
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

    // D11 Task 17: 成功時のみ usage 加算 + Pro 超過時メータード課金 (fire-and-forget)
    await incrementLpUsage(session.user.id);
    const usageAfter = await getLpUsageStatus(session.user.id);
    if (
      usageAfter.plan === 'pro' &&
      usageAfter.currentUsage > usageAfter.softLimit &&
      usageAfter.stripeCustomerId
    ) {
      // C-3 fix: regenerate は同一 LP で複数回走り得るので、ts + random で完全 unique 化。
      sendLpMeteredUsage({
        stripeCustomerId: usageAfter.stripeCustomerId,
        identifier: `lp-regen-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }).catch((err) => console.error('[regenerate] sendLpMeteredUsage failed', err));
    }

    return NextResponse.json({ variants });
  } catch (err) {
    console.error('[/api/lp/[id]/section/[type]/regenerate] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
