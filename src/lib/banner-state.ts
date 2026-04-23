// src/lib/banner-state.ts
import React from 'react';

export type CanvasSize = { w: number; h: number; name: string };

export const SIZES: CanvasSize[] = [
  { name: 'Instagram (1080x1080)', w: 1080, h: 1080 },
  { name: 'FB/GDN (1200x628)', w: 1200, h: 628 },
  { name: 'Stories (1080x1920)', w: 1080, h: 1920 },
];

export type CanvasElement = {
  id: string;
  type: string;
  content: string;
  style: string;
  composeMode?: string;
  textStyle: {
    color: string;
    backgroundColor: string;
    fontSize: number;
    fontWeight: string;
    textAlign: 'left' | 'center' | 'right';
    fontFamily?: string;
    textStrokeWidth?: number;
    textStrokeColor?: string;
    textShadow?: string;
  };
  defaultPos: { x: number; y: number; w: number | string; h: number | string };
};

export const PROMPT_SAMPLES = [
  { label: 'クリーンな美容・コスメ系', text: 'A radiant healthy woman standing in soft golden morning light, glowing skin, clean white background with subtle botanical elements, lifestyle wellness photography, high resolution' },
  { label: '信頼感のあるBtoB系', text: 'A modern bright office interior with abstract glass reflection, minimalist corporate background, blue and silver color palette, depth of field, 8k resolution' },
  { label: '力強いサプリ・ダイエット系', text: 'Dynamic burst of energy and water splash, vibrant colors, dark background with glowing particle effects, dramatic lighting, highly detailed 3d render' },
];

export const readAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
};

export const renderRichText = (
  text: string,
  accentColor: string,
  emphasisRatio: EmphasisRatio = '2x'
): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(<mark>.*?<\/mark>)/);
  const scale = emphasisRatio === '3x' ? 1.5 : 1.0;
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return React.createElement('span', {
        key: i,
        style: {
          color: accentColor,
          fontSize: `${scale}em`,
          fontWeight: 900,
          display: 'inline-block',
          lineHeight: 1.2,
          margin: '0 0.05em',
        }
      }, part.replace(/<\/?mark>/g, ''));
    }
    return React.createElement('span', { key: i }, part);
  });
};

// ========== Phase A.5: Ad Quality Uplift ==========

export type AngleId =
  | 'benefit'
  | 'fear'
  | 'authority'
  | 'empathy'
  | 'numeric'
  | 'target'
  | 'scene'
  | 'sensory';

export type Urgency = 'low' | 'high';

export type EmphasisRatio = '2x' | '3x';

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

export interface PriceBadge {
  text: string;
  shape: PriceBadgeShape;
  color: string;
  position: PriceBadgePosition;
  emphasisNumber?: string;
}

export type CtaTemplateId =
  | 'cta-green-arrow'
  | 'cta-orange-arrow'
  | 'cta-red-urgent'
  | 'cta-gold-premium'
  | 'cta-navy-trust';

export interface CtaTemplate {
  id: CtaTemplateId;
  text: string;
  arrow: boolean;
}

export interface Variation {
  strategy?: {
    angle?: string;
    angle_id?: AngleId;
    angle_label?: string;
    target_insight?: string;
  };
  copy?: {
    main_copy?: string;
    sub_copy?: string;
    cta_text?: string;
    emphasis_ratio?: EmphasisRatio;
  };
  priceBadge?: PriceBadge | null;
  ctaTemplate?: CtaTemplate;
  urgency?: Urgency;
  design_specs?: {
    layout_id?: string;
    color_palette?: { accent?: string; main?: string };
    tone_and_manner?: string;
    image_gen_prompt?: string;
  } & Record<string, unknown>;
}

// アングル別のデフォルト emphasis_ratio
export const ANGLE_EMPHASIS_RATIO: Record<AngleId, EmphasisRatio> = {
  numeric: '3x',
  sensory: '3x',
  fear: '3x',
  benefit: '2x',
  authority: '2x',
  empathy: '2x',
  target: '2x',
  scene: '2x',
};

