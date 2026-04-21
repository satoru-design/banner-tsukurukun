import type { CtaTemplateId } from './banner-state';

export interface CtaTemplateDef {
  id: CtaTemplateId;
  className: string;
  suggestedText: string[];
  arrow: boolean;
}

export const CTA_TEMPLATES: Record<CtaTemplateId, CtaTemplateDef> = {
  'cta-green-arrow': {
    id: 'cta-green-arrow',
    className:
      'px-8 py-4 rounded-full bg-gradient-to-b from-[#22C55E] to-[#15803D] text-white font-black text-lg shadow-[0_4px_12px_rgba(34,197,94,0.4)] hover:shadow-[0_6px_16px_rgba(34,197,94,0.6)] hover:scale-[1.03] transition-all',
    suggestedText: ['今すぐ購入', '無料で試す', '今すぐ予約'],
    arrow: true,
  },
  'cta-orange-arrow': {
    id: 'cta-orange-arrow',
    className:
      'px-8 py-4 rounded-xl bg-gradient-to-b from-[#FF8C42] to-[#D96A1F] text-white font-black text-lg shadow-[0_4px_12px_rgba(217,106,31,0.45)] hover:scale-[1.03] transition-all',
    suggestedText: ['今すぐ購入', 'カートに入れる', '詳細を見る'],
    arrow: true,
  },
  'cta-red-urgent': {
    id: 'cta-red-urgent',
    className:
      'px-8 py-4 rounded-xl bg-gradient-to-b from-[#EF4444] to-[#B91C1C] text-white font-black text-lg shadow-[0_4px_12px_rgba(185,28,28,0.5)] hover:scale-[1.03] transition-all',
    suggestedText: ['本日限り', '残りわずか', '今すぐ申し込む'],
    arrow: true,
  },
  'cta-gold-premium': {
    id: 'cta-gold-premium',
    className:
      'px-8 py-4 rounded-lg bg-gradient-to-b from-[#D4A017] to-[#8B6914] text-white font-black text-lg shadow-md border border-[#FFD700] hover:scale-[1.02] transition-all',
    suggestedText: ['詳細を確認する', '無料体験を申し込む', '特別価格で購入'],
    arrow: false,
  },
  'cta-navy-trust': {
    id: 'cta-navy-trust',
    className:
      'px-8 py-3 rounded-md bg-[#1D3557] text-white font-bold shadow-sm hover:bg-[#2A4A7F] transition-all',
    suggestedText: ['資料請求する', '無料相談を予約', 'お問い合わせ'],
    arrow: false,
  },
};
