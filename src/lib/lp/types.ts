/**
 * LP Maker Pro 2.0 — 型定義
 *
 * Brief: ユーザー入力（商品情報 + ターゲット + オファー）
 * LpSection: セクション組合せ型 LP の 1 ブロック
 * LpGenerationResult: AI 生成結果（コピー + 画像 URL）
 */

/** LP セクションの種別 */
export const LP_SECTION_TYPES = [
  'hero',           // FV
  'problem',        // 課題提起
  'solution',       // 解決策
  'features',       // 機能紹介
  'numeric_proof',  // 数字訴求
  'comparison',     // 比較表
  'voice',          // お客様の声
  'pricing',        // 料金
  'faq',            // FAQ
  'inline_cta',     // セクション間 CTA
  'final_cta',      // 最終 CTA
] as const;

export type LpSectionType = typeof LP_SECTION_TYPES[number];

/** LP の Brief（ユーザー入力） */
export interface LpBrief {
  /** 商品名 / サービス名 */
  productName: string;
  /** 既存 LP URL（任意。自動分析の入力源） */
  lpUrl?: string;
  /** ターゲット記述 */
  target: string;
  /** オファー（特典 / 価格 / 期間限定など） */
  offer: string;
  /** 業種抽象タグ（winning-banner 流用 / AI 補完） */
  industryTags?: string[];
  /** ユーザー添付素材 ID（Asset テーブル ID） */
  materialAssetIds?: string[];
}

/** セクションごとのプロパティ（生成結果） */
export interface LpSection {
  type: LpSectionType;
  order: number;
  enabled: boolean;
  /** セクション固有のコピー / 画像 URL / その他 */
  props: Record<string, unknown>;
}

/** LP 全体の生成結果 */
export interface LpGenerationResult {
  /** 生成された LandingPage の ID */
  landingPageId: string;
  /** タイトル（OGP / sitemap 用） */
  title: string;
  /** セクション配列 */
  sections: LpSection[];
  /** KV 画像 URL */
  kvImageUrl: string;
  /** OGP 画像 URL */
  ogImageUrl: string;
}

/** 各セクション型に対応する props の最小スキーマ */
export interface HeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  imageUrl?: string;
}

export interface ProblemProps {
  headline: string;
  items: { title: string; description: string }[];
}

export interface SolutionProps {
  headline: string;
  description: string;
  imageUrl?: string;
}

export interface FeatureItem {
  title: string;
  description: string;
  iconHint?: string;
}

export interface FeaturesProps {
  headline: string;
  items: FeatureItem[];
}

export interface NumericProofProps {
  items: { number: string; label: string; note?: string }[];
}

export interface ComparisonProps {
  headline: string;
  columns: { name: string; rows: string[] }[];
  rowLabels: string[];
}

export interface VoiceProps {
  headline: string;
  items: { quote: string; author: string; proofBadge?: string }[];
}

export interface PricingProps {
  headline: string;
  plans: { name: string; price: string; features: string[]; ctaText: string }[];
}

export interface FaqProps {
  headline: string;
  items: { question: string; answer: string }[];
}

export interface CtaProps {
  headline: string;
  buttonText: string;
  note?: string;
}
