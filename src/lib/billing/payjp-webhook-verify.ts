import { timingSafeEqual } from 'node:crypto';
import { getPayjpClient } from './payjp-client';
import type { PayjpEvent } from './payjp-types';

/**
 * Pay.jp Webhook 検証（移管 P3）
 *
 * Pay.jp には Stripe のような HMAC 署名が無く、`X-Payjp-Webhook-Token` ヘッダーの
 * 静的トークンのみが正当性の手がかり。これだけでは漏洩時に偽装され得るため、
 * 多層防御として「body の event.id を使って Pay.jp API から本物を再取得」し、
 * 以降の処理は API から取得した authoritative なオブジェクトのみを使う。
 *
 * 1. X-Payjp-Webhook-Token を PAYJP_WEBHOOK_SECRET と定時間比較
 * 2. body から event.id を取り出し events.retrieve(id) で本物を取得
 *    → 偽 body を送られても API 側の実データで上書き検証できる
 */

const safeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
};

export interface VerifiedPayjpEvent {
  id: string;
  type: string;
  data: PayjpEvent['data'];
  raw: PayjpEvent;
}

export const verifyAndFetchPayjpEvent = async (
  req: Request
): Promise<VerifiedPayjpEvent> => {
  const token = req.headers.get('x-payjp-webhook-token');
  const secret = process.env.PAYJP_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('PAYJP_WEBHOOK_SECRET not set');
  }
  if (!token || !safeEqual(token, secret)) {
    throw new Error('Invalid webhook token');
  }

  const rawBody = await req.text();
  let parsed: { id?: string };
  try {
    parsed = JSON.parse(rawBody) as { id?: string };
  } catch {
    throw new Error('Invalid JSON body');
  }
  if (!parsed.id) {
    throw new Error('Missing event id');
  }

  // 多層防御: body を信用せず API から本物を取得
  const payjp = getPayjpClient();
  const event = await payjp.events.retrieve(parsed.id);

  return { id: event.id, type: event.type, data: event.data, raw: event };
};
