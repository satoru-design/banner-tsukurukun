/**
 * LP Maker Pro 2.0 — ダッシュボード（Server Component）。
 *
 * D2-T3: ユーザーが作成済みの LandingPage 一覧と「新規作成」CTA を表示する。
 * 認証は middleware が要求するが、保険として redirect 判定も入れる。
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { LpCard } from '@/components/lp-maker/LpCard';
import { UsageHeader } from '@/components/lp-maker/UsageHeader';
import { getLpUsageStatus } from '@/lib/lp/limits';

export const dynamic = 'force-dynamic';

export default async function LpMakerDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin?callbackUrl=/lp-maker');
  }

  const prisma = getPrisma();
  const landingPages = await prisma.landingPage.findMany({
    where: {
      userId: session.user.id,
      // I-1 fix: orphan/失敗 LP（sections 空配列）を除外
      NOT: { sections: { equals: [] } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  const usage = await getLpUsageStatus(session.user.id);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">LP Maker Pro 2.0</h1>
            <p className="text-slate-400 mt-1">
              ブリーフから LP と広告 17 サイズを同時生成
            </p>
          </div>
          <Link
            href="/lp-maker/new"
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg"
          >
            ＋ 新規 LP を作る
          </Link>
        </header>

        <UsageHeader
          plan={usage.plan}
          currentUsage={usage.currentUsage}
          softLimit={usage.softLimit}
          hardCap={usage.hardCap}
        />

        {landingPages.length === 0 ? (
          <div className="text-center py-16 bg-slate-900 rounded-lg">
            <p className="text-slate-400 mb-4">まだ LP がありません</p>
            <Link
              href="/lp-maker/new"
              className="inline-block px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded"
            >
              最初の LP を作る
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {landingPages.map((lp) => (
              <LpCard key={lp.id} lp={lp} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
