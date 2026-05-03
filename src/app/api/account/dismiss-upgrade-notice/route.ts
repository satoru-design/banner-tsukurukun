import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Phase A.17.0 X: BusinessUpgradeAccountBanner の「閉じる」操作
 * - User.upgradeNoticeShownAt を now() でマーク
 * - 同ユーザーの未 dismissed な UpgradeNotice 全件を dismissedAt = now()
 */
export const POST = async () => {
  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const prisma = getPrisma();
  const now = new Date();
  await prisma.user.update({
    where: { id: user.userId },
    data: { upgradeNoticeShownAt: now },
  });
  await prisma.upgradeNotice.updateMany({
    where: { userId: user.userId, dismissedAt: null },
    data: { dismissedAt: now },
  });
  return NextResponse.json({ ok: true });
};
