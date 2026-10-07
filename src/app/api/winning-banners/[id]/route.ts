import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { deleteAssetBlob } from '@/lib/assets/blob-client';
import { auth } from '@/lib/auth/auth';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';

const WINNING_TYPE = 'winning_banner';

/**
 * DELETE /api/winning-banners/[id]
 * Vercel Blob 実体 + DB レコードを一緒に削除。
 * type='winning_banner' でないレコードは削除対象外（404扱い）。
 *
 * 所有者判定: GET /api/winning-banners が userId で絞っているのに対し
 * ここは id だけで削除していたため、ログイン済なら他人の勝ちバナーを
 * Blob ごと消せた。assets/[id] と同じ規則に揃える。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (process.env.WINNING_BANNER_ENABLED === 'false') {
      return NextResponse.json({ error: 'Feature is disabled' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prisma = getPrisma();
    const asset = await prisma.asset.findUnique({ where: { id } });

    if (!asset || asset.type !== WINNING_TYPE) {
      return NextResponse.json({ error: 'Winning banner not found' }, { status: 404 });
    }

    // 自分の asset のみ。admin は userId=NULL の seed も削除できる（assets/[id] と同じ）。
    const isAdmin = session.user.plan === 'admin';
    const canDelete =
      asset.userId === session.user.id || (isAdmin && asset.userId === null);
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
      await deleteAssetBlob(asset.blobUrl);
    } catch (blobErr) {
      console.warn('Failed to delete blob (continuing):', blobErr);
    }

    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return internalErrorResponse('winning-banner DELETE', error, '削除に失敗しました');
  }
}
