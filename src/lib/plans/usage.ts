/**
 * Phase A.11.0: 使用回数カウントアップ + lazy reset。
 * cron 不要：月をまたいだ最初のアクセス時に自動的にリセット & 次月の reset 日時をセット。
 *
 * 使用箇所: /api/ironclad-generate の成功パス末尾
 */
import { getPrisma } from '@/lib/prisma';

const prisma = getPrisma();

/**
 * 渡した日時の翌月 1 日 00:00:00（local TZ）を返す。
 * usageResetAt の次回値として使う。
 */
export function nextMonthStart(now: Date): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * userId の usageCount を +1 する。usageResetAt を過ぎていれば 1 にリセット。
 * usageResetAt が NULL の場合は次月開始日時をセット。
 *
 * Phase A.12: Stripe subscription 持ち（starter/pro）は payment_succeeded webhook で
 * usageCount=0 / usageResetAt=current_period_end が設定される。ここでは lazy reset せず
 * 単純に increment するのみ（webhook 遅延時の月初境界ずれを回避）。
 * 月初 lazy reset は subscription なし（free / admin）にのみ適用。
 *
 * Prisma の `{ increment: 1 }` はトランザクション保証あり、複数同時呼出でも整合。
 */
export async function incrementUsage(userId: string): Promise<void> {
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Stripe subscription 持ち → Stripe 起点（webhook 任せ）。lazy reset しない。
  if (user.stripeSubscriptionId && (user.plan === 'starter' || user.plan === 'pro')) {
    await prisma.user.update({
      where: { id: userId },
      data: { usageCount: { increment: 1 } },
    });
    return;
  }

  // subscription なし（free / admin）→ 月初 lazy reset
  if (user.usageResetAt && now >= user.usageResetAt) {
    // 期限切れ: リセットして今回分を 1 にセット
    await prisma.user.update({
      where: { id: userId },
      data: {
        usageCount: 1,
        usageResetAt: nextMonthStart(now),
      },
    });
  } else {
    // 通常: increment（usageResetAt が NULL なら同時にセット）
    await prisma.user.update({
      where: { id: userId },
      data: {
        usageCount: { increment: 1 },
        ...(user.usageResetAt ? {} : { usageResetAt: nextMonthStart(now) }),
      },
    });
  }
}
