#!/usr/bin/env node
/**
 * Phase A.17.0 X: CLI 版（dry-run / 手動実行用）
 *
 * 本番 Cron は src/app/api/cron/check-business-upgrade/route.ts が SSoT。
 * このスクリプトは src/lib/billing/upgrade-detection.ts と
 * ロジックが二重メンテになっている（Vercel Serverless 環境で
 * スクリプトを子プロセスとして起動できないための構造的トレードオフ）。
 *
 * Usage:
 *   node scripts/check-business-upgrade-candidates.mjs --dry-run
 *   node scripts/check-business-upgrade-candidates.mjs
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Stripe from 'stripe';

const dryRun = process.argv.includes('--dry-run');
const THRESHOLD_JPY = 10000;
const LOOKBACK_DAYS = 90;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const PRO_METERED_PRICE_ID = process.env.STRIPE_PRICE_PRO_METERED;

async function main() {
  console.log(`[check-business-upgrade] ${dryRun ? 'DRY-RUN' : 'EXECUTE'} mode`);

  if (!PRO_METERED_PRICE_ID) {
    console.error('STRIPE_PRICE_PRO_METERED env required');
    process.exit(1);
  }

  const proUsers = await prisma.user.findMany({
    where: { plan: 'pro', stripeCustomerId: { not: null } },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  console.log(`[1/3] Found ${proUsers.length} Pro users`);

  const candidates = [];
  const lookbackTs = Math.floor((Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);

  for (const u of proUsers) {
    let totalMeteredJpy = 0;
    let invoiceCount = 0;
    const invoices = stripe.invoices.list({
      customer: u.stripeCustomerId,
      created: { gte: lookbackTs },
      status: 'paid',
      limit: 12,
    });
    for await (const inv of invoices) {
      invoiceCount++;
      for (const line of inv.lines?.data ?? []) {
        if (line.price?.id === PRO_METERED_PRICE_ID) {
          totalMeteredJpy += line.amount;
        }
      }
    }
    if (invoiceCount === 0) continue;
    const avgMonthly = Math.round(totalMeteredJpy / Math.max(1, invoiceCount));
    if (avgMonthly >= THRESHOLD_JPY) {
      candidates.push({
        userId: u.id,
        email: u.email,
        avgOveragePerMonth: avgMonthly,
        invoiceCount,
        totalMeteredJpy,
      });
    }
  }
  console.log(`[2/3] Found ${candidates.length} candidates exceeding ¥${THRESHOLD_JPY}/month avg`);

  if (dryRun) {
    console.log('--- DRY-RUN candidates ---');
    for (const c of candidates) {
      console.log(`  ${c.email}: avg ¥${c.avgOveragePerMonth}/月 (over ${c.invoiceCount} invoices)`);
    }
    return;
  }

  let inserted = 0;
  let skipped = 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (const c of candidates) {
    const recent = await prisma.upgradeNotice.findFirst({
      where: {
        userId: c.userId,
        type: 'business_upgrade_recommendation',
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    if (recent) {
      skipped++;
      continue;
    }
    await prisma.upgradeNotice.create({
      data: {
        userId: c.userId,
        type: 'business_upgrade_recommendation',
        recommendedPlan: 'business',
        metricSnapshot: {
          avgOveragePerMonth: c.avgOveragePerMonth,
          invoiceCount: c.invoiceCount,
          totalMeteredJpy: c.totalMeteredJpy,
          threshold: THRESHOLD_JPY,
          generatedAt: new Date().toISOString(),
        },
      },
    });
    inserted++;
  }

  console.log(`[3/3] Inserted ${inserted} notices, skipped ${skipped} (recent)`);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
