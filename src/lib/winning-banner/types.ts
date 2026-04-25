/**
 * 既存 IroncladPattern に対応する内部分類キー。
 * Vision 解析時に Gemini が pattern としてどれかを返す。
 */
export const WINNING_PATTERN_KEYS = [
  'benefit',
  'fear',
  'authority',
  'story',
  'sensory',
  'comparison',
  'curiosity',
  'aspirational',
] as const;
export type WinningPatternKey = (typeof WINNING_PATTERN_KEYS)[number];

/**
 * プロンプト注入用の抽象解析結果。
 * 業種・商材を問わず転用可能な抽象表現のみ含む。
 * 具体的な商品名・コピー文言・ロゴテキストは絶対に含めないこと。
 */
export interface AnalysisAbstract {
  /** 例: "黄+黒高コントラスト系" */
  palette: string;
  /** 例: "ベネフィット型・具体数値訴求" */
  copyAngle: string;
  /** 例: "行動促進型・短文" */
  cta: string;
  /** 例: "商品オフセンター + テキスト右寄せ" */
  layout: string;
  /** 例: "ゴシック太字・パワー系" */
  typo: string;
  /** 例: "明るい・健康的・爽快" */
  mood: string;
  /** 既存 IRONCLAD_PATTERNS と対応する分類キー */
  pattern: WinningPatternKey;
  /** UI表示用、3個まで。例: ["ベネフィット型", "黄黒系", "ゴシック太字"] */
  abstractTags: string[];
}

/**
 * 分析・デバッグ用の生抽出データ。
 * **外部 LLM API 呼び出しのプロンプトには絶対に含めないこと。**
 * Phase 1 は DB 保存のみ・UI 非表示。
 */
export interface AnalysisConcrete {
  /** 例: ["#FFD700", "#000000"] */
  paletteHex: string[];
  /** 例: ["2kg減", "16日間集中"] */
  extractedTexts: string[];
  /** 例: ["商品パッケージ", "認証バッジ", "人物モデル"] */
  detectedElements: string[];
  /** Gemini の生観察テキスト */
  rawObservations: string;
}

/**
 * Vision 解析の出力全体。analyze() の戻り値。
 */
export interface AnalysisResult {
  abstract: AnalysisAbstract;
  concrete: AnalysisConcrete;
  /** 解析プロンプトのバージョン。プロンプト変更時にインクリメント。 */
  version: number;
}

/** 現在の解析プロンプトバージョン。プロンプト改善時にインクリメント。 */
export const CURRENT_ANALYSIS_VERSION = 1;

/**
 * API レスポンスや UI で使う WinningBanner DTO。
 * Asset レコードのうち type='winning_banner' のものを表す。
 */
export interface WinningBannerDTO {
  id: string;
  name: string;
  blobUrl: string;
  mimeType: string | null;
  analysisAbstract: AnalysisAbstract | null;
  analysisVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 既存パターンとの対応表（UIタグ表示用、必要に応じて拡張） */
export const PATTERN_KEY_TO_LABEL: Record<WinningPatternKey, string> = {
  benefit: 'ベネフィット型',
  fear: '恐怖訴求',
  authority: '権威訴求',
  story: 'ストーリー型',
  sensory: '感覚訴求',
  comparison: '比較型',
  curiosity: '好奇心型',
  aspirational: '憧れ訴求',
};
