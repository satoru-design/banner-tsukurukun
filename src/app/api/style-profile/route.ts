import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ownedWhere } from '@/lib/auth/ownership';
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
  const user = await getCurrentUser();
  if (!user.userId) {
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
        // 所有者はセッションから強制セットする。body からは受け取らない。
        userId: user.userId,
      },
    });

    return NextResponse.json({ id: created.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    if (message.includes('Unique constraint')) {
      // 一意性は (userId, name) の複合。衝突するのは自分の既存プロファイルだけ。
      return NextResponse.json(
        { error: 'このプロファイル名は既に使用されています' },
        { status: 409 },
      );
    }
    return internalErrorResponse('StyleProfile POST', error, 'プロファイルの保存に失敗しました');
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    // 自分のプロファイルのみ (admin は移行前の遺構 userId=NULL も合流)。
    // 以前は全ユーザーのプロファイルを返していた。
    const profiles = await prisma.styleProfile.findMany({
      where: ownedWhere(user.userId, user.plan === 'admin'),
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
