/**
 * Phase A.10 一発スクリプト: 既存 Asset (userId=null) を admin user に紐付ける。
 *
 * 実行タイミング:
 * 1. NextAuth デプロイ完了後
 * 2. admin が Google SSO で初回ログイン → User row 自動作成
 * 3. このスクリプト実行 → 既存 Asset 全件が admin に移行
 *
 * 実行方法:
 *   DATABASE_URL=<対象DBのURL> npx tsx scripts/migrate-assets-to-admin.ts
 *
 * 本番DBに実行する場合は DATABASE_URL を本番に向けて実行。
 * 二重実行は安全（userId IS NULL の条件なので、既に紐付け済みは対象外）。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
