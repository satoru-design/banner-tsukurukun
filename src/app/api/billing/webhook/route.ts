import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient, isStripeEnabled } from '@/lib/billing/stripe-client';
import { isAlreadyProcessed, recordEventReceived, markEventProcessed } from '@/lib/billing/idempotency';
import { dispatchWebhookEvent } from '@/lib/billing/webhook-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase A.12: Stripe Webhook 受信エンドポイント
 *
 * フロー:
 * 1. raw body 取得（req.text()）
 * 2. signature 検証（constructEvent）
 * 3. idempotency check（既に processed なら 200 で skip）
 * 4. recordEventReceived
 * 5. dispatch
 * 6. markEventProcessed
 * 7. 200 OK
 *
 * handler 内で例外 → 500 を返し Stripe に再送させる（idempotency でも安全）
 */
export const POST = async (req: Request): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error('[webhook] signature verification failed:', e);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (await isAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  await recordEventReceived(event);

  try {
    await dispatchWebhookEvent(event);
    await markEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[webhook] handler error:', e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
};
