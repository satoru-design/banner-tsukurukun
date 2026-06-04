import { getPrisma } from '@/lib/prisma';
import {
  syncUserPlanFromPayjpSubscription,
  downgradeToFree,
  resolveUserId,
  findUserByPayjpCustomerId,
} from './payjp-plan-sync';
import { billPayjpOverage } from './payjp-overage';
import type { PayjpEvent, PayjpSubscription, PayjpCharge } from './payjp-types';

/**
 * Pay.jp Webhook dispatcher（Stripe webhook-handlers/index.ts の Pay.jp 版 / 移管 P3）
 *
 * 対応イベント（それ以外は no-op）:
 * - subscription.created / .updated → plan 同期
 * - subscription.renewed            → plan 同期 + 月次 usage リセット + 各種アラート flag リセット
 * - subscription.canceled           → 期末解約（planExpiresAt セット、plan 維持）
 * - subscription.deleted            → free 化
 * - subscription.paused             → 課金失敗フラグ
 * - subscription.resumed            → 復帰（plan 同期、失敗フラグ解除）
 * - charge.failed（subscription 紐付き）→ 課金失敗フラグ
 * - charge.succeeded（subscription 紐付き）→ 失敗フラグ解除
 *
 * 検証は呼び出し側（route）で events.retrieve 済み。data は authoritative。
 */

const asSubscription = (data: PayjpEvent['data']): PayjpSubscription | null => {
  return data.object === 'subscription' ? (data as PayjpSubscription) : null;
};
const asCharge = (data: PayjpEvent['data']): PayjpCharge | null => {
  return data.object === 'charge' ? (data as PayjpCharge) : null;
};

const metaUserId = (
  metadata: { userId?: string } | null | undefined
): string | undefined => metadata?.userId;

export const dispatchPayjpWebhookEvent = async (event: PayjpEvent): Promise<void> => {
  switch (event.type) {
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.resumed': {
      const sub = asSubscription(event.data);
      if (!sub) return;
      const userId = await resolveUserId(metaUserId(sub.metadata), sub.customer);
      if (!userId) return;
      await syncUserPlanFromPayjpSubscription(userId, sub);
      if (event.type === 'subscription.resumed') {
        await getPrisma().user.update({
          where: { id: userId },
          data: { paymentFailedAt: null },
        });
      }
      return;
    }

    case 'subscription.renewed': {
      const sub = asSubscription(event.data);
      if (!sub) return;
      const userId = await resolveUserId(metaUserId(sub.metadata), sub.customer);
      if (!userId) return;

      // ① リセット前に「終了した周期」の超過分を都度課金（冪等）。
      //    renewed 時点の current_period_start = 直前周期の終端 = 課金対象境界。
      //    plan は billPayjpOverage 内で同期前の DB user.plan（=旧プラン）を使う。
      {
        const billedPeriodEnd = new Date(sub.current_period_start * 1000);
        try {
          await billPayjpOverage(userId, billedPeriodEnd);
        } catch (e) {
          // 課金失敗は throw して webhook 再送に委ねる（reset 前に止める）
          console.error('[payjp-webhook] overage billing failed:', e);
          throw e;
        }
      }

      // ② plan 同期 + 月次 usage リセット
      await syncUserPlanFromPayjpSubscription(userId, sub, { resetUsage: true });
      // 新サイクル開始 → 失敗/超過アラート flag・LP usage を月初リセット（Stripe payment_succeeded 相当）
      await getPrisma().user.update({
        where: { id: userId },
        data: {
          paymentFailedAt: null,
          proOverageNoticeShownAt: null,
          currentMonthLpUsageCount: 0,
          proLpOverageNoticeShownAt: null,
        },
      });
      return;
    }

    case 'subscription.canceled': {
      const sub = asSubscription(event.data);
      if (!sub) return;
      const userId = await resolveUserId(metaUserId(sub.metadata), sub.customer);
      if (!userId) return;
      // status='canceled' → syncUserPlan 内で planExpiresAt セット
      await syncUserPlanFromPayjpSubscription(userId, sub);
      return;
    }

    case 'subscription.deleted': {
      const sub = asSubscription(event.data);
      if (!sub) return;
      const userId = await resolveUserId(metaUserId(sub.metadata), sub.customer);
      if (!userId) return;
      await downgradeToFree(userId);
      return;
    }

    case 'subscription.paused': {
      const sub = asSubscription(event.data);
      if (!sub) return;
      const userId = await resolveUserId(metaUserId(sub.metadata), sub.customer);
      if (!userId) return;
      await syncUserPlanFromPayjpSubscription(userId, sub); // status='paused' → 失敗フラグ
      return;
    }

    case 'charge.failed': {
      const charge = asCharge(event.data);
      if (!charge || !charge.subscription || !charge.customer) return;
      const user = await findUserByPayjpCustomerId(charge.customer);
      if (!user) return;
      await getPrisma().user.update({
        where: { id: user.id },
        data: { paymentFailedAt: new Date() },
      });
      return;
    }

    case 'charge.succeeded': {
      const charge = asCharge(event.data);
      if (!charge || !charge.subscription || !charge.customer) return;
      const user = await findUserByPayjpCustomerId(charge.customer);
      if (!user) return;
      await getPrisma().user.update({
        where: { id: user.id },
        data: { paymentFailedAt: null },
      });
      return;
    }

    default:
      console.log(`[payjp-webhook] ignored event type: ${event.type}`);
  }
};
