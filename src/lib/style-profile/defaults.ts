import type {
  VisualStyle,
  Typography,
  PriceBadgeSpec,
  CtaSpec,
  LayoutSpec,
  CopyTone,
} from './schema';

export const DEFAULT_VISUAL_STYLE: VisualStyle = {
  colorPalette: {
    primary: '#1A5F3F',
    accents: ['#E67E22', '#F4C430'],
    background: '#F8F7F2',
  },
  lighting: 'natural',
  mood: 'clean and approachable',
  composition: 'left-text, right-product',
  imagePromptKeywords:
    'high-quality Japanese advertising, clean composition, natural lighting',
};

export const DEFAULT_TYPOGRAPHY: Typography = {
  mainCopyStyle: {
    family: 'gothic',
    orientation: 'horizontal',
    weight: 'black',
    emphasisRatio: '2x',
    color: '#1B1B1B',
  },
  subCopyStyle: {
    family: 'gothic',
    size: 'medium',
    color: '#2B2B2B',
  },
  microCopyExamples: [],
};

export const DEFAULT_PRICE_BADGE: PriceBadgeSpec = {
  primary: {
    shape: 'circle-red',
    color: '#E63946',
    textPattern: '初回限定 ¥{NUMBER}',
    position: 'bottom-left',
  },
};

export const DEFAULT_CTA: CtaSpec = {
  templateId: 'cta-orange-arrow',
  textPattern: '今すぐ{ACTION}',
  position: 'bottom-center',
};

export const DEFAULT_LAYOUT: LayoutSpec = {
  personZone: 'right',
  productZone: 'right',
  mainCopyZone: 'left',
  brandLogoPosition: 'top-left',
  decorations: [],
};

export const DEFAULT_COPY_TONE: CopyTone = {
  formalityLevel: 'neutral',
  vocabulary: [],
  taboos: ['激安', '絶対', '必ず'],
  targetDemographic: '一般消費者',
};

export function fillDefaults(partial: Partial<{
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
}>): {
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
} {
  return {
    visualStyle: partial.visualStyle ?? DEFAULT_VISUAL_STYLE,
    typography: partial.typography ?? DEFAULT_TYPOGRAPHY,
    priceBadge: partial.priceBadge ?? DEFAULT_PRICE_BADGE,
    cta: partial.cta ?? DEFAULT_CTA,
    layout: partial.layout ?? DEFAULT_LAYOUT,
    copyTone: partial.copyTone ?? DEFAULT_COPY_TONE,
  };
}
