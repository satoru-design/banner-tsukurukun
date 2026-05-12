import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/auth';

export const runtime = 'nodejs';

/**
 * Asset への書き込み権を判定する。
 * - 所有者本人は常に OK
 * - admin は userId=NULL の seed もバイパスで OK
 */
function canMutate(asset: { userId: string | null }, sessionUserId: string, isAdmin: boolean): boolean {
  if (asset.userId === sessionUserId) return true;
  if (isAdmin && asset.userId === null) return true;
  return false;
}

/**
 * DELETE /api/assets/[id]
 * 自分の Asset のみ削除可能。admin は seed (userId=NULL) も削除可能。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prisma = getPrisma();
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const isAdmin = session.user.plan === 'admin';
    if (!canMutate(asset, session.user.id, isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Blob 実体は意図的に残す。
    // 過去 Generation の briefSnapshot に絶対 URL が焼き込まれているため、
    // Blob を消すと再生成/再試行で 404 → gpt-image-2 が全体エラーになるゾンビ化が発生する。
    // 孤立 Blob はライブラリから不可視 (Asset レコードのみ削除) でユーザー影響なし。
    // 将来的にコスト面で気になれば、参照棚卸し付きの GC ジョブを別途用意する。
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
 * 自分の Asset のみ更新可能。admin は seed (userId=NULL) も更新可能。
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as { name?: string; isPinned?: boolean };

    const data: { name?: string; isPinned?: boolean } = {};
    if (typeof body.name === 'string') data.name = body.name.trim();
    if (typeof body.isPinned === 'boolean') data.isPinned = body.isPinned;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const prisma = getPrisma();
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const isAdmin = session.user.plan === 'admin';
    if (!canMutate(asset, session.user.id, isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.asset.update({ where: { id }, data });
    return NextResponse.json({ asset: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Asset PATCH error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
