/**
 * POST /api/billing/payjp/subscribe（Stripe checkout-session の Pay.jp 版 / 移管 P2）
 *
 * フロント(payjp.js)で token 化したカードを受け取り、サーバーで customer + subscription を作成。
 * 認証は getCurrentUser()（他 API と同パターン）。plan はサーバー側で許可リスト検証。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isPayjpEnabled } from '@/lib/billing/payjp-client';
import { createPayjpSubscription } from '@/lib/billing/payjp-checkout';
import type { PlanKey } from '@/lib/billing/payjp-plans';

export const runtime = 'nodejs';

const ALLOWED_PLANS: readonly PlanKey[] = ['starter', 'pro', 'business'];

interface RequestBody {
  plan?: string;
  token?: string;
  offer?: 'trial_7d';
}

export const POST = async (req: Request): Promise<Response> => {
  if (!isPayjpEnabled()) {
    return NextResponse.json({ error: 'Pay.jp is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }
  if (!body.plan || !ALLOWED_PLANS.includes(body.plan as PlanKey)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }
  const plan = body.plan as PlanKey;

  // trial_7d は Pro のみ
  const trialDays = body.offer === 'trial_7d' && plan === 'pro' ? 7 : undefined;

  try {
    const result = await createPayjpSubscription({
      userId: user.userId,
      plan,
      tokenId: body.token,
      trialDays,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // 内部構造を漏らさない（六条: セキュリティ）。カード拒否等は汎用メッセージで返す。
    console.error('[payjp/subscribe] error:', e);
    const message =
      e instanceof Error && /card|決済|declined/i.test(e.message)
        ? 'カードが承認されませんでした。別のカードをお試しください。'
        : '決済処理に失敗しました。時間をおいて再度お試しください。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
