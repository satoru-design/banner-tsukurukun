import { NextResponse } from 'next/server';
import { uploadReferenceImage } from '@/lib/style-profile/blob-client';
import { extractStyleFromReferences } from '@/lib/style-profile/extractor';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { validateImageUpload } from '@/lib/uploads/image-validation';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MIN_IMAGES = 2;
const MAX_IMAGES = 7;

/** blob-client 側の上限と同値。route で先に弾いて 400 を返す。 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  // この route は Blob への書き込みと AI 解析（従量課金）の両方を行うため、
  // middleware だけに頼らず route 側でもログインを必須にする。
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // 申告 MIME とマジックバイトの両方を検証してから Blob に置く。
    // 以前は file.type をそのまま public Blob の contentType にしていた。
    const prepared: { buf: ArrayBuffer; name: string; contentType: string }[] = [];
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const validated = validateImageUpload(file.type, buf, MAX_UPLOAD_BYTES);
      if (!validated.ok) {
        return NextResponse.json(
          { error: `${file.name || '画像'}: ${validated.reason}` },
          { status: 400 },
        );
      }
      prepared.push({ buf, name: file.name, contentType: validated.contentType });
    }

    const referenceImageUrls = await Promise.all(
      prepared.map((p) => uploadReferenceImage(p.name, p.buf, p.contentType)),
    );

    const extracted = await extractStyleFromReferences(referenceImageUrls);

    return NextResponse.json({ referenceImageUrls, ...extracted });
  } catch (error: unknown) {
    return internalErrorResponse(
      'style-profile extract',
      error,
      'スタイル抽出に失敗しました',
    );
  }
}
