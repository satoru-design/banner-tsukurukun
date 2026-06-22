import { getPrisma } from '@/lib/prisma';
import type { PaidPlan } from '@/lib/billing/stores/amounts';

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

export type GrantablePlan = PaidPlan | 'free';

export interface GrantPlanParams {
  email: string;
  plan: GrantablePlan;
  months: number;
}

/**
 * Admin manual grant: set plan and extend planExpiresAt by `months`
 * from max(now, current expiry).
 * Downgrade to 'free' clears planExpiresAt.
 */
export async function grantPlan({ email, plan, months }: GrantPlanParams) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`user not found: ${email}`);

  const now = new Date();

  if (plan === 'free') {
    return prisma.user.update({
      where: { id: user.id },
      data: { plan: 'free', planExpiresAt: null },
    });
  }

  const base =
    user.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;

  return prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      planStartedAt: now,
      planExpiresAt: addMonths(base, months),
    },
  });
}
