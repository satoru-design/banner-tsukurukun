import 'dotenv/config';
const prodUrl = process.env.PROD_DATABASE_URL;
if (!prodUrl) {
  console.error('PROD_DATABASE_URL missing');
  process.exit(1);
}
const { PrismaClient } = await import('@prisma/client');
const { PrismaPg } = await import('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: prodUrl });
const prisma = new PrismaClient({ adapter });

// 1. Search by timestamp prefix (1778558079583)
const tsRows = await prisma.asset.findMany({
  where: { blobUrl: { contains: '1778558079583' } },
  select: { id: true, type: true, name: true, blobUrl: true, userId: true, createdAt: true },
});
console.log('[Asset] matches by timestamp 1778558079583:', tsRows.length);
tsRows.forEach(r => console.log(JSON.stringify(r)));

// 2. Look in BannerGeneration.briefSnapshot for any references to this URL
const result = await prisma.$queryRawUnsafe(`
  SELECT id, "userId", "createdAt", "briefSnapshot"->>'product' AS product
  FROM "Generation"
  WHERE "briefSnapshot"::text LIKE '%1778558079583-kokoromil%'
  ORDER BY "createdAt" DESC
  LIMIT 10
`);
console.log('\n[BannerGeneration] referencing the dead badge URL:', result.length);
result.forEach(r => console.log(JSON.stringify(r)));

// 3. Recent badge uploads (today)
const todayStart = new Date(Date.now() - 24*60*60*1000);
const recent = await prisma.asset.findMany({
  where: { type: 'badge', createdAt: { gte: todayStart } },
  select: { id: true, name: true, blobUrl: true, userId: true, createdAt: true },
});
console.log('\n[Asset] badges uploaded in last 24h:', recent.length);
recent.forEach(r => console.log(JSON.stringify(r)));

// 4. Look at users whose recent generations failed
const allRecentBatches = await prisma.$queryRawUnsafe(`
  SELECT id, "userId", "createdAt",
         "briefSnapshot"->>'product' AS product,
         "briefSnapshot"->>'badgeImageUrl1' AS b1,
         "briefSnapshot"->>'badgeImageUrl2' AS b2
  FROM "Generation"
  WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  ORDER BY "createdAt" DESC
  LIMIT 20
`);
console.log('\n[BannerGeneration] last 24h (sample):', allRecentBatches.length);
allRecentBatches.forEach(r => console.log(JSON.stringify(r)));

await prisma.$disconnect();
