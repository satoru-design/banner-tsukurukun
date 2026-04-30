import { LpHeader } from '@/components/lp/LpHeader';
import { LpFooter } from '@/components/lp/LpFooter';

/**
 * Phase A.15: 法務ページ共通レイアウト
 * /legal/tokutei, /legal/terms, /legal/privacy で利用
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LpHeader />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <article className="prose-legal">{children}</article>
        </div>
      </main>
      <LpFooter />
    </div>
  );
}
