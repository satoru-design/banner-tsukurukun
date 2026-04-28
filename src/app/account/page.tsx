/**
 * Phase A.11.2: マイアカウントページ（Server Component）。
 *
 * 構造:
 * - Header（共有 Client Component。SessionProvider 経由で session を読む）
 * - main 内に 3 セクション: ProfileSection / PlanSection / SecuritySection
 *
 * 認証: middleware で /account は認証必須なので、ここに到達 = ログイン済み。
 * 念のため userId === null の保険ロジックも入れる。
 *
 * Phase A.11.2 hotfix: JWT は usageCount / nameOverride 等を起動時にキャッシュするため、
 * バナー生成や名前編集後の最新値を反映できない。/account では認証情報のみ session から
 * 取得し、表示データは DB から fresh に読む（getFreshUser）。
 */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { getCurrentUser, type CurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getUsageLimit } from '@/lib/plans/limits';
import { ProfileSection } from './ProfileSection';
import { PlanSection } from './PlanSection';
import { HistorySection } from './HistorySection';
import { SecuritySection } from './SecuritySection';
import { SessionSyncer } from './SessionSyncer';
import { AccountStripeToast } from './AccountStripeToast';

/**
 * /account 専用: DB から fresh な User を読み取り CurrentUser 形式で返す。
 * JWT キャッシュをバイパスするため、生成後の usageCount / 編集後の nameOverride が
 * 即座に反映される。
 */
async function getFreshCurrentUser(userId: string): Promise<CurrentUser | null> {
  const prisma = getPrisma();
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  return {
    userId: u.id,
    email: u.email,
    plan: u.plan,
    displayName: u.nameOverride ?? u.name ?? 'ユーザー',
    nameOverride: u.nameOverride,
    image: u.image,
    planStartedAt: u.planStartedAt,
    planExpiresAt: u.planExpiresAt,
    usageCount: u.usageCount,
    usageLimit: getUsageLimit(u.plan),
    usageResetAt: u.usageResetAt,
  };
}

export default async function AccountPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser.userId) {
    redirect('/signin?callbackUrl=/account');
  }

  // DB から fresh データを取得（JWT のキャッシュをバイパス）
  const user = await getFreshCurrentUser(sessionUser.userId);
  if (!user) {
    // 認証はあるが User row が消えている異常系
    redirect('/signin?callbackUrl=/account');
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Phase A.12: Stripe success/cancel return 時のアラート表示 */}
      <Suspense fallback={null}>
        <AccountStripeToast />
      </Suspense>
      {/* Phase A.11.3: session が DB と乖離していれば update() で merge してヘッダーも追従 */}
      <SessionSyncer freshUser={user} />
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <h1 className="text-2xl font-bold">マイアカウント</h1>
        <ProfileSection user={user} />
        <PlanSection user={user} />
        <HistorySection userId={user.userId!} plan={user.plan} />
        <SecuritySection user={user} />
      </main>
    </div>
  );
}
