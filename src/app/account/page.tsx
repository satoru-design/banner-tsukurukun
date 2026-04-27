/**
 * Phase A.11.2: マイアカウントページ（Server Component）。
 *
 * 構造:
 * - Header（共有 Client Component。SessionProvider 経由で session を読む）
 * - main 内に 3 セクション: ProfileSection / PlanSection / SecuritySection
 *
 * 認証: middleware で /account は認証必須なので、ここに到達 = ログイン済み。
 * 念のため userId === null の保険ロジックも入れる。
 */
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ProfileSection } from './ProfileSection';
import { PlanSection } from './PlanSection';
import { SecuritySection } from './SecuritySection';

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user.userId) {
    redirect('/signin?callbackUrl=/account');
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <h1 className="text-2xl font-bold">マイアカウント</h1>
        <ProfileSection user={user} />
        <PlanSection user={user} />
        <SecuritySection user={user} />
      </main>
    </div>
  );
}
