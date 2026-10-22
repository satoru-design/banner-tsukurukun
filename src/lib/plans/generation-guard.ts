/**
 * 画像生成エンドポイント共通の「ログイン + ハードキャップ」ゲート。
 *
 * これまでハードキャップ判定は /api/ironclad-generate にしか無く、
 * かつ未ログイン時（userId が null）はチェックをまるごと素通りしていた。
 * 認可を middleware だけに委ねると、middleware を迂回された時点で
 * 従量課金の画像生成が無認証・無制限で叩けてしまう。
 *
 * そのため route 側でも必ずセッションを確認し、
 * DB の fresh な usageCount でハードキャップを突き合わせる。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHardcap } from '@/lib/plans/limits';
import { effectiveUsageCount, isUsageLimitReached } from '@/lib/plans/usage-check';

export type GenerationGuardResult =
  | { ok: true; userId: string; plan: string; usageLimit: number }
  | { ok: false; response: NextResponse };

/**
 * 生成前ゲート。未ログインは 401、上限到達は 429 を返す。
 *
 * @param scope ログ用のタグ
 */
export async function guardGeneration(scope: string): Promise<GenerationGuardResult> {
  const currentUser = await getCurrentUser();

  // fail-closed: セッションが無い（または壊れている）なら生成させない。
  if (!currentUser.userId) {
    console.warn(`[${scope}] rejected unauthenticated generation request`);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // admin（usageLimit=Infinity）は上限なし。
  if (!Number.isFinite(currentUser.usageLimit)) {
    return {
      ok: true,
      userId: currentUser.userId,
      plan: currentUser.plan,
      usageLimit: currentUser.usageLimit,
    };
  }

  const prisma = getPrisma();
  const dbUser = await prisma.user.findUnique({
    where: { id: currentUser.userId },
    select: { plan: true, usageCount: true, usageResetAt: true },
  });

  // ユーザー行が引けないなら安全側に倒す。
  if (!dbUser) {
    console.warn(`[${scope}] user row not found for ${currentUser.userId}`);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const checkInput = {
    usageCount: dbUser.usageCount,
    usageLimit: currentUser.usageLimit,
    usageResetAt: dbUser.usageResetAt,
  };
  const hardcap = getHardcap(dbUser.plan);
  const effectiveCount = effectiveUsageCount(checkInput);

  if (Number.isFinite(hardcap) && effectiveCount >= hardcap) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            dbUser.plan === 'pro'
              ? `Pro プランの月間生成上限（${hardcap} 枚）に到達しました。さらにご利用の場合は Plan C（個別商談）よりお問合せください。`
              : '今月の生成上限に到達しました',
          usageCount: effectiveCount,
          usageLimit: hardcap,
          limitReached: true,
          hardcapReached: true,
        },
        { status: 429 },
      ),
    };
  }

  if (isUsageLimitReached(checkInput) && dbUser.plan === 'starter') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: '今月の生成上限に到達しました',
          usageCount: effectiveCount,
          usageLimit: currentUser.usageLimit,
          limitReached: true,
        },
        { status: 429 },
      ),
    };
  }

  return {
    ok: true,
    userId: currentUser.userId,
    plan: dbUser.plan,
    usageLimit: currentUser.usageLimit,
  };
}
