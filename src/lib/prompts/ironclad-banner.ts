/**
 * Ironclad Banner Prompt Builder (Phase A.7)
 *
 * GAS版オーケストラ.gs で実績のある鉄板プロンプト構造を TypeScript に移植。
 * - GPT1_SYSTEM_PROMPT: ブリーフ入力材料 → 画像生成プロンプトを markdown で生成（GPT-4o 用システム指示）
 * - GPT2_PREFIX: 画像生成モデルに渡す直前の最重要ルール + 禁止事項
 * - buildFinalImagePrompt: 選択済み材料から 1 ショットで鉄板プロンプトを構築
 *   （オーケストレーターを介さずテキスト描画忠実度を最大化するパスも用意）
 *
 * Phase A.16: pattern 別の VISUAL_STYLE_HINTS を画像プロンプトに注入し、
 * 同コピー・同素材で複数 pattern のスタイル違いを描き分けられるようにした。
 */
import { VISUAL_STYLE_HINTS } from './visual-style-hints';

export type IroncladPattern =
  | '王道'
  | '綺麗め'
  | 'インパクト重視'
  | '信頼感'
  | 'ストーリー型'
  | 'ラグジュアリー';

export const IRONCLAD_PATTERNS: IroncladPattern[] = [
  '王道',
  '綺麗め',
  'インパクト重視',
  '信頼感',
  'ストーリー型',
  'ラグジュアリー',
];

export type IroncladSize =
  // SNS 標準
  | 'Instagram (1080x1080)'
  | 'FB/GDN (1200x628)'
  | 'Stories (1080x1920)'
  | 'SNS 1:1 (1200x1200)'
  | 'Instagram 4:5 (1080x1350)'
  | 'YDA 1.91:1 (600x314)'
  // Display 共通
  | 'Display 300x250'
  | 'Display 336x280'
  | 'Display 200x200'
  | 'Display 250x250'
  // Display PC
  | 'Display PC 728x90'
  | 'Display PC 160x600'
  | 'Display PC 300x600'
  | 'Display PC 468x60'
  | 'Display PC 970x90'
  // Display SP
  | 'Display SP 320x50'
  | 'Display SP 320x100'
  // Phase A.15: カスタムサイズ（最大 2000×2000）
  | `カスタム ${number}x${number}`;

export type IroncladSizeCategory = 'SNS' | 'Display共通' | 'DisplayPC' | 'DisplaySP' | 'Custom';

/** Phase A.15: カスタムサイズ最大値 */
export const CUSTOM_SIZE_MAX = 2000;

/**
 * Phase A.15: カスタムサイズの apiSize（gpt-image-2 への投入サイズ）解決。
 * gpt-image-2 制約: 16px倍数 / 総ピクセル 655,360〜8,294,400 / アスペクト比 ≤3:1
 * 任意の W×H を最も近い valid apiSize に丸める（生成後に sharp で本来サイズへリサイズも可能）。
 */
function pickApiSizeForAspect(width: number, height: number): string {
  const aspect = width / height;
  if (aspect >= 2.5) return '1536x512'; // ~3:1
  if (aspect >= 1.7) return '1536x1024'; // ~1.5:1
  if (aspect >= 1.15) return '1280x1024'; // ~1.25:1
  if (aspect >= 0.85) return '1024x1024'; // 1:1
  if (aspect >= 0.59) return '1024x1280'; // ~0.8:1 (4:5)
  if (aspect >= 0.4) return '1024x1536'; // ~0.67:1 (2:3)
  return '512x1536'; // ~0.33:1 (~1:3)
}

/**
 * Phase A.15: 「カスタム W×H」形式の文字列をパース。失敗時 null。
 */
