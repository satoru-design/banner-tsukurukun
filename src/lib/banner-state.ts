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

export const renderRichText = (text: string, accentColor: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(<mark>.*?<\/mark>)/);
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return React.createElement('span', {
        key: i,
        style: { color: accentColor, fontSize: '1.5em', display: 'inline-block', lineHeight: 1.2 }
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
