import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { uploadAssetImage } from '@/lib/assets/blob-client';
import { auth } from '@/lib/auth/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VALID_TYPES = ['product', 'badge', 'logo', 'other'] as const;
type AssetType = (typeof VALID_TYPES)[number];

function isValidType(t: string): t is AssetType {
  return (VALID_TYPES as readonly string[]).includes(t);
}

/**
 * GET /api/assets?type=product|badge|logo|other
 * 自分の Asset のみ返す。admin は userId=NULL の seed も合流。
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type');
    const isAdmin = session.user.plan === 'admin';

    const userScope = isAdmin
      ? { OR: [{ userId: session.user.id }, { userId: null }] }
      : { userId: session.user.id };

    const where = {
      ...(typeParam && isValidType(typeParam) ? { type: typeParam } : {}),
      ...userScope,
    };

    const prisma = getPrisma();
    const assets = await prisma.asset.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json({ assets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Assets GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/assets
 * multipart/form-data: file, type, name
 * → Vercel Blob にアップロード → Asset レコード作成（userId は session から強制セット）
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const type = String(formData.get('type') ?? '');
    const name = String(formData.get('name') ?? '').trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!isValidType(type)) {
      return NextResponse.json(
        { error: `type must be one of ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const mime = file.type || 'image/png';
    const blobUrl = await uploadAssetImage(type, file.name || 'asset.png', bytes, mime);

    const prisma = getPrisma();
    const created = await prisma.asset.create({
      data: {
        type,
        name,
        blobUrl,
        mimeType: mime,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ asset: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Assets POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