export function parseCustomSize(s: string): { width: number; height: number } | null {
  const m = s.match(/^カスタム (\d+)x(\d+)$/);
  if (!m) return null;
  const width = parseInt(m[1], 10);
  const height = parseInt(m[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

/**
 * Phase A.15: サイズ → メタデータ。
 * 静的サイズは SIZE_TO_API_IRONCLAD から、カスタムサイズは on-the-fly で計算する。
 * UI / API 両方からこれを使うことで「カスタム W×H」を完全に first-class に扱える。
 */
export function getIroncladSizeMeta(s: IroncladSize): {
  apiSize: string;
  layoutHint: string;
  aspectRatio: '1:1' | '16:9' | '9:16';
  category: IroncladSizeCategory;
  needsCrop?: boolean;
} {
  const custom = parseCustomSize(s);
  if (custom) {
    const { width, height } = custom;
    const apiSize = pickApiSizeForAspect(width, height);
    const aspect = width / height;
    const aspectRatio: '1:1' | '16:9' | '9:16' =
      Math.abs(aspect - 1) < 0.05 ? '1:1' : aspect > 1 ? '16:9' : '9:16';
    return {
      apiSize,
      layoutHint: `カスタム ${width}×${height}px。アスペクト比 ${aspect.toFixed(2)}:1。${apiSize} で生成。`,
      aspectRatio,
      category: 'Custom',
    };
  }
  return SIZE_TO_API_IRONCLAD[s as keyof typeof SIZE_TO_API_IRONCLAD];
}

/**
 * Screen 1 で入力される基礎ブリーフ。
 * Screen 2 のサジェスト生成の入力源にもなる。
 * sizes は複数選択可。同じ材料で統一感のある複数サイズを一括生成する。
 */
/**
 * Phase B.5: 動画 co-gen 用 aspect ratio。Veo 3.1 が現状サポートする 2 種のみ。
 * 1:1 は Veo 非対応のため UI には出さない (admin が混乱しないように)。
 */
export type VideoCogenAspectRatio = '9:16' | '16:9';

export interface IroncladBrief {
  /** 代表 pattern（STEP2 suggest はこの 1 個で呼ぶ） */
  pattern: IroncladPattern;
  /**
   * Phase A.16: 追加スタイル（最大 2 個）。Free は常に空配列、Pro/Starter のみ最大 2 個まで設定可能。
   * STEP3 では [pattern, ...additionalPatterns] の順に直列生成する。
   */
  additionalPatterns: IroncladPattern[];
  product: string;
  target: string;
  purpose: string;
  sizes: IroncladSize[];
  /**
   * Phase B.5: 動画 co-gen を有効化する aspect ratio 群。
   * admin かつ length>=1 で各 (Pattern × Size × AR) で動画 1 本ずつ生成。
   * 非 admin は常に空配列。
   */
  videoAspectRatios?: VideoCogenAspectRatio[];
}

/**
 * Screen 2 で選択された材料（サイズは除く）。複数サイズ生成で共有される。
 */
export interface IroncladBaseMaterials {
  pattern: IroncladPattern;
  product: string;
  target: string;
  purpose: string;
  copies: [string, string, string, string];
  designRequirements: [string, string, string, string];
  cta: string;
  tone: string;
  caution: string;
  productImageUrl?: string;
  badgeImageUrl1?: string;
  badgeImageUrl2?: string;
}

/**
 * 最終画像生成用の単一サイズ材料。IroncladBaseMaterials に size を付けた形で
 * ironclad-generate API に1サイズずつ渡す。
 */
export interface IroncladMaterials extends IroncladBaseMaterials {
  size: IroncladSize;
}

/**
 * GPT-4o 用システムプロンプト（オーケストレーター版）。
 * GAS版 GPT1_SYSTEM_PROMPT と互換。
 * Screen 2 の材料を JSON で渡すと、markdown コードブロックで画像生成プロンプトを返す。
 */
export const GPT1_SYSTEM_PROMPT = `あなたはMeta広告用のバナー生成プロンプトを作る専門AIです。

ユーザーから受け取るJSONは、広告主が選択した鉄板バナーの材料データです。
このデータを元に、画像生成AI向けのバナー生成プロンプトを作成してください。

出力ルール:
- 必ず完成済みの生成プロンプトのみを出力する
- 出力は必ず1つの markdown コードブロック内に収める
- コードブロックの外には説明・注釈・前置き・補足を一切出力しない
- 空欄項目は無理に補完しない

プロンプト作成ルール:
- JSONで取得した内容を最優先で使う
- 取得していない別商材、別カテゴリ、別ブランド、別訴求を勝手に補完しない
- 取得したコピー文言を無断で別表現に置き換えすぎない
- 未確認の受賞歴、認証、ランキング、売上実績、第三者評価を勝手に追加しない
- 過激、不快、グロテスク、誇大、断定的医療表現は禁止
- 身体羞恥、過剰な不安訴求、極端なビフォーアフター表現は禁止
- productImageUrl がある場合は商品画像を優先使用と明記する
- badgeImageUrl1 または badgeImageUrl2 がある場合は認証バッジ配置を明記する

最終出力は必ず以下の体裁に従ってください。

\`\`\`markdown
あなたはMeta広告で高CTR・高CVRを狙うバナーを作るプロです。

## 商材
{商材}

## ターゲット
{ターゲット}

## 目的
{目的・コンセプト}

## コピー
・{コピー1}
・{コピー2}
・{コピー3}
・{コピー4}

## デザイン
・{サイズに応じた構図指定}
・{デザイン要件1}
・{デザイン要件2}
・{デザイン要件3}
・{デザイン要件4}
・CTA「{CTA}」
・{トーン}の世界観
・広告規約に配慮しつつ、スクロールを止める強いビジュアル
・添付された商品画像をそのまま使用し、商品ラベル・形状・見た目を改変しすぎない
・添付された認証バッジ画像を左上または左下に自然に配置する
・未確認の受賞歴・認証・実績・ランキングは入れない

## 注意
{注意事項}

## 出力
{サイズに応じた比率}の広告バナー画像を1枚生成
\`\`\``;

/**
 * 画像生成モデルに渡す直前の最重要ルール・禁止事項プレフィックス。
 * GAS版 GPT2_PREFIX と互換。
 */
export const GPT2_PREFIX = `## 最重要ルール
- 商品画像は、添付された実画像をそのまま使用すること
- 商品画像を新規生成しないこと
- 商品画像のラベル文字、ロゴ、色、形状、キャップ、比率、容器デザインを変更しない
- 認証バッジ・受賞バッジは、添付された実素材がある場合のみ使用
- 添付されていない受賞歴は勝手に追加しない
- 実在素材がない要素は、無理に生成せず省略する

## 素材使用ルール
- 商品画像は、添付画像をそのままレイアウト素材として配置
- 商品画像の一部切り抜きは可。商品本体の見た目が変わる改変は禁止
- 明るさ・コントラスト・シャドウの軽微調整は可
- バッジ素材が添付されている場合のみ、左上または左下に自然に配置
- バッジ素材が未添付の場合は、バッジ自体を表示しない

## 表現ルール
- 広告規約に配慮
- 未確認の受賞歴・認証・実績・ランキングを入れない
- 公式に確認されていない数値や効能を断定しない
- 過剰な不安訴求、身体羞恥、極端なビフォーアフター、誇大表現は禁止
- 医療効果を断定しない

## デザインルール
- スクロールを止める強いビジュアル
- テキストはスマホで読みやすい大きさ
- 主コピー → 補足 → CTA の順で視認しやすく配置
- 人物を入れる場合は日本人女性として自然に描画
- 白人・欧米系にしない

## 添付画像がある場合の優先順位
1. 添付された商品画像
2. 添付された認証バッジ画像
3. 指定されたコピー
4. 指定された構図・トーン・CTA

## 禁止事項
- 添付された商品画像を参考にして別商品を描き直す
- ラベル文字を生成し直す
- 容器の形やブランド表記を変える
- 添付されていないバッジ、No.1表現、認証マークを足す

---

`;

/**
 * サイズ → 画像生成APIに渡すサイズ文字列 & レイアウト指定の組み合わせ。
 * - apiSize: gpt-image-2 に実際に投げるサイズ（16px倍数・総ピクセル655,360〜8,294,400・アスペクト比≤3:1 を満たす）
 * - aspectRatio: Imagen4/FLUX などの汎用プロバイダー向け近似アスペクト
 * - category: UI グルーピング用
 * - needsCrop: true のサイズは最終比率が 3:1 を超えるため gpt-image-2 では 3:1 で生成して手動クロップが必要
 */
/** 静的に定義されたサイズ（カスタムを除く）。SIZE_TO_API_IRONCLAD の key に使う */
export type StaticIroncladSize = Exclude<IroncladSize, `カスタム ${number}x${number}`>;

export const SIZE_TO_API_IRONCLAD: Record<
  StaticIroncladSize,
  {
    apiSize: string;
    layoutHint: string;
    aspectRatio: '1:1' | '16:9' | '9:16';
    category: IroncladSizeCategory;
    needsCrop?: boolean;
  }
> = {
  // SNS 標準 ------------------------------------------------------------
  'Instagram (1080x1080)': {
    apiSize: '1024x1024',
    layoutHint: '1:1 正方形構図。左右均等、中央にメイン被写体を据える構成',
    aspectRatio: '1:1',
    category: 'SNS',
  },
  'FB/GDN (1200x628)': {
    apiSize: '1536x1024',
    layoutHint: '横長 1.91:1 相当。左右分割構成（左テキスト / 右メイン被写体）',
    aspectRatio: '16:9',
    category: 'SNS',
  },
  'Stories (1080x1920)': {
    apiSize: '1024x1536',
    layoutHint: '縦長 9:16 相当。上段メイン訴求 / 中段人物・商品 / 下段CTA の3段構成',
    aspectRatio: '9:16',
    category: 'SNS',
  },
  'SNS 1:1 (1200x1200)': {
    apiSize: '1024x1024',
    layoutHint: '1:1 正方形。SNS全般レスポンシブ対応の最汎用サイズ',
    aspectRatio: '1:1',
    category: 'SNS',
  },
  'Instagram 4:5 (1080x1350)': {
    apiSize: '1024x1280',
    layoutHint: '4:5 縦長。Instagramフィードで画面占有率が高い推奨比率',
    aspectRatio: '9:16',
    category: 'SNS',
  },
  'YDA 1.91:1 (600x314)': {
    apiSize: '1536x1024',
    layoutHint: '横長 1.91:1。YDA旧基準（1200x628 と同比率）',
    aspectRatio: '16:9',
    category: 'SNS',
  },
  // Display 共通 --------------------------------------------------------
  'Display 300x250': {
    apiSize: '1024x864',
    layoutHint: '中レクタングル 6:5 比率。記事中・サイドバーの国内最重要枠',
    aspectRatio: '1:1',
    category: 'Display共通',
  },
  'Display 336x280': {
    apiSize: '1024x864',
    layoutHint: 'レクタングル(大) 6:5 比率。300x250とセット運用',
    aspectRatio: '1:1',
    category: 'Display共通',
  },
  'Display 200x200': {
    apiSize: '1024x1024',
    layoutHint: '小スクエア 1:1。古いブログパーツ枠向け',
    aspectRatio: '1:1',
    category: 'Display共通',
  },
  'Display 250x250': {
    apiSize: '1024x1024',
    layoutHint: 'スクエア 1:1',
    aspectRatio: '1:1',
    category: 'Display共通',
  },
  // Display PC ----------------------------------------------------------
  'Display PC 728x90': {
    apiSize: '1536x512',
    layoutHint: 'リーダーボード（横長 8.09:1）。gpt-image-2 は 3:1 で生成 → 手動クロップ推奨',
    aspectRatio: '16:9',
    category: 'DisplayPC',
    needsCrop: true,
  },
  'Display PC 160x600': {
    apiSize: '512x1536',
    layoutHint: 'ワイドスカイスクレイパー（縦長 1:3.75）。gpt-image-2 は 1:3 で生成 → 手動クロップ推奨',
    aspectRatio: '9:16',
    category: 'DisplayPC',
    needsCrop: true,
  },
  'Display PC 300x600': {
    apiSize: '1024x2048',
    layoutHint: 'ハーフページ 1:2 縦長。PCサイドバーの広面積リッチ訴求枠',
    aspectRatio: '9:16',
    category: 'DisplayPC',
  },
  'Display PC 468x60': {
    apiSize: '1536x512',
    layoutHint: 'バナー(フル) 7.8:1。gpt-image-2 は 3:1 で生成 → 手動クロップ推奨',
    aspectRatio: '16:9',
    category: 'DisplayPC',
    needsCrop: true,
  },
  'Display PC 970x90': {
    apiSize: '1536x512',
    layoutHint: '大型リーダーボード 10.78:1。gpt-image-2 は 3:1 で生成 → 手動クロップ推奨',
    aspectRatio: '16:9',
    category: 'DisplayPC',
    needsCrop: true,
  },
  // Display SP ----------------------------------------------------------
  'Display SP 320x50': {
    apiSize: '1536x512',
    layoutHint: 'モバイルバナー 6.4:1。gpt-image-2 は 3:1 で生成 → 手動クロップ推奨',
    aspectRatio: '16:9',
    category: 'DisplaySP',
    needsCrop: true,
  },
  'Display SP 320x100': {
    apiSize: '1536x512',
    layoutHint: 'モバイルラージ 3.2:1。gpt-image-2 は 3:1 で生成 → 手動クロップ推奨',
    aspectRatio: '16:9',
    category: 'DisplaySP',
    needsCrop: true,
  },
};

/**
 * UI のカテゴリ別グルーピング用メタデータ。
 */
export const IRONCLAD_SIZE_CATEGORIES: Array<{
  key: IroncladSizeCategory;
  label: string;
  emoji: string;
  sizes: StaticIroncladSize[];
}> = [
  {
    key: 'SNS',
    label: 'SNS / レスポンシブ',
    emoji: '📱',
    sizes: [
      'Instagram (1080x1080)',
      'FB/GDN (1200x628)',
      'Stories (1080x1920)',
      'SNS 1:1 (1200x1200)',
      'Instagram 4:5 (1080x1350)',
      'YDA 1.91:1 (600x314)',
    ],
  },
  {
    key: 'Display共通',
    label: 'Display 共通（PC/SP）',
    emoji: '🌐',
    sizes: ['Display 300x250', 'Display 336x280', 'Display 200x200', 'Display 250x250'],
  },
  {
    key: 'DisplayPC',
    label: 'Display PC',
    emoji: '💻',
    sizes: [
      'Display PC 728x90',
      'Display PC 160x600',
      'Display PC 300x600',
      'Display PC 468x60',
      'Display PC 970x90',
    ],
  },
  {
    key: 'DisplaySP',
    label: 'Display SP (スマートフォン)',
    emoji: '📲',
    sizes: ['Display SP 320x50', 'Display SP 320x100'],
  },
];

/**
 * GPT-4o を介さず、Screen 2 の最終材料から直接鉄板プロンプトを構築する 1-shot 関数。
 * オーケストレーター経由で日本語テキストが崩れる事故を回避し、gpt-image-2 に
 * 構造化された材料をそのまま届ける。
 *
 * 生成結果は GPT2_PREFIX + この関数の出力 を画像 API に投げる想定。
 */
export function buildFinalImagePrompt(m: IroncladMaterials): string {
  const sizeCfg = getIroncladSizeMeta(m.size);
  const hasProduct = Boolean(m.productImageUrl);
  const hasBadge1 = Boolean(m.badgeImageUrl1);
  const hasBadge2 = Boolean(m.badgeImageUrl2);

  const lines: string[] = [
    'あなたはMeta広告で高CTR・高CVRを狙うバナーを作るプロです。',
    '',
    `## パターン`,
    m.pattern,
    '',
    `## 商材`,
    m.product,
    '',
    `## ターゲット`,
    m.target,
    '',
    `## 目的`,
    m.purpose,
    '',
    `## コピー`,
    ...m.copies.filter((c) => c && c.trim()).map((c) => `・${c}`),
    '',
    `## デザイン`,
    `・${sizeCfg.layoutHint}`,
    ...m.designRequirements.filter((d) => d && d.trim()).map((d) => `・${d}`),
    `・CTA「${m.cta}」`,
    `・${m.tone}の世界観`,
    '・広告規約に配慮しつつ、スクロールを止める強いビジュアル',
  ];

  if (hasProduct) {
    lines.push('・添付された商品画像をそのまま使用し、商品ラベル・形状・見た目を改変しすぎない');
  }
  if (hasBadge1 || hasBadge2) {
    lines.push('・添付された認証バッジ画像を左上または左下に自然に配置する');
  }
  lines.push('・未確認の受賞歴・認証・実績・ランキングは入れない');

  if (m.caution && m.caution.trim()) {
    lines.push('', '## 注意', m.caution);
  }

  lines.push(
    '',
    '## 🎨 ビジュアルスタイル指示（必ず厳守）',
    `この広告は「${m.pattern}」スタイル。下記の視覚指示に従って描画すること。`,
    '',
    VISUAL_STYLE_HINTS[m.pattern],
    '',
    '## ⚠️ コピー固定の絶対ルール',
    '上記「## コピー」セクションに記載されたコピー以外の文言を絶対に追加しないこと。',
    '禁止される追加要素の例: 「実感の声、多数」「90 Capsules」「monitor satisfaction」「自社調べ」など',
    'コピー文言は一字一句、上記指定の通りに描画する。',
    '',
    '## 出力',
    `${sizeCfg.aspectRatio} の広告バナー画像を1枚生成`,
  );

  return lines.join('\n');
}

/**
 * gpt-image-2 に最終的に投入するプロンプト（GPT2_PREFIX + 本体）を組み立てる。
 */
export function buildIroncladImagePromptWithPrefix(m: IroncladMaterials): string {
  return GPT2_PREFIX + buildFinalImagePrompt(m);
}
