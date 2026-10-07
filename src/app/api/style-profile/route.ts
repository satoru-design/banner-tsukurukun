import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth/current-user';
import { internalErrorResponse } from '@/lib/api/error-response';
import type {
  VisualStyle,
  Typography,
  PriceBadgeSpec,
  CtaSpec,
  LayoutSpec,
  CopyTone,
} from '@/lib/style-profile/schema';

export const runtime = 'nodejs';

interface CreateBody {
  name: string;
  productContext?: string;
  referenceImageUrls: string[];
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
}

export async function POST(req: Request) {
  // StyleProfile は全ユーザー共有テーブル（userId カラムを持たない）。
  // 所有者で絞れないぶん、少なくともログインは route 側で必須にする。
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateBody;
    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const prisma = getPrisma();
    const created = await prisma.styleProfile.create({
      data: {
        name: body.name,
        productContext: body.productContext,
        referenceImageUrls: JSON.stringify(body.referenceImageUrls),
        visualStyle: JSON.stringify(body.visualStyle),
        typography: JSON.stringify(body.typography),
        priceBadge: JSON.stringify(body.priceBadge),
        cta: JSON.stringify(body.cta),
        layout: JSON.stringify(body.layout),
        copyTone: JSON.stringify(body.copyTone),
      },
    });

    return NextResponse.json({ id: created.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    if (message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'このプロファイル名は既に使用されています' },
        { status: 409 },
      );
    }
    return internalErrorResponse('StyleProfile POST', error, 'プロファイルの保存に失敗しました');
  }
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const profiles = await prisma.styleProfile.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        productContext: true,
        referenceImageUrls: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const normalized = profiles.map((p) => ({
      ...p,
      referenceImageUrls: JSON.parse(p.referenceImageUrls) as string[],
    }));
    return NextResponse.json({ profiles: normalized });
  } catch (error: unknown) {
    return internalErrorResponse('StyleProfile GET', error, 'プロファイルの取得に失敗しました');
  }
}
