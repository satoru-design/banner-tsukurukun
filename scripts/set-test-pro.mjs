import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const updated = await prisma.user.update({
  where: { email: 'str.kk.co@gmail.com' },
  data: { plan: 'pro', usageCount: 85, usageResetAt: null },
});
console.log('Updated:', { plan: updated.plan, usageCount: updated.usageCount, usageResetAt: updated.usageResetAt });
await prisma.$disconnect();
