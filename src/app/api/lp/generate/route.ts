/**
 * POST /api/lp/generate
 *
 * LP Maker Pro 2.0 — Brief を受け取り、固定セクション配列の LP を生成して DB 保存。
 *
 * - 認証必須（next-auth セッション）
 * - Gemini 2.5 Pro 構造化出力で各セクションのコピーを並列生成
 * - LandingPage + LandingPageGeneration を作成
 *
 * Task 4: 固定 DEFAULT_SECTIONS 配列。Task 5 で AI 選定に置き換え予定。
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { LpGenerateRequestSchema } from '@/lib/lp/schemas';
import { generateLandingPage } from '@/lib/lp/orchestrator';

export const runtime = 'nodejs';
// 9 セクション × Gemini 2.5 Pro 並列 30-50 秒 + DB 書き込み。
// 並列ゆえ理論上 60 秒だが、レート制限 / ネットワークぶれを考慮し 300s。
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // C-2 fix: interim admin-only gate until Sprint 3 D11 (Stripe Meter + usage gate)
  // Free=1, Starter=5, Pro=20 monthly LP limits will be enforced there.
  // Until then, restrict to admin to avoid cost runaway (~$0.10-0.13 per LP in OpenAI + Gemini).
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  if (user?.plan !== 'admin') {
    return NextResponse.json(
      {
        error: 'LP Maker is in early access. Available to admin users only until Sprint 3 release.',
        adminOnly: true,
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = LpGenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await generateLandingPage({
      userId: session.user.id,
      brief: parsed.data.brief,
    });
    return NextResponse.json({
      landingPageId: result.landingPageId,
      title: result.title,
      sections: result.sections,
    });
  } catch (err) {
    console.error('[/api/lp/generate] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
