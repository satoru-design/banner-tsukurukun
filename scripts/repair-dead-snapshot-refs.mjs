/**
 * 既存 Generation.briefSnapshot に焼き込まれた死んだ参照URL (404)
 * を null に書き換える one-off 修復スクリプト。
 *
 * 流れ:
 *   1. 全 Generation の productImageUrl/badgeImageUrl1/badgeImageUrl2 を抽出
 *   2. ユニーク URL を並列 HEAD で生存確認
 *   3. 死んでいる URL を参照する snapshot を JSON にバックアップ
 *   4. 該当フィールドを null に更新
 *
 * 使い方:
 *   node scripts/repair-dead-snapshot-refs.mjs --dry-run   # 何が変わるか確認
 *   node scripts/repair-dead-snapshot-refs.mjs --apply     # 実際に書き換え
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const APPLY = process.argv.includes('--apply');
const DRY = process.argv.includes('--dry-run') || !APPLY;

const prodUrl = process.env.PROD_DATABASE_URL;
if (!prodUrl) {
  console.error('PROD_DATABASE_URL missing');
  process.exit(1);
}

const { PrismaClient } = await import('@prisma/client');
const { PrismaPg } = await import('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: prodUrl });
const prisma = new PrismaClient({ adapter });

const FIELDS = ['productImageUrl', 'badgeImageUrl1', 'badgeImageUrl2'];

// 1. 全 Generation を取得（必要フィールドのみ）
const rows = await prisma.generation.findMany({
  select: { id: true, userId: true, briefSnapshot: true, createdAt: true },
  orderBy: { createdAt: 'desc' },
});
console.log(`Total Generation rows: ${rows.length}`);

// 2. ユニーク URL 抽出
const urlSet = new Set();
for (const r of rows) {
  const snap = r.briefSnapshot ?? {};
  for (const f of FIELDS) {
    const v = snap[f];
    if (typeof v === 'string' && v.trim()) urlSet.add(v);
  }
}
const urls = [...urlSet];
console.log(`Unique reference URLs to check: ${urls.length}`);

// 3. 並列 HEAD（concurrency 8）
async function head(u) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(u, { method: 'HEAD', signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const aliveMap = new Map();
const queue = [...urls];
const workers = Array.from({ length: 8 }, async () => {
  while (queue.length > 0) {
    const u = queue.shift();
    aliveMap.set(u, await head(u));
  }
});
await Promise.all(workers);

const deadUrls = urls.filter((u) => !aliveMap.get(u));
console.log(`Dead URLs: ${deadUrls.length} / ${urls.length}`);
deadUrls.slice(0, 20).forEach((u) => console.log('  DEAD:', u.slice(-90)));
if (deadUrls.length > 20) console.log(`  ...and ${deadUrls.length - 20} more`);

if (deadUrls.length === 0) {
  console.log('Nothing to repair.');
  await prisma.$disconnect();
  process.exit(0);
}

const deadSet = new Set(deadUrls);

// 4. 影響を受ける snapshot を抽出
const affected = [];
for (const r of rows) {
  const snap = r.briefSnapshot ?? {};
  const changes = {};
  for (const f of FIELDS) {
    if (typeof snap[f] === 'string' && deadSet.has(snap[f])) {
      changes[f] = { from: snap[f], to: null };
    }
  }
  if (Object.keys(changes).length > 0) {
    affected.push({ id: r.id, userId: r.userId, createdAt: r.createdAt, changes, originalSnapshot: snap });
  }
}
console.log(`Affected Generation rows: ${affected.length}`);

// 5. バックアップ書き出し
const outDir = resolve('output');
mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = resolve(outDir, `repair-dead-refs-backup-${ts}.json`);
writeFileSync(backupPath, JSON.stringify(affected, null, 2));
console.log(`Backup written: ${backupPath}`);

// 6. 影響レコードのプレビュー
const userCounts = new Map();
for (const a of affected) {
  userCounts.set(a.userId, (userCounts.get(a.userId) ?? 0) + 1);
}
console.log('\nPer-user impact:');
for (const [uid, cnt] of [...userCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${uid}: ${cnt} rows`);
}

if (DRY) {
  console.log('\n[DRY RUN] No changes applied. Re-run with --apply to commit.');
  await prisma.$disconnect();
  process.exit(0);
}

// 7. 適用 (transaction 単位でまとめる)
console.log('\nApplying updates...');
let updated = 0;
const CHUNK = 50;
for (let i = 0; i < affected.length; i += CHUNK) {
  const slice = affected.slice(i, i + CHUNK);
  await prisma.$transaction(
    slice.map((a) => {
      const newSnap = { ...a.originalSnapshot };
      for (const f of Object.keys(a.changes)) newSnap[f] = null;
      return prisma.generation.update({
        where: { id: a.id },
        data: { briefSnapshot: newSnap },
      });
    }),
  );
  updated += slice.length;
  console.log(`  ${updated}/${affected.length}`);
}

console.log(`Done. Updated ${updated} rows.`);
await prisma.$disconnect();
