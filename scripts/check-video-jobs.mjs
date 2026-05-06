// Phase B.1 デバッグ: prod DB の GenerationVideo 状態を確認
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prodUrl = process.env.PROD_DATABASE_URL;
if (!prodUrl) { console.error('PROD_DATABASE_URL missing'); process.exit(1); }

const adapter = new PrismaPg({ connectionString: prodUrl });
const prisma = new PrismaClient({ adapter });

const videos = await prisma.generationVideo.findMany({
  orderBy: { createdAt: 'desc' },
  take: 10,
  select: {
    id: true,
    status: true,
    provider: true,
    durationSeconds: true,
    generateAudio: true,
    vertexOperationId: true,
    blobUrl: true,
    errorMessage: true,
    providerMetadata: true,
    createdAt: true,
    startedAt: true,
    completedAt: true,
    promptJa: true,
  },
});

console.log(`Found ${videos.length} videos:\n`);
for (const v of videos) {
  const ageMin = Math.round((Date.now() - new Date(v.createdAt).getTime()) / 60000);
  console.log(`ID: ${v.id}`);
  console.log(`  status: ${v.status}, provider: ${v.provider}, ${v.durationSeconds}s, audio: ${v.generateAudio}`);
  console.log(`  age: ${ageMin}min, started: ${v.startedAt ? 'yes' : 'no'}, completed: ${v.completedAt ? 'yes' : 'no'}`);
  console.log(`  vertexOpId: ${v.vertexOperationId ? v.vertexOperationId.slice(0, 100) : 'null'}`);
  console.log(`  blobUrl: ${v.blobUrl ? 'set' : 'null'}`);
  console.log(`  error: ${v.errorMessage ?? '-'}`);
  console.log(`  metadata: ${JSON.stringify(v.providerMetadata).slice(0, 200)}`);
  console.log(`  prompt: ${(v.promptJa ?? '').slice(0, 80)}`);
  console.log('---');
}

await prisma.$disconnect();
