/**
 * Phase A.11.5: POST /api/history/[id]/regenerate
 *
 * クライアントが「同条件で再生成」を選んだ時、briefSnapshot を返す API。
 * 実際の再生成は ironclad-generate を呼ぶ（クライアント側で組み立てる）。
 *
 * このエンドポイントは「再生成に必要な materials を取得する」だけ。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({ where: { id } });
    if (!generation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const snapshot = generation.briefSnapshot as unknown as BriefSnapshot;
    return NextResponse.json({ briefSnapshot: snapshot });
  } catch (err) {
    console.error('POST /api/history/[id]/regenerate error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
