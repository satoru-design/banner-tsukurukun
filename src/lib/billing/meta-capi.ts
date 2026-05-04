import { createHash } from 'node:crypto';

/**
 * Phase A.15: Meta Conversion API（CAPI）server-side イベント送信
 *
 * Stripe Checkout 完了時の Purchase イベントを Meta に直接送る。
 * Pixel（クライアントサイド）と event_id でデデュプ可能だが、
 * Stripe → Meta の経路が server-to-server なので Pixel が
 * 落ちても確実にコンバージョンが記録される。
 *
 * 必要 env:
 *   - META_PIXEL_ID
 *   - META_CAPI_ACCESS_TOKEN
 *
 * 失敗時はログのみ（ユーザー体験を優先）。
 */

const GRAPH_API_VERSION = 'v18.0';

const sha256 = (s: string): string =>
  createHash('sha256').update(s.trim().toLowerCase()).digest('hex');

interface PurchaseEventInput {
  email: string;
  externalId?: string;
  value: number;
  currency: string;
  eventId: string; // dedup key（Stripe session.id を使う想定）
  eventSourceUrl?: string;
}

export const sendMetaPurchaseEvent = async (input: PurchaseEventInput): Promise<void> => {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.warn('[meta-capi] META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set, skipping');
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${accessToken}`;
  const body = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl ?? 'https://autobanner.jp/account',
        user_data: {
          em: [sha256(input.email)],
          ...(input.externalId ? { external_id: [sha256(input.externalId)] } : {}),
        },
        custom_data: {
          currency: input.currency,
          value: input.value,
        },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[meta-capi] Purchase event failed:', res.status, text);
      return;
    }
    const json = (await res.json()) as { events_received?: number; fbtrace_id?: string };
    console.log('[meta-capi] Purchase sent:', json);
  } catch (e) {
    console.error('[meta-capi] Purchase fetch error:', e);
  }
};

/**
 * Phase A.16: CompleteRegistration（Free 登録完了）の CAPI 送信
 *
 * NextAuth events.signIn の isNewUser=true 時に server-side で 1 回だけ発火。
 * Pixel 側の発火は Google SSO リダイレクトの SPA 状態遷移で不安定なので
 * CAPI 単独で堅牢に記録する。
 *
 * 用途:
 *   - ファネル分析（Lead → CompleteRegistration → Purchase の離脱率可視化）
 *   - 将来 Phase 2 で広告最適化対象に切替えるための信号蓄積
 */
interface CompleteRegistrationEventInput {
  email: string;
  externalId?: string; // user.id 推奨
  eventId: string; // dedup key（cr_${userId}_${timestamp} 推奨）
  eventSourceUrl?: string;
}

export const sendMetaCompleteRegistrationEvent = async (
  input: CompleteRegistrationEventInput,
): Promise<void> => {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.warn(
      '[meta-capi] META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set, skipping CompleteRegistration',
    );
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${accessToken}`;
  const body = {
    data: [
      {
        event_name: 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl ?? 'https://autobanner.jp/ironclad',
        user_data: {
          em: [sha256(input.email)],
          ...(input.externalId ? { external_id: [sha256(input.externalId)] } : {}),
        },
        custom_data: {
          status: 'completed',
        },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[meta-capi] CompleteRegistration event failed:', res.status, text);
      return;
    }
    const json = (await res.json()) as { events_received?: number; fbtrace_id?: string };
    console.log('[meta-capi] CompleteRegistration sent:', json);
  } catch (e) {
    console.error('[meta-capi] CompleteRegistration fetch error:', e);
  }
};
