/** タグ次元 v1 のキー */
export type TagDimension =
  | 'angleId'
  | 'ctaTemplateId'
  | 'urgency'
  | 'emphasisRatio'
  | 'priceBadge'
  | 'size'
  | 'provider';

/** 1 画像から抽出した (次元, 値) ペア */
export interface TagDim {
  dimension: TagDimension;
  value: string;
}

/** 正規化済み Insights 1 行（ad × 日） */
export interface InsightsRow {
  adId: string;
  statDate: string; // 'YYYY-MM-DD'
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number | null;
  cpa: number | null;
  cpm: number | null;
  frequency: number | null;
  roas: number | null;
  raw: unknown;
}

/** (次元, 値) ごとに窓集計した素データ */
export interface AggregatedTagStat {
  dimension: TagDimension;
  value: string;
  adCount: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

/** スコア付与後の勝ちパターン */
export interface ScoredPattern extends AggregatedTagStat {
  avgCtr: number | null;
  avgCpa: number | null;
  avgCpc: number | null;
  score: number; // 0..1（同一 dimension 内 min-max 正規化）
}
