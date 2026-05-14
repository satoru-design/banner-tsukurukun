import { LpV2Header } from '@/components/lp-v2/LpV2Header';
import { LpV2Hero } from '@/components/lp-v2/LpV2Hero';
import { LpV2TryInLp } from '@/components/lp-v2/LpV2TryInLp';
import { LpV2NumericProof } from '@/components/lp-v2/LpV2NumericProof';
import { LpV2Problem } from '@/components/lp-v2/LpV2Problem';
import { LpV2Solution } from '@/components/lp-v2/LpV2Solution';
import { LpV2Features } from '@/components/lp-v2/LpV2Features';
import { LpV2InlineCta } from '@/components/lp-v2/LpV2InlineCta';
import { LpV2Comparison } from '@/components/lp-v2/LpV2Comparison';
import { LpV2AboutOperator } from '@/components/lp-v2/LpV2AboutOperator';
import { LpV2CustomerVoice } from '@/components/lp-v2/LpV2CustomerVoice';
import { LpV2Faq } from '@/components/lp-v2/LpV2Faq';
import { LpV2FinalCta } from '@/components/lp-v2/LpV2FinalCta';
import { LpV2Footer } from '@/components/lp-v2/LpV2Footer';
import { LpV2FloatingCta } from '@/components/lp-v2/LpV2FloatingCta';
import { LpV2ExitIntentModal } from '@/components/lp-v2/LpV2ExitIntentModal';
import { LpAbTracker } from '@/components/lp/LpAbTracker';

/**
 * Phase A.17: /lp01 = V2 ホワイトテーマ（Point Pharma 風）
 *
 * 主要変更点:
 * - 白基調・深緑アクセント・余白広め
 * - 装飾絵文字・グロー削減、Section ラベル + 大見出しの定型構造
 * - 信頼バッジ・運営背景を前面に
 * - lp02 / lp01-legacy のダーク基調は維持（共有コンポーネントには手を加えない）
 */
export default function Lp01Page() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-[var(--font-body-jp)]">
      <LpAbTracker variant="a" />
      <LpV2Header />
      <main className="flex-1 pb-24 sm:pb-20">
        <LpV2Hero
          h1={
            <>
              数時間かかっていた複数サイズのバナー制作が、
              <span className="relative inline-block whitespace-nowrap mt-2 sm:mt-3">
                <span className="relative z-10 text-emerald-900">90 秒で。</span>
                {/* 手書き風下線 SVG */}
                <svg
                  aria-hidden
                  className="absolute left-0 -bottom-1 w-full h-2 text-emerald-600/80"
                  viewBox="0 0 300 8"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 5 C 80 1, 160 7, 298 3"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>
            </>
          }
          h2={'あなたは「選ぶ」だけ。勝ちパターンを学習した AI が、画像を一括出力します。'}
          ctaPrimaryLabel="いますぐ無料で試してみる"
          ctaSecondaryLabel="デモを見る"
          ctaPrimaryHref="/signin?from=lp01_hero"
          ctaSecondaryHref="#demo"
          visualSlot={<LpV2TryInLp />}
        />
        <LpV2NumericProof />
        <LpV2Problem />
        <LpV2Solution />
        <LpV2Features />
        <LpV2InlineCta href="/signin?from=lp01_inline" />
        <LpV2Comparison />
        <LpV2AboutOperator />
        <LpV2CustomerVoice />
        <LpV2Faq />
        <LpV2FinalCta primaryHref="/signin?from=lp01_final" />
      </main>
      <LpV2Footer />
      <LpV2FloatingCta href="/signin?from=lp01_floating" />
      <LpV2ExitIntentModal href="/signin?from=lp01_exit" />
    </div>
  );
}
