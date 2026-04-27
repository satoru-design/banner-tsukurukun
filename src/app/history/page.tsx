/**
 * Phase A.11.5: /history ページ。
 * Server Component で Header を render、リストは Client Component (HistoryList) に委譲。
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { Header } from '@/components/layout/Header';
import { HistoryList } from './HistoryList';

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user.userId) {
    redirect('/signin?callbackUrl=/history');
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">履歴</h1>
          <Link
            href="/"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded transition"
          >
            + 新規作成
          </Link>
        </div>
        <HistoryList />
      </main>
    </div>
  );
}
