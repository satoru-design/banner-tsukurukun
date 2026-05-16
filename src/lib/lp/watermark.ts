/**
 * D12 Task 18: 公開 LP の透かし表示判定。
 *
 * Free plan のユーザーが公開した LP には「Powered by LP Maker Pro」透かしを
 * 焼き込む（SSR で強制挿入、クライアントから消せない）。
 * Starter 以上のプランでは控えめな footer のみ。
 */
import type { LandingPage } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

/**
 * 公開 LP の透かし表示判定。Free plan = 透かし、それ以外 = なし。
 */
export async function shouldShowWatermark(lp: LandingPage): Promise<boolean> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: lp.userId },
    select: { plan: true },
  });
  const plan = user?.plan ?? 'free';
  return plan === 'free';
}
