import type Stripe from 'stripe';
import { getStripeClient } from '../stripe-client';
import { getPrisma } from '@/lib/prisma';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';
import { sendMetaPurchaseEvent } from '../meta-capi';

/**
 * Phase A.12: checkout.session.completed
 *
 * - Subscription mode の Checkout 完了を契機に subscription を引き、
 *   plan-sync で DB 反映（resetUsage: true）
 *
 * Phase A.15: 完了後に Meta Conversion API へ Purchase イベント送信
 *
 * Sprint 3 CR C-4: subscription-updated から「Free → Starter 転換 Slack 通知」を移管。
 *   checkout.session.completed は「新規契約の確定」を一意に表すので、
 *   キャンセル予約・metered item 追加等の誤検知が出る subscription.updated よりも信頼性が高い。
 */
export const handleCheckoutCompleted = async (
  event: Stripe.CheckoutSessionCompletedEvent
): Promise<void> => {
  const session = event.data.object;
  if (session.mode !== 'subscription' || !session.subscription || !session.customer) return;

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    console.error('[checkout-completed] user not found for customer', customerId);
    return;
  }

  // C-4: 同期前に「現在の plan」を保持しておく（Free → Starter 転換判定用）
  const previousPlan = user.plan;

  const stripe = getStripeClient();
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subId);
  await syncUserPlanFromSubscription(user.id, subscription, { resetUsage: true });

  // C-4: 同期後の plan を再 read → Free → Starter なら Slack 通知
  const prisma = getPrisma();
  const userAfter = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, email: true },
  });
  if (previousPlan === 'free' && userAfter?.plan === 'starter') {
    const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
    if (webhook) {
      fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `💰 Free → Starter 転換! user=${userAfter.email ?? user.id}`,
        }),
      }).catch((e) => {
        console.error('[checkout-completed] slack notify failed:', e);
      });
    }
  }

  // Phase A.15: Meta Conversion API に Purchase 送信
  // event_id に session.id を使い、Pixel 側 fbq('track','Purchase',...,{eventID})
  // と合わせれば dedup される（クライアント側実装は後追い OK）。
  //
  // **Fire-and-forget**: Meta API の障害時も Stripe webhook が 500 を返さないよう
  // 同期 await ではなく Promise を投げっぱなしにする。失敗ログは meta-capi 内部で出る。
  const email = session.customer_details?.email ?? user.email;
  if (email && session.amount_total != null && session.currency) {
    void sendMetaPurchaseEvent({
      email,
      externalId: user.id,
      value: session.amount_total,
      currency: session.currency.toUpperCase(),
      eventId: session.id,
      eventSourceUrl: session.success_url ?? 'https://autobanner.jp/account',
    }).catch((e) => {
      console.error('[checkout-completed] meta-capi promise rejected:', e);
    });
  }
};
