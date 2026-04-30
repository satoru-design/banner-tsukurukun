import { LpHeader } from '@/components/lp/LpHeader';
import { LpHero } from '@/components/lp/LpHero';
import { LpBannerShowcase } from '@/components/lp/LpBannerShowcase';
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
          visualSlot={<LpBannerShowcase />}
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
