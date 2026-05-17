/**
 * LP Maker Pro 2.0 — zod スキーマ（API ルート用）
 */
import { z } from 'zod';
import { LP_SECTION_TYPES, LP_INDUSTRY_CATEGORIES, LP_CTA_TYPES, LP_TONES } from './types';

/** Brief 入力スキーマ */
export const LpBriefSchema = z.object({
  productName: z.string().min(1).max(200),
  lpUrl: z.string().url().optional(),
  target: z.string().min(1).max(2000),
  offer: z.string().min(1).max(1000),
  price: z.string().max(200).optional(),
  industryCategory: z.enum(LP_INDUSTRY_CATEGORIES).optional(),
  usp: z.string().max(1000).optional(),
  ctaType: z.enum(LP_CTA_TYPES).optional(),
  features: z.string().max(2000).optional(),
  tone: z.enum(LP_TONES).optional(),
  industryTags: z.array(z.string()).max(10).optional(),
  materialAssetIds: z.array(z.string().cuid()).max(10).optional(),
});

/** /api/lp/generate リクエストスキーマ */
export const LpGenerateRequestSchema = z.object({
  brief: LpBriefSchema,
  /** false の場合は AI 自動セクション選定。true の場合はクライアントから指定（Phase 2 用） */
  customSectionsOverride: z.array(z.enum(LP_SECTION_TYPES)).optional(),
});

export type LpGenerateRequest = z.infer<typeof LpGenerateRequestSchema>;
