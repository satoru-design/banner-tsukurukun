/**
 * Phase A.10 一発スクリプト: 既存 Asset (userId=null) を admin user に紐付ける。
 *
 * 実行方法:
 *   ローカル .env のとおりに:
 *   export $(grep -E '^(DATABASE_URL|ADMIN_EMAILS)=' .env | xargs)
 *   npx tsx scripts/migrate-assets-to-admin.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmailsRaw = process.env.ADMIN_EMAILS ?? '';
  const adminEmail = adminEmailsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0];

  if (!adminEmail) {
    throw new Error(
      'ADMIN_EMAILS env not set. Required for identifying the admin user.',
    );
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    throw new Error(
      `Admin user not found for email "${adminEmail}". ` +
        `Please login first at /signin so the User row is created.`,
    );
  }

  console.log(`Admin user: ${admin.email} (id=${admin.id}, plan=${admin.plan})`);

  const targetCount = await prisma.asset.count({ where: { userId: null } });
  console.log(`Found ${targetCount} assets with userId=null`);

  if (targetCount === 0) {
    console.log('Nothing to migrate. Exiting.');
    return;
  }

  const result = await prisma.asset.updateMany({
    where: { userId: null },
    data: { userId: admin.id },
  });

  console.log(`Migrated ${result.count} assets to admin (${admin.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
