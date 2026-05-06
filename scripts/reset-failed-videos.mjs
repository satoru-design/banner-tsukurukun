// Phase B.1 デバッグ: failed の GenerationVideo を pending に戻して再試行可能にする
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prodUrl = process.env.PROD_DATABASE_URL;
if (!prodUrl) { console.error('PROD_DATABASE_URL missing'); process.exit(1); }

const adapter = new PrismaPg({ connectionString: prodUrl });
const prisma = new PrismaClient({ adapter });

const result = await prisma.generationVideo.updateMany({
  where: { status: 'failed' },
  data: {
    status: 'pending',
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    vertexOperationId: null,
  },
});

console.log(`Reset ${result.count} failed videos back to pending.`);

await prisma.$disconnect();
