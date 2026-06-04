import type Stripe from 'stripe';
import { getPrisma } from '@/lib/prisma';

/**
 * Phase A.12: Webhook idempotency
 *
 * - Stripe は同じ event を複数回送ってくる可能性がある（リトライ）
 * - WebhookEvent テーブルの id（= Stripe event.id）で「処理済みか」を判定
 * - 未処理なら upsert で receivedAt 記録、handler 完了後に processedAt セット
 */

export const isAlreadyProcessed = async (eventId: string): Promise<boolean> => {
  const prisma = getPrisma();
  const existing = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  return existing !== null && existing.processedAt !== null;
};

export const recordEventReceived = async (event: Stripe.Event): Promise<void> => {
  const prisma = getPrisma();
  await prisma.webhookEvent.upsert({
    where: { id: event.id },
    create: {
      id: event.id,
      type: event.type,
      payload: JSON.parse(JSON.stringify(event)),
    },
    update: {}, // 既存があってもフィールドは触らない
  });
};

/**
 * Pay.jp 移管: provider 非依存の汎用記録関数。
 * Pay.jp Event は Stripe.Event 型ではないため、id/type/payload を直接受ける。
 * isAlreadyProcessed / markEventProcessed は id 文字列ベースなので共用可。
 */
export const recordEventReceivedGeneric = async (
  eventId: string,
  type: string,
  payload: unknown
): Promise<void> => {
  const prisma = getPrisma();
  await prisma.webhookEvent.upsert({
    where: { id: eventId },
    create: {
      id: eventId,
      type,
      payload: JSON.parse(JSON.stringify(payload)),
    },
    update: {},
  });
};

export const markEventProcessed = async (eventId: string): Promise<void> => {
  const prisma = getPrisma();
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date() },
  });
};
