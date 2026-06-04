/**
 * POST /api/billing/payjp/card（カード変更 / 移管 P4）
 *
 * Stripe Customer Portal のカード変更代替。payjp.js で token 化したカードを受け取り、
 * customers.update(customerId, { card: token }) で既定カードを差し替える。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isPayjpEnabled, getPayjpClient } from '@/lib/billing/payjp-client';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface RequestBody {
  token?: string;
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

  try {
    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser?.payjpCustomerId) {
      return NextResponse.json(
        { error: 'No Pay.jp customer. Please subscribe first.' },
        { status: 400 }
      );
    }

    const payjp = getPayjpClient();
    await payjp.customers.update(dbUser.payjpCustomerId, { card: body.token });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[payjp/card] error:', e);
    const message =
      e instanceof Error && /card|決済|declined/i.test(e.message)
        ? 'カードが承認されませんでした。別のカードをお試しください。'
        : 'カード更新に失敗しました。時間をおいて再度お試しください。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
