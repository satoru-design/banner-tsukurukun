import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { StyleProfileInput } from '@/lib/style-profile/schema';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { isAdmin } from '@/lib/auth/require-admin';
import { internalErrorResponse } from '@/lib/api/error-response';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * StyleProfile は userId カラムを持たない全ユーザー共有テーブル。
 * これまでこの route は認証も所有者判定も一切していなかったため、
 * id を知れば（/api/style-profile の一覧で全件見える）誰でも
 * 他人のプロファイルを書き換え・削除できた。
 *
 * スキーマ変更なしで取れる最小の線として:
 *  - 参照 (GET) はログイン必須
 *  - 破壊的操作 (PUT / DELETE) は admin 必須
 * とする。テナント分離（userId カラム追加）は別途要判断。
 */
export async function GET(_req: Request, ctx: Ctx) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();
    const p = await prisma.styleProfile.findUnique({ where: { id } });
    if (!p) {
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
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Partial<StyleProfileInput>;
    const prisma = getPrisma();

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
    return internalErrorResponse('StyleProfile [id] PUT', error, 'プロファイルの更新に失敗しました');
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();

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
