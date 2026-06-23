/**
 * STORES netshop auto-grant (Phase 1).
 *
 * Pipeline: netshop Orders API → isProOrder filter → user lookup by email →
 * grantPlan({plan:"pro", months:1}).
 *
 * grantPlan is idempotent-ish: it extends planExpiresAt from max(now, current),
 * so re-processing the same order in overlap windows only ever helps the user.
 */
import { getPrisma } from '@/lib/prisma';
import { grantPlan } from '@/lib/billing/stores/grant-plan';
import type { StoresNetshopOrder } from '@/lib/billing/stores/netshop-client';

export interface ProcessOrderResult {
  granted: boolean;
  reason: string;
  email?: string;
}

export interface ProcessOrdersResult {
  processed: number;
  granted: number;
  results: Array<ProcessOrderResult & { orderId: string }>;
}

/**
 * True iff the order represents a live (non-cancelled) purchase of a "Pro" item.
 *
 * - order.canceled_at must be null
 * - cancel_amount must be 0 (no partial refunds)
 * - at least one non-cancelled delivery must contain an item whose name
 *   includes "Pro" (case-insensitive).
 */
export function isProOrder(order: StoresNetshopOrder): boolean {
  if (order.canceled_at) return false;
  if (order.cancel_amount && order.cancel_amount > 0) return false;
  return order.deliveries.some(
    (d) => !d.canceled_at && d.items.some((it) => it.name.toLowerCase().includes('pro')),
  );
}

export async function processOrder(order: StoresNetshopOrder): Promise<ProcessOrderResult> {
  if (!isProOrder(order)) return { granted: false, reason: 'not a pro order' };
  if (!order.email) return { granted: false, reason: 'no email' };

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email: order.email } });
  if (!user) {
    console.warn(
      `[stores-netshop] user not found for paid order ${order.id} (${order.number}) email=${order.email}`,
    );
    return { granted: false, reason: 'user not found', email: order.email };
  }

  await grantPlan({ email: order.email, plan: 'pro', months: 1 });
  return { granted: true, reason: 'ok', email: order.email };
}

export async function processOrders(orders: StoresNetshopOrder[]): Promise<ProcessOrdersResult> {
  const results: ProcessOrdersResult['results'] = [];
  let granted = 0;

  for (const o of orders) {
    try {
      const r = await processOrder(o);
      results.push({ orderId: o.id, ...r });
      if (r.granted) granted++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[stores-netshop] failed to process order ${o.id}`, e);
      results.push({ orderId: o.id, granted: false, reason: `error: ${msg}` });
    }
  }

  return { processed: orders.length, granted, results };
}
