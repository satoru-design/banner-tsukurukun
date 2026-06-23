/**
 * STORES netshop poll cron (Phase 1 auto-grant).
 *
 * Schedule: every 5 minutes (see vercel.json).
 * Pulls paid orders from the last 15 minutes (overlap window — over-processing
 * is safe because grantPlan extends from max(now, current expiry)).
 */
import { NextResponse } from 'next/server';
import { fetchRecentPaidOrders } from '@/lib/billing/stores/netshop-client';
import { processOrders } from '@/lib/billing/stores/auto-grant';

export const dynamic = 'force-dynamic';

const WINDOW_MINUTES = 15;

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (process.env.PAYMENT_PROVIDER !== 'stores') {
    return NextResponse.json({ ok: true, skipped: 'provider not stores' });
  }

  const now = new Date();
  const from = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);

  let orders;
  try {
    orders = await fetchRecentPaidOrders(from, now);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[stores-netshop-poll] fetchRecentPaidOrders failed', e);
    return NextResponse.json({ ok: false, error });
  }

  const result = await processOrders(orders);
  return NextResponse.json({ ok: true, ...result });
}
