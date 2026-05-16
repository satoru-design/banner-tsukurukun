import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { publishLandingPage } from '@/lib/lp/publish';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PublishBodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(60).optional(),
  analyticsConfig: z.record(z.string(), z.string()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  if (user?.plan !== 'admin') {
    return NextResponse.json({ error: 'Admin only until Sprint 3', adminOnly: true }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = PublishBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await publishLandingPage({
      userId: session.user.id,
      landingPageId: id,
      desiredSlug: parsed.data.slug,
      analyticsConfig: parsed.data.analyticsConfig,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/lp/[id]/publish] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