export function computeDefaultBadgePosition(
  layoutStyle: 'left' | 'right' | 'center',
  hasPerson: boolean,
  angle: AngleId
): PriceBadgePosition {
  // 人物が右側 → バッジは左下（視線の終点、写真と被らない）
  if (layoutStyle === 'left' && hasPerson) return 'bottom-left';
  // 人物が左側 → バッジは右上（Z 型の起点）
  if (layoutStyle === 'right' && hasPerson) return 'top-right';
  // 権威型はヘッダー付近
  if (angle === 'authority') return 'top-right';
  // 数字型は主役、センター配置
  if (angle === 'numeric') return 'center-right';
  return 'bottom-right';
}

/**
 * Secondary Badge の自動配置ロジック（Primary Badge と衝突しないポジションを選択）。
 * CTA は bottom-center に固定描画されるため、Secondary は top 系を優先して視認性を確保する。
 */
export function computeSecondaryBadgePosition(
  primaryPosition: PriceBadgePosition
): PriceBadgePosition {
  switch (primaryPosition) {
    case 'top-left': return 'top-right';
    case 'top-right': return 'top-left';
    case 'bottom-left': return 'top-right';
    case 'bottom-right': return 'top-left';
    case 'center-right': return 'top-left';
    case 'floating-product':
    default: return 'top-right';
  }
}

/**
 * StyleProfile が指定した Secondary Badge 位置を検証し、Primary Badge や CTA と衝突する場合は
 * 自動的に対角線上の安全な位置へ退避させる。
 */
export function resolveSecondaryBadgePosition(
  requestedPosition: PriceBadgePosition | undefined,
  primaryPosition: PriceBadgePosition
): PriceBadgePosition {
  if (!requestedPosition) {
    return computeSecondaryBadgePosition(primaryPosition);
  }
  // 完全一致 → 対角に退避
  if (requestedPosition === primaryPosition) {
    return computeSecondaryBadgePosition(primaryPosition);
  }
  // Primary/Secondary が両方 bottom 系 → CTA との3重衝突回避のため top 系へ退避
  const primaryIsBottom = primaryPosition.startsWith('bottom');
  const secondaryIsBottom = requestedPosition.startsWith('bottom');
  if (primaryIsBottom && secondaryIsBottom) {
    return computeSecondaryBadgePosition(primaryPosition);
  }
  return requestedPosition;
}

/**
 * main_copy の <mark></mark> タグを検証・修正する。
 * - 0 個 → 数字優先で自動ラップ（なければ先頭の名詞）
 * - 1 個 → そのまま
 * - 2 個以上 → 先頭のみ残し他は平文化
 */
export function validateAndFixMarkTag(mainCopy: string): string {
  const markCount = (mainCopy.match(/<mark>/g) ?? []).length;
  if (markCount === 1) return mainCopy;
  if (markCount === 0) {
    // 数字を自動検出してラップ
    const withNumberMark = mainCopy.replace(/([0-9]+[%円]?)/, '<mark>$1</mark>');
    if (withNumberMark !== mainCopy) return withNumberMark;
    // 数字がなければ先頭の漢字/カタカナ/ひらがな/英字をラップ（髙・﨑・々・〆 等も拾う）
    return mainCopy.replace(/^([ぁ-んァ-ヶ一-龥々〆〇ヵヶA-Za-z]{2,6})/, '<mark>$1</mark>');
  }
  // 2 個以上ある場合は最初だけ残す
  let count = 0;
  return mainCopy.replace(/<mark>(.+?)<\/mark>/g, (match, inner) => {
    count++;
    return count === 1 ? match : inner;
  });
}

export type ProductCategory = 'health' | 'cosme' | 'travel' | 'btob' | 'ec-general';

export function autoSelectCta(
  category: ProductCategory,
  urgency: Urgency
): CtaTemplateId {
  const map: Record<ProductCategory, Record<Urgency, CtaTemplateId>> = {
    health: { low: 'cta-green-arrow', high: 'cta-red-urgent' },
    cosme: { low: 'cta-gold-premium', high: 'cta-orange-arrow' },
    travel: { low: 'cta-orange-arrow', high: 'cta-red-urgent' },
    btob: { low: 'cta-navy-trust', high: 'cta-navy-trust' },
    'ec-general': { low: 'cta-orange-arrow', high: 'cta-red-urgent' },
  };
  return map[category][urgency];
}
