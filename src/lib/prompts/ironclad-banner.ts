/**
 * Ironclad Banner Prompt Builder (Phase A.7)
 *
 * GAS版オーケストラ.gs で実績のある鉄板プロンプト構造を TypeScript に移植。
 * - GPT1_SYSTEM_PROMPT: ブリーフ入力材料 → 画像生成プロンプトを markdown で生成（GPT-4o 用システム指示）
 * - GPT2_PREFIX: 画像生成モデルに渡す直前の最重要ルール + 禁止事項
 * - buildFinalImagePrompt: 選択済み材料から 1 ショットで鉄板プロンプトを構築
 *   （オーケストレーターを介さずテキスト描画忠実度を最大化するパスも用意）
 */

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

/**
 * Screen 1 で入力される基礎ブリーフ。
 * Screen 2 のサジェスト生成の入力源にもなる。
 */
export interface IroncladBrief {
  pattern: IroncladPattern;
  product: string;
  target: string;
  purpose: string;
  size: 'Instagram (1080x1080)' | 'FB/GDN (1200x628)' | 'Stories (1080x1920)';
}

/**
 * Screen 2 でユーザーが選択した最終材料。
 * 画像生成用の鉄板プロンプトの原材料となる。
 */
export interface IroncladMaterials extends IroncladBrief {
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
 */
export const SIZE_TO_API_IRONCLAD: Record<
  IroncladMaterials['size'],
  { apiSize: string; layoutHint: string; aspectRatio: '1:1' | '16:9' | '9:16' }
> = {
  'Instagram (1080x1080)': {
    apiSize: '1024x1024',
    layoutHint: '1:1 正方形構図。左右均等、中央にメイン被写体を据える構成',
    aspectRatio: '1:1',
  },
  'FB/GDN (1200x628)': {
    apiSize: '1536x1024',
    layoutHint: '横長 16:9 相当。左右分割構成（左テキスト / 右メイン被写体）',
    aspectRatio: '16:9',
  },
  'Stories (1080x1920)': {
    apiSize: '1024x1536',
    layoutHint: '縦長 9:16 相当。上段メイン訴求 / 中段人物・商品 / 下段CTA の3段構成',
    aspectRatio: '9:16',
  },
};

/**
 * GPT-4o を介さず、Screen 2 の最終材料から直接鉄板プロンプトを構築する 1-shot 関数。
 * オーケストレーター経由で日本語テキストが崩れる事故を回避し、gpt-image-2 に
 * 構造化された材料をそのまま届ける。
 *
 * 生成結果は GPT2_PREFIX + この関数の出力 を画像 API に投げる想定。
 */
export function buildFinalImagePrompt(m: IroncladMaterials): string {
  const sizeCfg = SIZE_TO_API_IRONCLAD[m.size];
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
