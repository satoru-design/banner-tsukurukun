import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { LP_SECTION_TYPES } from '@/lib/lp/types';

export const runtime = 'nodejs';

const LpSectionUpdateSchema = z.object({
  type: z.enum(LP_SECTION_TYPES),
  order: z.number().int().min(0),
  enabled: z.boolean(),
  props: z.record(z.string(), z.unknown()),
});

const PatchBodySchema = z.object({
  sections: z.array(LpSectionUpdateSchema).optional(),
  title: z.string().min(1).max(200).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // D11 Task 17: admin gate 解除。ownership check (LandingPage.userId == session.user.id)
  //   で他人の LP 編集は防げる。編集自体は usage 消費しない（生成時に課金済み）ため
  //   plan ベース gate も不要。
  const prisma = getPrisma();

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.landingPage.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.landingPage.update({
    where: { id },
    data: {
      ...(parsed.data.sections !== undefined && { sections: parsed.data.sections as unknown as object }),
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
    },
  });

  return NextResponse.json({ ok: true });
}
