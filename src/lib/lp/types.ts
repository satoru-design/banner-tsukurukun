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

/** 業種カテゴリ（ユーザー入力 select） */
export const LP_INDUSTRY_CATEGORIES = [
  'cosmetics',
  'supplement',
  'food',
  'education',
  'saas',
  'real_estate',
  'finance',
  'health_medical',
  'apparel',
  'other',
] as const;
export type LpIndustryCategory = typeof LP_INDUSTRY_CATEGORIES[number];

export const LP_INDUSTRY_LABELS: Record<LpIndustryCategory, string> = {
  cosmetics: 'コスメ',
  supplement: 'サプリ',
  food: '食品',
  education: '教育',
  saas: 'SaaS',
  real_estate: '不動産',
  finance: '金融',
  health_medical: '健康/医療',
  apparel: 'アパレル',
  other: 'その他',
};

/** CTA タイプ */
export const LP_CTA_TYPES = [
  'buy',
  'apply',
  'free_trial',
  'request_material',
  'inquiry',
  'see_details',
] as const;
export type LpCtaType = typeof LP_CTA_TYPES[number];

export const LP_CTA_LABELS: Record<LpCtaType, string> = {
  buy: '購入する',
  apply: '申し込む',
  free_trial: '無料体験する',
  request_material: '資料請求する',
  inquiry: '問い合わせる',
  see_details: '詳細を見る',
};

/** ブランドトーン */
export const LP_TONES = [
  'trustworthy',
  'friendly',
  'luxury',
  'casual',
  'professional',
  'urgent',
] as const;
export type LpTone = typeof LP_TONES[number];

export const LP_TONE_LABELS: Record<LpTone, string> = {
  trustworthy: '信頼感',
  friendly: '親しみやすい',
  luxury: '高級感',
  casual: 'カジュアル',
  professional: 'プロフェッショナル',
  urgent: '緊急感',
};

/** LP の Brief（ユーザー入力） */
export interface LpBrief {
  /** 商品名 / サービス名 */
  productName: string;
  /** 既存 LP URL（任意。自動分析の入力源） */
  lpUrl?: string;
  /** ターゲット記述 */
  target: string;
  /** オファー特典（旧 offer の用途を限定。例: 初回 70% OFF、14日返金保証） */
  offer: string;
  /** 価格・料金感（例: 月額 980 円、買い切り 1 万円） */
  price?: string;
  /** 業種カテゴリ（ユーザー入力 select） */
  industryCategory?: LpIndustryCategory;
  /** 強み・USP */
  usp?: string;
  /** CTA タイプ */
  ctaType?: LpCtaType;
  /** 顧客の悩み・購入障壁（problem セクション + reverse FAQ 精度向上） */
  customerPain?: string;
  /** リスクリバーサル（返金保証・解約条件・トライアル） */
  riskReversal?: string;
  /** 競合・参考 LP URL（改行区切り、最大 5 本） */
  referenceLpUrls?: string;
  /** 実績数値・社会的証明（AI 捏造防止のためユーザー入力推奨） */
  proofMetrics?: string;
  /** 権威付け（受賞・メディア掲載・監修者） */
  authority?: string;
  /** @deprecated usp に統合済。Phase 1 旧データ参照のみ */
  features?: string;
  /** ブランドトーン */
  tone?: LpTone;
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
  ogImageUrl?: string;  // D9 (Task 13) で生成、Sprint 1 ではまだ
}

/** 各セクション型に対応する props の最小スキーマ */
export interface HeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  imageUrl?: string;
  /** CTA ボタンのリンク先 URL（編集画面でユーザーが入力。空なら button、URL ありなら <a>） */
  linkUrl?: string;
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
  plans: { name: string; price: string; features: string[]; ctaText: string; linkUrl?: string }[];
}

export interface FaqProps {
  headline: string;
  items: { question: string; answer: string }[];
}

export interface CtaProps {
  headline: string;
  buttonText: string;
  note?: string;
  /** CTA ボタンのリンク先 URL（編集画面でユーザーが入力。空なら button、URL ありなら <a>） */
  linkUrl?: string;
}
