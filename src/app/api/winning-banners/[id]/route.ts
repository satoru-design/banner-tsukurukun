import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { deleteAssetBlob } from '@/lib/assets/blob-client';

export const runtime = 'nodejs';

const WINNING_TYPE = 'winning_banner';

/**
 * DELETE /api/winning-banners/[id]
 * Vercel Blob 実体 + DB レコードを一緒に削除。
 * type='winning_banner' でないレコードは削除対象外（404扱い）。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (process.env.WINNING_BANNER_ENABLED === 'false') {
      return NextResponse.json({ error: 'Feature is disabled' }, { status: 403 });
    }

    const { id } = await params;
    const prisma = getPrisma();
    const asset = await prisma.asset.findUnique({ where: { id } });

    if (!asset || asset.type !== WINNING_TYPE) {
      return NextResponse.json({ error: 'Winning banner not found' }, { status: 404 });
    }

    try {
      await deleteAssetBlob(asset.blobUrl);
    } catch (blobErr) {
      console.warn('Failed to delete blob (continuing):', blobErr);
    }

    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('winning-banner DELETE error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
