import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { StyleProfileInput } from '@/lib/style-profile/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessOwned } from '@/lib/auth/ownership';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * StyleProfile 単体の参照・更新・削除。
 *
 * 以前はこの route に認証も所有者判定も無く、id を知れば
 * (一覧 API が全件返していたので誰でも知れた) 他人のプロファイルを
 * 書き換え・削除できた。
 *
 * 規則:
 *  - GET / PUT / DELETE: 自分の行のみ。admin は移行前の遺構 (userId=NULL) も可。
 *
 * 他人の行は 403 ではなく 404 を返す。403 だと「その id は存在する」
 * という情報を渡してしまうため。
 */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();
    const p = await prisma.styleProfile.findUnique({ where: { id } });
    if (!p || !canAccessOwned(p, user.userId, user.plan === 'admin')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: p.id,
      name: p.name,
      productContext: p.productContext,
      referenceImageUrls: JSON.parse(p.referenceImageUrls),
      visualStyle: JSON.parse(p.visualStyle),
      typography: JSON.parse(p.typography),
      priceBadge: JSON.parse(p.priceBadge),
      cta: JSON.parse(p.cta),
      layout: JSON.parse(p.layout),
      copyTone: JSON.parse(p.copyTone),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  } catch (error: unknown) {
    return internalErrorResponse('StyleProfile [id] GET', error, 'プロファイルの取得に失敗しました');
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();

    const existing = await prisma.styleProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!canAccessOwned(existing, user.userId, user.plan === 'admin')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = (await req.json()) as Partial<StyleProfileInput>;

    const data: Record<string, string | undefined> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.productContext !== undefined) data.productContext = body.productContext;
    if (body.referenceImageUrls !== undefined)
      data.referenceImageUrls = JSON.stringify(body.referenceImageUrls);
    if (body.visualStyle !== undefined) data.visualStyle = JSON.stringify(body.visualStyle);
    if (body.typography !== undefined) data.typography = JSON.stringify(body.typography);
    if (body.priceBadge !== undefined) data.priceBadge = JSON.stringify(body.priceBadge);
    if (body.cta !== undefined) data.cta = JSON.stringify(body.cta);
    if (body.layout !== undefined) data.layout = JSON.stringify(body.layout);
    if (body.copyTone !== undefined) data.copyTone = JSON.stringify(body.copyTone);

    const updated = await prisma.styleProfile.update({ where: { id }, data });
    return NextResponse.json({ id: updated.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'このプロファイル名は既に使用されています' },
        { status: 409 },
      );
    }
    return internalErrorResponse('StyleProfile [id] PUT', error, 'プロファイルの更新に失敗しました');
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();

    const existing = await prisma.styleProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!canAccessOwned(existing, user.userId, user.plan === 'admin')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const bannerCount = await prisma.banner.count({ where: { styleProfileId: id } });
    if (bannerCount > 0) {
      return NextResponse.json(
        { error: `このプロファイルで生成された ${bannerCount} 件のバナーが存在します` },
        { status: 409 },
      );
    }

    await prisma.styleProfile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return internalErrorResponse('StyleProfile [id] DELETE', error, 'プロファイルの削除に失敗しました');
  }
}
