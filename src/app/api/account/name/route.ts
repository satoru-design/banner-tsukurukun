/**
 * Phase A.11.2: PUT /api/account/name
 * Body: { name: string }
 *
 * - 空文字 → User.nameOverride = NULL（Google 名に戻す）
 * - 1〜50 文字（trim 後） → User.nameOverride = name
 * - 51 文字以上 or 空白のみ → 400
 *
 * session 必須。自分の User row のみ更新可。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const prisma = getPrisma();

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as { name?: unknown };
    const rawName = body.name;

    if (typeof rawName !== 'string') {
      return NextResponse.json({ error: 'name must be string' }, { status: 400 });
    }

    const trimmed = rawName.trim();

    // 空文字（trim 後）→ Google 名に戻す
    if (trimmed.length === 0) {
      await prisma.user.update({
        where: { id: user.userId },
        data: { nameOverride: null },
      });
      return NextResponse.json({ nameOverride: null });
    }

    // バリデーション: 50 文字以下
    if (trimmed.length > 50) {
      return NextResponse.json(
        { error: '表示名は 50 文字以下で入力してください' },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.userId },
      data: { nameOverride: trimmed },
    });

    return NextResponse.json({ nameOverride: trimmed });
  } catch (err) {
    console.error('PUT /api/account/name error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
