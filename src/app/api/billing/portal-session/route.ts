import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isStripeEnabled, getStripeClient } from '@/lib/billing/stripe-client';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Phase A.12: Stripe Customer Portal Session 発行
 *
 * - 既に Stripe Customer がいる前提（user.stripeCustomerId 必須）
 * - return_url で /account に戻す
 */
export const POST = async (): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No subscription found. Please upgrade first.' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${appUrl}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('[portal-session] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
