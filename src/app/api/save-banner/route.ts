import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


let prisma: PrismaClient;
export async function POST(req: Request) {
  if(!prisma) prisma = new PrismaClient();

  try {
    const data = await req.json();
    const { productName, lpUrl, target, mainCopy, subCopy, elements, base64Image, angle } = data;

    const banner = await prisma.banner.create({
      data: {
        productName,
        lpUrl,
        target,
        mainCopy,
        subCopy,
        elements: JSON.stringify(elements),
        base64Image,
        angle
      }
    });

    return NextResponse.json({ success: true, banner });
  } catch(e: any) {
    console.error("Save Banner Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if(!prisma) prisma = new PrismaClient();

  try {
     const banners = await prisma.banner.findMany({
        orderBy: { createdAt: 'desc' }
     });
     return NextResponse.json({ banners });
  } catch(e: any) {
     return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
