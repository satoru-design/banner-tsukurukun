import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { isAdmin } from '@/lib/auth/require-admin';
import { internalErrorResponse } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Banner テーブルは userId カラムを持たない（Phase A.6 以前の遺構）。
 * そのため GET は「全ユーザーの保存バナー」をそのまま返してしまう。
 * スキーマ変更なしで取れる最小の線として:
 *  - POST はログイン必須
 *  - GET は admin 必須（他人の base64 画像とコピーを読めてしまうため）
 * とする。テナント分離（userId カラム追加）は別途要判断。
 */
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
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
      },
    });

    return NextResponse.json({ success: true, banner });
  } catch (e: unknown) {
    return internalErrorResponse('save-banner POST', e, 'バナーの保存に失敗しました');
  }
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const prisma = getPrisma();
    const banners = await prisma.banner.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ banners });
  } catch (e: unknown) {
    return internalErrorResponse('save-banner GET', e, 'バナーの取得に失敗しました');
  }
}
