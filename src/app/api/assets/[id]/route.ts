import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { deleteAssetBlob } from '@/lib/assets/blob-client';

export const runtime = 'nodejs';

/**
 * DELETE /api/assets/[id]
 * Vercel Blob 実体と DB レコードを一緒に削除。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const prisma = getPrisma();
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
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
    console.error('Asset DELETE error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/assets/[id]
 * body: { name?, isPinned? }
 * 名前変更とピン留め切り替え。
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { name?: string; isPinned?: boolean };

    const data: { name?: string; isPinned?: boolean } = {};
    if (typeof body.name === 'string') data.name = body.name.trim();
    if (typeof body.isPinned === 'boolean') data.isPinned = body.isPinned;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const prisma = getPrisma();
    const updated = await prisma.asset.update({ where: { id }, data });
    return NextResponse.json({ asset: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Asset PATCH error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
