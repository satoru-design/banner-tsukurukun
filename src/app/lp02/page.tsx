import { LpHeader } from '@/components/lp/LpHeader';
import { LpHero } from '@/components/lp/LpHero';
import { LpDemoVideo } from '@/components/lp/LpDemoVideo';
import { ProblemSection } from '@/components/lp/ProblemSection';
import { SolutionSection } from '@/components/lp/SolutionSection';
import { FeaturesSection } from '@/components/lp/FeaturesSection';
import { ComparisonSection } from '@/components/lp/ComparisonSection';
import { PricingSection } from '@/components/lp/PricingSection';
import { FaqSection } from '@/components/lp/FaqSection';
import { FinalCta } from '@/components/lp/FinalCta';
import { LpFooter } from '@/components/lp/LpFooter';

/**
 * Phase A.15: /lp02 = 時短訴求 LP
 *
 * - Hero: テンプレ作成 0 時間 / 90 秒で完成 にフォーカス
 * - 共通セクションは /lp01 と同一（A/B 比較の妥当性を確保するため）
 */
export default function Lp02Page() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LpHeader />
      <main className="flex-1">
        <LpHero
          h1="テンプレを作る時間、もう要りません"
          h2="ブリーフ → 完成まで 90 秒。1 ブリーフで 17 サイズ一括。あなたは戦略に集中できます。"
          ctaPrimaryLabel="今すぐ無料で試す（3 セッション無料）"
          ctaSecondaryLabel="料金プランを見る"
          ctaPrimaryHref="/signin"
          ctaSecondaryHref="#pricing"
          visualSlot={
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                <div className="text-xs text-slate-500 mb-1">Before（手作業）</div>
                <div className="text-3xl font-black text-slate-300">6 時間</div>
                <div className="text-xs text-slate-500 mt-1">テンプレ + コピー + サイズ違い</div>
              </div>
              <div className="text-center text-slate-500">↓</div>
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
                <div className="text-xs text-emerald-300 mb-1">After（勝ちバナー作る君）</div>
                <div className="text-3xl font-black text-emerald-300">90 秒</div>
                <div className="text-xs text-emerald-200/70 mt-1">17 サイズ一括 + 勝ちパターン学習</div>
              </div>
            </div>
          }
        />
        <LpDemoVideo />
        <ProblemSection />
        <SolutionSection />
        <FeaturesSection />
        <ComparisonSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LpFooter />
    </div>
  );
}
