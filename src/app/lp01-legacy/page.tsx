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
import { LpAbTracker } from '@/components/lp/LpAbTracker';

/**
 * Phase A.16: lp01 旧版（A/B B バリアント）
 *
 * 共有コンポーネントは現行のまま流用（Voice の proofBadge 等の改善は両系列に反映）。
 * 比較する差分:
 *   - FV: 機能訴求ヘッドライン / LpBannerShowcase / 旧 CTA コピー
 *   - 配置: PricingSection あり / Floating + ExitIntent なし
 *   - ヘッダー: compact なし（無料で試すボタン表示）
 *
 * 計測: ?from=lp01b_*** のクエリで GA4 セグメント可能。
 */
export default function Lp01LegacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LpAbTracker variant="b" />
      <LpHeader />
      <main className="flex-1">
        <LpHero
          h1="1 ブリーフで、17 サイズ一括生成"
          h2="勝ちバナーを学習する AI が、EC サイトのバナー制作時間を 1/10 に。テンプレ作成・サイズ違い発注・属人ナレッジから解放されます。"
          ctaPrimaryLabel="今すぐ無料で試す（3 本まで無料）"
          ctaSecondaryLabel="料金プランを見る"
          ctaPrimaryHref="/signin?from=lp01b_hero"
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
        <FinalCta primaryHref="/signin?from=lp01b_final" />
      </main>
      <LpFooter />
    </div>
  );
}
