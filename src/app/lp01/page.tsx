import { LpHeader } from '@/components/lp/LpHeader';
import { LpHero } from '@/components/lp/LpHero';
import { LpTryInLp } from '@/components/lp/LpTryInLp';
import { NumericProofSection } from '@/components/lp/NumericProofSection';
import { LpDemoVideo } from '@/components/lp/LpDemoVideo';
import { ProblemSection } from '@/components/lp/ProblemSection';
import { SolutionSection } from '@/components/lp/SolutionSection';
import { FeaturesSection } from '@/components/lp/FeaturesSection';
import { LpInlineCta } from '@/components/lp/LpInlineCta';
import { ComparisonSection } from '@/components/lp/ComparisonSection';
import { CustomerVoiceSection } from '@/components/lp/CustomerVoiceSection';
import { FaqSection } from '@/components/lp/FaqSection';
import { FinalCta } from '@/components/lp/FinalCta';
import { LpFooter } from '@/components/lp/LpFooter';
import { LpFloatingCta } from '@/components/lp/LpFloatingCta';
import { LpExitIntentModal } from '@/components/lp/LpExitIntentModal';
import { LpAbTracker } from '@/components/lp/LpAbTracker';

/**
 * Phase A.16: /lp01 = In-LP Try 体験型 LP（CVR 2-3x 狙い）
 *
 * 主な改修:
 * - Hero に Preset 選択 → 疑似ローディング 2s → マスク付きプレビュー
 * - FV ヘッドラインを便益+時間軸に転換
 * - 価格セクション撤去（検討疲れ回避・無料導線に集中）
 * - ヘッダー CTA は外し、Floating Footer CTA + Exit Intent に集約
 */
export default function Lp01Page() {
  const hasDemoVideo = Boolean(process.env.NEXT_PUBLIC_DEMO_VIDEO_URL);
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LpAbTracker variant="a" />
      <LpHeader compact />
      <main className="flex-1 pb-24 sm:pb-20">
        <LpHero
          h1="EC バナーが 90 秒で 17 サイズ。明日の広告に、まだ間に合う。"
          h2="デザイナー不要。業種を選ぶだけで、勝ちパターンを学習した AI が広告で実証されたバナーを 17 サイズに自動展開します。"
          ctaPrimaryLabel="いますぐ無料で試してみる"
          ctaSecondaryLabel={hasDemoVideo ? '動画で 30 秒デモを見る' : '機能をすべて見る'}
          ctaPrimaryHref="/signin?from=lp01_hero"
          ctaSecondaryHref={hasDemoVideo ? '#demo' : '#features'}
          visualSlot={<LpTryInLp />}
        />
        <NumericProofSection />
        <div id="demo">
          <LpDemoVideo />
        </div>
        <ProblemSection />
        <SolutionSection />
        <FeaturesSection />
        <LpInlineCta href="/signin?from=lp01_inline" />
        <ComparisonSection />
        <CustomerVoiceSection />
        <FaqSection />
        <FinalCta
          primaryHref="/signin?from=lp01_final"
          showSecondary={false}
        />
      </main>
      <LpFooter />
      <LpFloatingCta href="/signin?from=lp01_floating" />
      <LpExitIntentModal href="/signin?from=lp01_exit" />
    </div>
  );
}
