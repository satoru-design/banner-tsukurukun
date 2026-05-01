import { LpHeader } from '@/components/lp/LpHeader';
import { LpHero } from '@/components/lp/LpHero';
import { LpBannerShowcase } from '@/components/lp/LpBannerShowcase';
import { LpDemoVideo } from '@/components/lp/LpDemoVideo';
import { ProblemSection } from '@/components/lp/ProblemSection';
import { SolutionSection } from '@/components/lp/SolutionSection';
import { FeaturesSection } from '@/components/lp/FeaturesSection';
import { ComparisonSection } from '@/components/lp/ComparisonSection';
import { CustomerVoiceSection } from '@/components/lp/CustomerVoiceSection';
import { PricingSection } from '@/components/lp/PricingSection';
import { FaqSection } from '@/components/lp/FaqSection';
import { FinalCta } from '@/components/lp/FinalCta';
import { LpFooter } from '@/components/lp/LpFooter';

/**
 * Phase A.15: /lp01 = 機能訴求 LP
 *
 * - Hero: 17 サイズ一括生成 / 勝ちバナー学習にフォーカス
 * - 共通セクションは /lp02 と同一（A/B 比較の妥当性を確保するため）
 */
export default function Lp01Page() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LpHeader />
      <main className="flex-1">
        <LpHero
          h1="1 ブリーフで、17 サイズ一括生成"
          h2="勝ちバナーを学習する AI が、EC サイトのバナー制作時間を 1/10 に。テンプレ作成・サイズ違い発注・属人ナレッジから解放されます。"
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
        <CustomerVoiceSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LpFooter />
    </div>
  );
}
