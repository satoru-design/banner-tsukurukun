import { NextResponse } from 'next/server';
import { isPayjpEnabled } from '@/lib/billing/payjp-client';
import { verifyAndFetchPayjpEvent } from '@/lib/billing/payjp-webhook-verify';
import { dispatchPayjpWebhookEvent } from '@/lib/billing/payjp-webhook-handlers';
import {
  isAlreadyProcessed,
  recordEventReceivedGeneric,
  markEventProcessed,
} from '@/lib/billing/idempotency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/payjp/webhook（Stripe webhook の Pay.jp 版 / 移管 P3）
 *
 * フロー:
 * 1. PAYMENT_PROVIDER=payjp ガード
 * 2. X-Payjp-Webhook-Token 検証 + events.retrieve で本物を再取得（payjp-webhook-verify）
 * 3. idempotency（処理済みなら skip）
 * 4. recordEventReceived → dispatch → markEventProcessed
 * 5. handler 例外時は 500 → Pay.jp が再送（idempotency で安全）
 */
export const POST = async (req: Request): Promise<Response> => {
  if (!isPayjpEnabled()) {
    return NextResponse.json({ error: 'Pay.jp is disabled' }, { status: 503 });
  }

  let event;
  try {
    event = await verifyAndFetchPayjpEvent(req);
  } catch (e) {
    console.error('[payjp-webhook] verification failed:', e);
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
  }

  if (await isAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  await recordEventReceivedGeneric(event.id, event.type, event.raw);

  try {
    await dispatchPayjpWebhookEvent(event.raw);
    await markEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[payjp-webhook] handler error:', e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
};
