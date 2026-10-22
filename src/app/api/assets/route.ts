import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { uploadAssetImage } from '@/lib/assets/blob-client';
import { auth } from '@/lib/auth/auth';
import { validateImageUpload } from '@/lib/uploads/image-validation';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** blob-client 側の上限と同値。route で先に弾いて 400 を返す。 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
    return internalErrorResponse('assets GET', error, '素材の取得に失敗しました');
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

    // 申告 MIME とマジックバイトの両方を検証する。
    // 以前は file.type をそのまま public Blob の contentType にしていたため、
    // text/html を申告した HTML を置けば自社 Blob ドメインから配信できた。
    const bytes = await file.arrayBuffer();
    const validated = validateImageUpload(file.type, bytes, MAX_UPLOAD_BYTES);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.reason }, { status: 400 });
    }
    const mime = validated.contentType;
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
    return internalErrorResponse('assets POST', error, '素材の保存に失敗しました');
  }
}
