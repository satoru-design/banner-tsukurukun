/**
 * 直近 N 日の Generation を user 別・商材別に集計する。
 *
 * 使い方:
 *   node scripts/check-recent-generations.mjs --prod            # 直近 7 日
 *   node scripts/check-recent-generations.mjs --prod --days 14
 *   node scripts/check-recent-generations.mjs --prod --user str.kk.co@gmail.com
 *   node scripts/check-recent-generations.mjs --prod --images   # 画像 blobUrl も表示
 *   node scripts/check-recent-generations.mjs --prod --external-only --images
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const args = process.argv.slice(2);
const useProd = args.includes('--prod');
const daysIdx = args.indexOf('--days');
const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 7;
const userIdx = args.indexOf('--user');
const userFilter = userIdx >= 0 ? args[userIdx + 1] : null;
const showImages = args.includes('--images');
const externalOnly = args.includes('--external-only');

const connectionString = useProd
  ? process.env.PROD_DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    `[ERROR] ${useProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} が未設定です。.env を確認してください。`,
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const main = async () => {
  const generations = await prisma.generation.findMany({
    where: {
      createdAt: { gte: since },
      ...(userFilter ? { user: { email: userFilter } } : {}),
      ...(externalOnly ? { user: { plan: { not: 'admin' } } } : {}),
    },
    select: {
      id: true,
      createdAt: true,
      briefSnapshot: true,
      user: { select: { email: true, name: true, plan: true } },
      images: {
        select: { id: true, size: true, blobUrl: true, provider: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    `\n=== 直近 ${days} 日の Generation (${useProd ? 'PROD' : 'dev'} DB)${userFilter ? ` / user=${userFilter}` : ''} ===\n`,
  );
  console.log(
    'date       | user                        | product (商材名)                     | img',
  );
  console.log(
    '-------------------------------------------------------------------------------------',
  );

  for (const g of generations) {
    const date = g.createdAt.toISOString().slice(0, 10);
    const email = (g.user?.email ?? '(unknown)').slice(0, 27);
    const product = (g.briefSnapshot?.product ?? '(unknown)').slice(0, 36);
    const imgCount = g.images.length;
    console.log(
      `${date} | ${email.padEnd(27)} | ${product.padEnd(36)} | ${String(imgCount).padStart(3)}`,
    );
    if (showImages) {
      for (const img of g.images) {
        console.log(`           └─ [${img.size}] ${img.blobUrl}`);
      }
    }
  }

  // 商材別集計
  const byProduct = new Map();
  for (const g of generations) {
    const product = g.briefSnapshot?.product ?? '(unknown)';
    const entry = byProduct.get(product) ?? { sessions: 0, images: 0 };
    entry.sessions += 1;
    entry.images += g.images.length;
    byProduct.set(product, entry);
  }

  console.log('\n=== 商材別集計 ===\n');
  console.log('product (商材名)                                 | sessions | images');
  console.log('--------------------------------------------------------------------');
  const sortedProducts = [...byProduct.entries()].sort(
    (a, b) => b[1].sessions - a[1].sessions,
  );
  for (const [product, entry] of sortedProducts) {
    const p = product.slice(0, 48);
    console.log(
      `${p.padEnd(48)} | ${String(entry.sessions).padStart(8)} | ${String(entry.images).padStart(6)}`,
    );
  }

  await prisma.$disconnect();
};

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
