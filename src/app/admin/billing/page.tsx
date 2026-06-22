import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/auth/require-admin';
import { GrantForm } from './GrantForm';

export const metadata = {
  title: '管理者 - プラン付与 | autobanner.jp',
  robots: { index: false, follow: false },
};

export default async function AdminBillingPage() {
  if (!(await isAdmin())) notFound();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-100 mb-2">
          手動プラン付与
        </h1>
        <p className="text-sm text-slate-400 mb-8">
          STORES 請求書ダッシュボードで入金確認後、ここからプランを付与してください。
        </p>
        <GrantForm />
      </div>
    </main>
  );
}
