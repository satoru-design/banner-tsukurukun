import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.findUnique({
  where: { email: 'str.kk.co@gmail.com' },
  select: {
    id: true,
    email: true,
    plan: true,
    stripeCustomerId: true,
    stripeSubscriptionId: true,
    planStartedAt: true,
    planExpiresAt: true,
    usageCount: true,
    usageResetAt: true,
    paymentFailedAt: true,
  },
});
console.log('User state:');
console.log(JSON.stringify(user, null, 2));

console.log('\nRecent webhook events:');
const events = await prisma.webhookEvent.findMany({
  orderBy: { receivedAt: 'desc' },
  take: 10,
  select: { id: true, type: true, processedAt: true, receivedAt: true }
});
for (const e of events) {
  console.log(`  ${e.id.substring(0, 30).padEnd(30)} | ${e.type.padEnd(40)} | proc=${e.processedAt ? 'YES' : 'NO '}`);
}
await prisma.$disconnect();
