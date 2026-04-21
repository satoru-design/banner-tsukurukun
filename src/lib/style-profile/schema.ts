export type LightingType = 'high-key' | 'low-key' | 'natural' | 'dramatic' | 'studio';

export interface VisualStyle {
  colorPalette: {
    primary: string;
    accents: string[];
    background: string;
  };
  lighting: LightingType;
  mood: string;
  composition: string;
  imagePromptKeywords: string;
}

export type FontFamily =
  | 'mincho'
  | 'gothic'
  | 'brush'
  | 'modern-serif'
  | 'hand-written';

export type TextOrientation = 'horizontal' | 'vertical';

export type FontWeight = 'normal' | 'bold' | 'black';

export type EmphasisRatio = '2x' | '3x' | '4x';

export interface MainCopyStyle {
  family: FontFamily;
  orientation: TextOrientation;
  weight: FontWeight;
  emphasisRatio: EmphasisRatio;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface SubCopyStyle {
  family: 'mincho' | 'gothic' | 'modern-serif';
  size: 'small' | 'medium' | 'large';
  color: string;
}

export interface Typography {
  mainCopyStyle: MainCopyStyle;
  subCopyStyle: SubCopyStyle;
  microCopyExamples: string[];
}

export type PriceBadgeShape =
  | 'circle-red'
  | 'circle-gold'
  | 'rect-red'
  | 'ribbon-orange'
  | 'capsule-navy';

export type PriceBadgePosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center-right'
  | 'floating-product';

export type SecondaryBadgeShape = 'circle-flower' | 'ribbon' | 'circle' | 'rect';

export interface PriceBadgeSpec {
  primary: {
    shape: PriceBadgeShape;
    color: string;
    textPattern: string;
    position: PriceBadgePosition;
  };
  secondary?: {
    shape: SecondaryBadgeShape;
    color: string;
    textPattern: string;
    position: PriceBadgePosition;
  };
}

export type CtaTemplateId =
  | 'cta-green-arrow'
  | 'cta-orange-arrow'
  | 'cta-red-urgent'
  | 'cta-gold-premium'
  | 'cta-navy-trust';

export type CtaPosition = 'bottom-center' | 'bottom-left' | 'bottom-right';

export interface CtaSpec {
  templateId: CtaTemplateId;
  textPattern: string;
  position: CtaPosition;
}

export type Zone = 'left' | 'right' | 'center' | 'none' | 'bottom' | 'top';

export type BrandLogoPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'none';

export interface LayoutDecoration {
  type: 'ribbon' | 'diagonal-line' | 'frame' | 'particle';
  position: string;
  color: string;
}

export interface LayoutSpec {
  personZone: Zone;
  productZone: Zone;
  mainCopyZone: Zone;
  brandLogoPosition: BrandLogoPosition;
  decorations: LayoutDecoration[];
}

export type FormalityLevel = 'casual' | 'neutral' | 'formal';

export interface CopyTone {
  formalityLevel: FormalityLevel;
  vocabulary: string[];
  taboos: string[];
  targetDemographic: string;
}

export interface StyleProfile {
  id: string;
  name: string;
  productContext?: string;
  referenceImageUrls: string[];
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
  createdAt: Date;
  updatedAt: Date;
}

export type StyleProfileInput = Omit<StyleProfile, 'id' | 'createdAt' | 'updatedAt'>;
