import { NextResponse } from 'next/server';
import { uploadReferenceImage } from '@/lib/style-profile/blob-client';
import { extractStyleFromReferences } from '@/lib/style-profile/extractor';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MIN_IMAGES = 2;
const MAX_IMAGES = 7;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) files.push(value);
    }

    if (files.length < MIN_IMAGES) {
      return NextResponse.json(
        { error: `${MIN_IMAGES} 枚以上の画像が必要です` },
        { status: 400 },
      );
    }
    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `${MAX_IMAGES} 枚までしか受け付けられません` },
        { status: 400 },
      );
    }

    const referenceImageUrls = await Promise.all(
      files.map(async (file) => {
        const buf = await file.arrayBuffer();
        return uploadReferenceImage(file.name, buf, file.type || 'image/jpeg');
      }),
    );

    const extracted = await extractStyleFromReferences(referenceImageUrls);

    return NextResponse.json({ referenceImageUrls, ...extracted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Style profile extract error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
