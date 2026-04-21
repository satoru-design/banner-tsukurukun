import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const data = await req.json();
    const {
      productName,
      lpUrl,
      target,
      mainCopy,
      subCopy,
      elements,
      base64Image,
      angle,
      imageModel,
      // Phase A.5
      angleId,
      priceBadge,
      ctaTemplateId,
      ctaText,
      emphasisRatio,
      urgency,
    } = data;

    const banner = await prisma.banner.create({
      data: {
        productName,
        lpUrl,
        target,
        mainCopy,
        subCopy,
        elements: JSON.stringify(elements),
        base64Image,
        angle,
        imageModel,
        angleId,
        priceBadge: priceBadge ? JSON.stringify(priceBadge) : null,
        ctaTemplateId,
        ctaText,
        emphasisRatio,
        urgency,
      },
    });

    return NextResponse.json({ success: true, banner });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    console.error('Save Banner Error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const prisma = getPrisma();
    const banners = await prisma.banner.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ banners });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
