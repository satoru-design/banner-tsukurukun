import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { uploadAssetImage } from '@/lib/assets/blob-client';
import { analyzeWinningBanner } from '@/lib/winning-banner/analyze';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import type { WinningBannerDTO } from '@/lib/winning-banner/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const WINNING_TYPE = 'winning_banner';

/**
 * GET /api/winning-banners
 * type='winning_banner' のレコードを createdAt 降順で全件返す。
 */
export async function GET() {
  try {
    if (process.env.WINNING_BANNER_ENABLED === 'false') {
      return NextResponse.json({ banners: [] });
    }

    const user = await getCurrentUser();
    const prisma = getPrisma();
    const records = await prisma.asset.findMany({
      where: {
        type: WINNING_TYPE,
        // Phase 1: userId は常に null。Phase 2 でフィルタ有効化。
        ...(user.userId ? { userId: user.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const banners: WinningBannerDTO[] = records.map((r) => ({
      id: r.id,
      name: r.name,
      blobUrl: r.blobUrl,
      mimeType: r.mimeType,
      analysisAbstract: r.analysisAbstract as WinningBannerDTO['analysisAbstract'],
      analysisVersion: r.analysisVersion,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({ banners });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('winning-banners GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/winning-banners
 * Content-Type で分岐:
 * - multipart/form-data: ファイルアップロード (file: File, name?: string)
 * - application/json: URL指定 ({ url: string, name?: string })
 *
 * フロー: Blob保存 → Gemini Vision解析 → DB保存 → DTO返却
 */
export async function POST(req: Request) {
  try {
    if (process.env.WINNING_BANNER_ENABLED === 'false') {
      return NextResponse.json({ error: 'Feature is disabled' }, { status: 403 });
    }

    const user = await getCurrentUser();
    const contentType = req.headers.get('content-type') ?? '';

    let bytes: ArrayBuffer;
    let mime: string;
    let displayName: string;
    let originalFilename: string;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const nameField = String(form.get('name') ?? '').trim();
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
      }
      bytes = await file.arrayBuffer();
      mime = file.type || 'image/png';
      originalFilename = file.name || 'winning-banner.png';
      displayName = nameField || originalFilename.replace(/\.[^.]+$/, '');
    } else if (contentType.includes('application/json')) {
      const body = (await req.json()) as { url?: string; name?: string };
      const url = body.url?.trim();
      if (!url) {
        return NextResponse.json({ error: 'url is required' }, { status: 400 });
      }
      if (!/^https?:\/\//.test(url)) {
        return NextResponse.json({ error: 'url must start with http:// or https://' }, { status: 400 });
      }
      const fetched = await fetch(url);
      if (!fetched.ok) {
        return NextResponse.json({ error: `Failed to fetch URL: ${fetched.status}` }, { status: 400 });
      }
      bytes = await fetched.arrayBuffer();
      mime = fetched.headers.get('content-type') ?? 'image/jpeg';
      const urlPath = new URL(url).pathname;
      originalFilename = urlPath.split('/').pop() || 'winning-banner.jpg';
      displayName = body.name?.trim() || originalFilename.replace(/\.[^.]+$/, '') || 'winning-banner';
    } else {
      return NextResponse.json(
        { error: `Unsupported content-type: ${contentType}` },
        { status: 400 },
      );
    }

    // 1. Vercel Blob にアップロード
    const blobUrl = await uploadAssetImage(WINNING_TYPE, originalFilename, bytes, mime);

    // 2. Vision 解析
    let analysis;
    try {
      analysis = await analyzeWinningBanner(blobUrl);
    } catch (analyzeErr) {
      console.error('Vision analysis failed, rolling back blob:', analyzeErr);
      // Best-effort blob cleanup
      try {
        const { del } = await import('@vercel/blob');
        await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch (delErr) {
        console.warn('Blob rollback failed:', delErr);
      }
      throw new Error(
        `Vision analysis failed: ${analyzeErr instanceof Error ? analyzeErr.message : String(analyzeErr)}`,
      );
    }

    // 3. DB 保存
    const prisma = getPrisma();
    const created = await prisma.asset.create({
      data: {
        type: WINNING_TYPE,
        name: displayName,
        blobUrl,
        mimeType: mime,
        userId: user.userId,
        analysisAbstract: analysis.abstract as object,
        analysisConcrete: analysis.concrete as object,
        analysisVersion: analysis.version,
      },
    });

    const dto: WinningBannerDTO = {
      id: created.id,
      name: created.name,
      blobUrl: created.blobUrl,
      mimeType: created.mimeType,
      analysisAbstract: created.analysisAbstract as WinningBannerDTO['analysisAbstract'],
      analysisVersion: created.analysisVersion,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };

    return NextResponse.json({ banner: dto });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('winning-banners POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
