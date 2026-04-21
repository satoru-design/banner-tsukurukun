import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { StyleProfileInput } from '@/lib/style-profile/schema';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();
    const p = await prisma.styleProfile.findUnique({ where: { id } });
    if (!p) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: p.id,
      name: p.name,
      productContext: p.productContext,
      referenceImageUrls: JSON.parse(p.referenceImageUrls),
      visualStyle: JSON.parse(p.visualStyle),
      typography: JSON.parse(p.typography),
      priceBadge: JSON.parse(p.priceBadge),
      cta: JSON.parse(p.cta),
      layout: JSON.parse(p.layout),
      copyTone: JSON.parse(p.copyTone),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Partial<StyleProfileInput>;
    const prisma = getPrisma();

    const data: Record<string, string | undefined> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.productContext !== undefined) data.productContext = body.productContext;
    if (body.referenceImageUrls !== undefined)
      data.referenceImageUrls = JSON.stringify(body.referenceImageUrls);
    if (body.visualStyle !== undefined) data.visualStyle = JSON.stringify(body.visualStyle);
    if (body.typography !== undefined) data.typography = JSON.stringify(body.typography);
    if (body.priceBadge !== undefined) data.priceBadge = JSON.stringify(body.priceBadge);
    if (body.cta !== undefined) data.cta = JSON.stringify(body.cta);
    if (body.layout !== undefined) data.layout = JSON.stringify(body.layout);
    if (body.copyTone !== undefined) data.copyTone = JSON.stringify(body.copyTone);

    const updated = await prisma.styleProfile.update({ where: { id }, data });
    return NextResponse.json({ id: updated.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();

    const bannerCount = await prisma.banner.count({ where: { styleProfileId: id } });
    if (bannerCount > 0) {
      return NextResponse.json(
        { error: `このプロファイルで生成された ${bannerCount} 件のバナーが存在します` },
        { status: 409 },
      );
    }

    await prisma.styleProfile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
