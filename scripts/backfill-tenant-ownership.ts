/**
 * テナント分離の後片付け: userId=NULL で残った StyleProfile / Banner を
 * 指定ユーザーの所有に移す。
 *
 * 20261007041500_add_tenant_ownership で userId 列を足したが、既存行の
 * 所有者は特定できないため NULL のままになっている。NULL 行の扱いは:
 *   - StyleProfile: 全ログインユーザーが参照できる（移行前と同じ見え方）
 *   - Banner: admin のみ参照できる
 * 本当の所有者が分かっているなら、このスクリプトで寄せると
 * 「全員から見える行」を無くせる。
 *
 * scripts/migrate-assets-to-admin.ts と同じ考え方。ただし既定は dry-run。
 *
 * 実行方法:
 *   export $(grep -E '^(DATABASE_URL|ADMIN_EMAILS)=' .env | xargs)
 *
 *   # 1. まず件数だけ見る（書き込まない）
 *   npx tsx scripts/backfill-tenant-ownership.ts
 *
 *   # 2. 内容を確認したうえで実行する
 *   npx tsx scripts/backfill-tenant-ownership.ts --apply
 *
 *   # 移行先を ADMIN_EMAILS の先頭以外にしたいとき
 *   npx tsx scripts/backfill-tenant-ownership.ts --apply --email someone@example.com
 *
 *   # どちらか一方だけ
 *   npx tsx scripts/backfill-tenant-ownership.ts --apply --only style-profile
 *   npx tsx scripts/backfill-tenant-ownership.ts --apply --only banner
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

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const apply = process.argv.includes('--apply');
const only = arg('only');
if (only && only !== 'style-profile' && only !== 'banner') {
  console.error('--only must be "style-profile" or "banner"');
  process.exit(1);
}
const doStyleProfile = !only || only === 'style-profile';
const doBanner = !only || only === 'banner';

async function resolveTargetUser() {
  const explicit = arg('email');
  const email =
    explicit ??
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];

  if (!email) {
    throw new Error(
      'Target email not resolved. Pass --email <address> or set ADMIN_EMAILS.',
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `User not found for email "${email}". Have them sign in once at /signin so the User row exists.`,
    );
  }
  return user;
}

async function main() {
  const target = await resolveTargetUser();
  console.log(
    `Target user: ${target.email} (id=${target.id}, plan=${target.plan})`,
  );
  console.log(apply ? 'Mode: APPLY (will write)' : 'Mode: DRY RUN (no writes)');
  console.log('');

  if (doStyleProfile) {
    const rows = await prisma.styleProfile.findMany({
      where: { userId: null },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`StyleProfile with userId=null: ${rows.length}`);
    for (const r of rows) {
      console.log(`  - ${r.id}  ${r.name}  (${r.createdAt.toISOString()})`);
    }

    // (userId, name) が複合 UNIQUE なので、移行先ユーザーが同名の
    // プロファイルを既に持っていると衝突する。先に検出して止める。
    if (rows.length > 0) {
      const names = rows.map((r) => r.name);
      const clashes = await prisma.styleProfile.findMany({
        where: { userId: target.id, name: { in: names } },
        select: { name: true },
      });
      if (clashes.length > 0) {
        throw new Error(
          `Name clash with the target user's existing profiles: ` +
            `${clashes.map((c) => c.name).join(', ')}. ` +
            `Rename one side first, then re-run.`,
        );
      }
    }

    if (apply && rows.length > 0) {
      const res = await prisma.styleProfile.updateMany({
        where: { userId: null },
        data: { userId: target.id },
      });
      console.log(`  -> moved ${res.count} StyleProfile rows`);
    }
    console.log('');
  }

  if (doBanner) {
    const count = await prisma.banner.count({ where: { userId: null } });
    console.log(`Banner with userId=null: ${count}`);
    if (apply && count > 0) {
      const res = await prisma.banner.updateMany({
        where: { userId: null },
        data: { userId: target.id },
      });
      console.log(`  -> moved ${res.count} Banner rows`);
    }
    console.log('');
  }

  if (!apply) {
    console.log('Nothing was written. Re-run with --apply to perform the move.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  });
