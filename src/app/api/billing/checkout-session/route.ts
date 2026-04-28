/**
 * Phase A.12 Task 10: POST /api/billing/checkout-session
 *
 * Stripe Checkout URL を生成して返す。
 * 認証は getCurrentUser() で確認（他の API route と同パターン）。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isStripeEnabled } from '@/lib/billing/stripe-client';
import { isAllowedBasePriceId } from '@/lib/billing/prices';
import { createCheckoutSession } from '@/lib/billing/checkout';

export const runtime = 'nodejs';

interface RequestBody {
  basePriceId: string;
  promo?: string; // 'FRIENDS' 等
}

export const POST = async (req: Request): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.basePriceId) {
    return NextResponse.json({ error: 'basePriceId required' }, { status: 400 });
  }
  if (!isAllowedBasePriceId(body.basePriceId)) {
    return NextResponse.json({ error: 'Invalid basePriceId' }, { status: 400 });
  }

  const promotionCodeId =
    body.promo === 'FRIENDS' ? process.env.STRIPE_PROMO_FRIENDS : undefined;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const url = await createCheckoutSession({
      userId: user.userId,
      basePriceId: body.basePriceId,
      promotionCodeId,
      successUrl: `${appUrl}/account?stripe=success`,
      cancelUrl: `${appUrl}/account?stripe=canceled`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error('[checkout-session] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
