import { getStripeClient } from './stripe-client';
import { getPrisma } from '@/lib/prisma';

const THRESHOLD_JPY = 10000;
const LOOKBACK_DAYS = 90;

export interface UpgradeCandidate {
  userId: string;
  email: string | null;
  avgOveragePerMonth: number;
  invoiceCount: number;
  totalMeteredJpy: number;
}

export interface DetectionResult {
  candidates: UpgradeCandidate[];
  inserted: number;
  skipped: number;
  dryRun: boolean;
}

/**
 * Phase A.17.0 X: Pro ユーザーの過去 3 ヶ月メータード超過を集計し、
 * 平均 ¥10,000/月 を超えるユーザーに UpgradeNotice を insert する。
 *
 * Stripe Invoice Line Items を Single Source of Truth として参照
 * （ローカル DB に集計テーブルがないため）。
 */
export async function detectBusinessUpgradeCandidates(
  opts: { dryRun?: boolean } = {}
): Promise<DetectionResult> {
  const { dryRun = false } = opts;
  const stripe = getStripeClient();
  const prisma = getPrisma();
  const proMeteredPriceId = process.env.STRIPE_PRICE_PRO_METERED;
  if (!proMeteredPriceId) throw new Error('STRIPE_PRICE_PRO_METERED required');

  const proUsers = await prisma.user.findMany({
    where: { plan: 'pro', stripeCustomerId: { not: null } },
    select: { id: true, email: true, stripeCustomerId: true },
  });

  const candidates: UpgradeCandidate[] = [];
  const lookbackTs = Math.floor((Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);

  for (const u of proUsers) {
    if (!u.stripeCustomerId) continue;
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
        if (line.price?.id === proMeteredPriceId) {
          // JPY は最小単位 = 1円
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

  if (dryRun) {
    return { candidates, inserted: 0, skipped: 0, dryRun: true };
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

  return { candidates, inserted, skipped, dryRun: false };
}
