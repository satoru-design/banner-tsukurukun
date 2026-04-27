import type Stripe from 'stripe';
import { getStripeClient } from './stripe-client';
import { getPlanPrices, getPlanFromPriceId } from './prices';
import { getPrisma } from '@/lib/prisma'; // getPrisma() パターンを使用

interface CreateCheckoutInput {
  userId: string;
  email: string;
  basePriceId: string;
  promotionCodeId?: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Phase A.12: Stripe Checkout Session を作成し URL を返す
 *
 * - User.stripeCustomerId 未取得なら Stripe Customer を新規作成して DB に保存
 * - Pro の場合は base + metered の 2-item subscription を作る
 * - Starter は base 単独
 * - promotionCodeId 渡せば discounts に乗せる（FRIENDS 等）
 */
export const createCheckoutSession = async (input: CreateCheckoutInput): Promise<string> => {
  const stripe = getStripeClient();
  const plan = getPlanFromPriceId(input.basePriceId);
  if (!plan) {
    throw new Error(`Invalid basePriceId: ${input.basePriceId}`);
  }

  const prisma = getPrisma();

  // 1. Customer 取得 or 作成
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error('User not found');

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.email,
      metadata: { userId: input.userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: input.userId },
      data: { stripeCustomerId: customerId },
    });
  }

  // 2. line_items 構築
  const prices = getPlanPrices();
  // Stripe v22 では SessionCreateParams が type alias のため .LineItem サブ型に直接アクセス不可。
  // SessionCreateParams['line_items'] の要素型として推論させる。
  type LineItem = NonNullable<Stripe.Checkout.SessionCreateParams['line_items']>[number];
  const lineItems: LineItem[] = [
    { price: input.basePriceId, quantity: 1 },
  ];
  if (plan === 'pro' && prices.pro.meteredPriceId) {
    lineItems.push({ price: prices.pro.meteredPriceId });
    // metered は quantity 指定不可（usage_records で送る）
  }

  // 3. Checkout Session 作成
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    customer: customerId,
    line_items: lineItems,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: !input.promotionCodeId, // 自動適用なし時のみ標準入力欄を出す
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    subscription_data: {
      metadata: { userId: input.userId, plan },
    },
  };
  if (input.promotionCodeId) {
    params.discounts = [{ promotion_code: input.promotionCodeId }];
  }

  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error('Stripe did not return checkout URL');
  return session.url;
};
