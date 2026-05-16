import type { LpSection } from '@/lib/lp/types';
import { HeroPreview } from './sections/HeroPreview';
import { ProblemPreview } from './sections/ProblemPreview';
import { SolutionPreview } from './sections/SolutionPreview';
import { FeaturesPreview } from './sections/FeaturesPreview';
import { NumericProofPreview } from './sections/NumericProofPreview';
import { ComparisonPreview } from './sections/ComparisonPreview';
import { VoicePreview } from './sections/VoicePreview';
import { PricingPreview } from './sections/PricingPreview';
import { FaqPreview } from './sections/FaqPreview';
import { InlineCtaPreview } from './sections/InlineCtaPreview';
import { FinalCtaPreview } from './sections/FinalCtaPreview';
import type {
  HeroProps,
  ProblemProps,
  SolutionProps,
  FeaturesProps,
  NumericProofProps,
  ComparisonProps,
  VoiceProps,
  PricingProps,
  FaqProps,
  CtaProps,
} from '@/lib/lp/types';

export function SectionRenderer({ section }: { section: LpSection }) {
  switch (section.type) {
    case 'hero':
      return <HeroPreview props={section.props as unknown as HeroProps} />;
    case 'problem':
      return <ProblemPreview props={section.props as unknown as ProblemProps} />;
    case 'solution':
      return <SolutionPreview props={section.props as unknown as SolutionProps} />;
    case 'features':
      return <FeaturesPreview props={section.props as unknown as FeaturesProps} />;
    case 'numeric_proof':
      return <NumericProofPreview props={section.props as unknown as NumericProofProps} />;
    case 'comparison':
      return <ComparisonPreview props={section.props as unknown as ComparisonProps} />;
    case 'voice':
      return <VoicePreview props={section.props as unknown as VoiceProps} />;
    case 'pricing':
      return <PricingPreview props={section.props as unknown as PricingProps} />;
    case 'faq':
      return <FaqPreview props={section.props as unknown as FaqProps} />;
    case 'inline_cta':
      return <InlineCtaPreview props={section.props as unknown as CtaProps} />;
    case 'final_cta':
      return <FinalCtaPreview props={section.props as unknown as CtaProps} />;
  }
}
