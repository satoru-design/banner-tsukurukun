import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const events = await prisma.webhookEvent.findMany({
  orderBy: { receivedAt: 'desc' },
  take: 15,
  select: { id: true, type: true, receivedAt: true, processedAt: true }
});
console.log(`Total recent: ${events.length}`);
for (const e of events) {
  console.log(`  ${e.id.substring(0, 35).padEnd(35)} | ${e.type.padEnd(40)} | proc=${e.processedAt ? 'YES' : 'NO '}`);
}
await prisma.$disconnect();
