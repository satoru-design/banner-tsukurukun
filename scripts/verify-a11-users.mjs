import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const users = await prisma.user.findMany({
  select: {
    id: true, email: true, plan: true,
    nameOverride: true, planStartedAt: true, planExpiresAt: true,
    stripeCustomerId: true, stripeSubscriptionId: true,
    usageCount: true, usageResetAt: true,
  },
});
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
