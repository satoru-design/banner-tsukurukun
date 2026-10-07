import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ownedWhere } from '@/lib/auth/ownership';
import { internalErrorResponse } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 保存バナーの作成と一覧。
 *
 * 以前は認証が無く、GET が全ユーザーの保存バナー
 * (base64 画像とコピー本文) をそのまま返していた。
 * userId を足してテナントで絞る。
 * NULL 行 (移行前の遺構) は共有の意味を持たないので admin のみ参照できる。
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const data = await req.json();
    const {
      productName,
      lpUrl,
      target,
      mainCopy,
      subCopy,
      elements,
      base64Image,
      angle,
      imageModel,
      // Phase A.5
      angleId,
      priceBadge,
      ctaTemplateId,
      ctaText,
      emphasisRatio,
      urgency,
      // Phase A.6
      styleProfileId,
    } = data;

    // styleProfileId は他人の行を指せないようにする。
    // 他人のプロファイルに自分のバナーを紐付けると、相手の DELETE が
    // 409 で止まり（参照件数を理由に拒否される）、件数も漏れる。
    if (styleProfileId) {
      const owned = await prisma.styleProfile.findFirst({
        where: { id: styleProfileId, ...ownedWhere(user.userId, user.plan === 'admin') },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json({ error: 'styleProfileId not found' }, { status: 404 });
      }
    }

    const banner = await prisma.banner.create({
      data: {
        productName,
        lpUrl,
        target,
        mainCopy,
        subCopy,
        elements: JSON.stringify(elements),
        base64Image,
        angle,
        imageModel,
        angleId,
        priceBadge: priceBadge ? JSON.stringify(priceBadge) : null,
        ctaTemplateId,
        ctaText,
        emphasisRatio,
        urgency,
        styleProfileId: styleProfileId ?? null,
        // 所有者はセッションから強制セットする。body からは受け取らない。
        userId: user.userId,
      },
    });

    return NextResponse.json({ success: true, banner });
  } catch (e: unknown) {
    return internalErrorResponse('save-banner POST', e, 'バナーの保存に失敗しました');
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    // 自分の保存バナーのみ。admin は移行前の遺構 (userId=NULL) も合流する。
    const banners = await prisma.banner.findMany({
      where: ownedWhere(user.userId, user.plan === 'admin'),
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ banners });
  } catch (e: unknown) {
    return internalErrorResponse('save-banner GET', e, 'バナーの取得に失敗しました');
  }
}
