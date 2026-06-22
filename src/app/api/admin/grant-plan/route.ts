import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth/require-admin';
import { grantPlan, type GrantablePlan } from '@/lib/billing/stores/grant-plan';

const VALID_PLANS: GrantablePlan[] = ['free', 'starter', 'pro', 'business'];

export async function POST(req: Request): Promise<Response> {
  // 1. 管理者チェック（セッションベース）
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. パース
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be object' }, { status: 400 });
  }

  const { email, plan, months: rawMonths } =
    body as { email?: unknown; plan?: unknown; months?: unknown };

  // 3. バリデーション
  if (typeof email !== 'string' || !email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  if (!VALID_PLANS.includes(plan as GrantablePlan)) {
    return NextResponse.json(
      { error: `plan must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 400 },
    );
  }

  const months =
    rawMonths !== undefined && rawMonths !== null
      ? Number(rawMonths)
      : 1;

  if (plan !== 'free') {
    if (!Number.isInteger(months) || months < 1) {
      return NextResponse.json(
        { error: 'months must be a positive integer' },
        { status: 400 },
      );
    }
  }

  // 4. 付与
  let updated;
  try {
    updated = await grantPlan({ email, plan: plan as GrantablePlan, months });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith('user not found:')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    email: updated.email,
    plan: updated.plan,
    planExpiresAt: updated.planExpiresAt,
  });
}
