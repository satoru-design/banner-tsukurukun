// Phase A.12 live mode 移行: test mode の stripeCustomerId をクリアして
// live mode で新しい Customer が作成されるようにする one-off スクリプト
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const updated = await prisma.user.update({
  where: { email: 'str.kk.co@gmail.com' },
  data: {
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    paymentFailedAt: null,
  },
});
console.log('Cleared Stripe IDs:', {
  email: updated.email,
  stripeCustomerId: updated.stripeCustomerId,
  stripeSubscriptionId: updated.stripeSubscriptionId,
});
await prisma.$disconnect();
