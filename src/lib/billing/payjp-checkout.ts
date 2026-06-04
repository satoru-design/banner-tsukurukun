import { getPayjpClient } from './payjp-client';
import { getPayjpPlans, type PlanKey } from './payjp-plans';
import { getPrisma } from '@/lib/prisma';

/**
 * Pay.jp サブスク作成（Stripe createCheckoutSession の Pay.jp 版 / 移管 P2）
 *
 * Stripe はホスト型 Checkout へリダイレクトしていたが、Pay.jp はホスト型決済ページが無い。
 * フロント(payjp.js)でカードを token 化 → 本関数に token を渡し、サーバーで
 *   1. customer 作成（既存なら default_card を更新）
 *   2. subscription 作成（plan + customer、trial 任意）
 * を実行する。
 *
 * 検証済み SDK 型: customers.create({email,card}), customers.update(id,{card,default_card}),
 *   subscriptions.create({customer,plan,trial_end?})（payjp v3.1.2）
 *
 * NOTE: 超過従量課金（metered）は Pay.jp サブスクに無いため、ここでは固定 base plan のみ。
 *       超過分は P5（自前集計 + charges.create 都度課金）で別実装。
 */

interface CreateSubscriptionInput {
  userId: string;
  plan: PlanKey;
  /** payjp.js createToken() で得た token ID（tok_xxx）。サーバーに生カード番号は通さない。 */
  tokenId: string;
  /** Pro 7 日無料トライアル等。日数を渡すと trial_end = now + days。 */
  trialDays?: number;
}

interface CreateSubscriptionResult {
  subscriptionId: string;
  customerId: string;
  plan: PlanKey;
}

export const createPayjpSubscription = async (
  input: CreateSubscriptionInput
): Promise<CreateSubscriptionResult> => {
  const payjp = getPayjpClient();
  const plans = getPayjpPlans();
  const planId = plans[input.plan];
  if (!planId) throw new Error(`Invalid plan: ${input.plan}`);

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error('User not found');

  // 1. Customer 取得 or 作成（token を card として紐付け）
  let customerId = user.payjpCustomerId;
  if (!customerId) {
    const customer = await payjp.customers.create({
      email: user.email ?? undefined,
      card: input.tokenId,
      metadata: { userId: input.userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: input.userId },
      data: { payjpCustomerId: customerId },
    });
  } else {
    // 既存顧客が再購入 → カードを更新（古い token は使い回せないため毎回新 token）
    await payjp.customers.update(customerId, { card: input.tokenId });
  }

  // 2. Subscription 作成
  const trialEnd =
    input.trialDays && input.trialDays > 0
      ? Math.floor(Date.now() / 1000) + input.trialDays * 24 * 60 * 60
      : undefined;

  const subscription = await payjp.subscriptions.create({
    customer: customerId,
    plan: planId,
    ...(trialEnd ? { trial_end: trialEnd } : {}),
    metadata: { userId: input.userId, plan: input.plan },
  });

  // 3. DB 反映（plan 確定。詳細な期限同期は Webhook 側でも行う）
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      plan: input.plan,
      payjpSubscriptionId: subscription.id,
      planStartedAt: new Date(),
      planExpiresAt: null,
      paymentFailedAt: null,
    },
  });

  return { subscriptionId: subscription.id, customerId, plan: input.plan };
};
