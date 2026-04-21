# Phase A.5 設計書：広告品質改善（Ad Quality Uplift）

- **作成日**: 2026-04-21
- **対象リポジトリ**: `satoru-design/banner-tsukurukun`
- **起点ブランチ**: `main`（`phase-a-complete` タグ時点）
- **前提資料**:
  - 調査レポート: `docs/references/banner-kingsroad.md`
  - クリエイティブ詳細化: `docs/references/phase-a5-creative-direction.md`
  - Phase A 設計書: `docs/superpowers/specs/2026-04-21-banner-tsukurukun-v2-design.md`
- **コードネーム**: AntigravityCreative v2.5

---

## 1. 目的と成果物

### North Star
> **「素人が作ったおしゃれ画像」から「プロの広告代理店が作った売れるバナー」へ。**

Phase A で dual image provider（Imagen 4 / FLUX）により「画質」は解決した。Phase A.5 では **広告としての戦闘力**（コピー訴求力・価格バッジ・CTA・ジャンプ率・広告化プロンプト）を追加し、banavo.net 上位事例と並ぶ品質に到達する。

### 核心仮説
参考バナー 9 枚に共通する **5 層情報レイヤー**（カテゴリ → 高ジャンプ率キャッチ → 数字サブコピー → 価格バッジ → 矢印付き CTA）を、Gemini の 1 回の JSON 出力で一気通貫生成し、Step3 の UI に素直にマッピングすれば、広告代理店水準に届く。

### 完成後のユースケース

1. Step 1: LP URL 入力 → `analyze-lp` が商材情報 + `pricing.initialOffer` まで抽出
2. Step 2: **8 アングル**のコピー案が 4×2 グリッドで表示、小池さんが 1 枚選択
3. Step 3: 選択アングルに対応した
   - **価格バッジが自動配置**（人物位置 × アングル型から推奨位置）
   - **CTA テンプレート**が自動適用（商材 × 緊急度マトリクス）
   - **強調 1 単語が 2x or 3x で自動ジャンプ**
   - **画像生成プロンプトに日本広告特化タームが自動注入**
4. ユーザーは `react-rnd` で必要に応じてドラッグ調整、スタイルセレクタで切替

### 目標効果

- 参考バナー比 **75〜80% の品質**（目視評価）
- AB テストで CVR **1.3 倍以上**
- 初稿完成時間: 5 分 / LP（Phase A で達成した水準を維持しつつ広告品質向上）

### 非ゴール

- 文字装飾（座布団・フチ自動判定）→ Phase C のコントラスト解析で統合
- リファレンス画像学習モード（参考画像から style 抽出）→ Phase A.6 で独立
- スマートリサイズ（3 サイズ自動展開）→ Phase B
- 動画バナー・アニメーション GIF
- A/B テスト配信機能（生成までがスコープ、配信は別ツール）
- 自動テストスイート（Phase A と同様、手動受入のみ）

---

## 2. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router) / React 19 / TypeScript             │
│                                                              │
│  既存 Phase A の dual image provider (Imagen 4 / FLUX) を活用 │
│                                                              │
│  ── API ルート（改訂） ──────────────────────────────────── │
│  src/app/api/analyze-lp/route.ts                            │
│    └─ 出力 JSON に pricing.initialOffer を追加               │
│  src/app/api/generate-copy/route.ts                         │
│    └─ 8 アングル生成に全面刷新                               │
│    └─ JSON に angle_id / emphasis_ratio / priceBadge /      │
│       ctaTemplate / urgency を追加                           │
│                                                              │
│  ── 新規ライブラリ ─────────────────────────────────────── │
│  src/lib/prompts/angle-keywords.ts     ← アングル別英語辞書  │
│  src/lib/cta-templates.ts              ← CTA 5 種プリセット   │
│                                                              │
│  ── 新規コンポーネント ─────────────────────────────────── │
│  src/components/canvas/PriceBadge.tsx  ← バッジ 5 形状        │
│  src/components/canvas/CtaButton.tsx   ← CTA 5 種             │
│                                                              │
│  ── ライブラリ拡張 ─────────────────────────────────────── │
│  src/lib/banner-state.ts                                     │
│    └─ 型追加: PriceBadge / CtaTemplate / AngleId / Urgency  │
│    └─ 関数追加: computeDefaultBadgePosition()                │
│                  validateAndFixMarkTag()                     │
│                  renderRichText() に emphasisRatio 引数追加   │
│                  autoSelectCta(category, urgency)            │
│                                                              │
│  ── UI 改修 ────────────────────────────────────────────── │
│  src/components/steps/Step2Angles.tsx                       │
│    └─ 4 カード → 4×2 グリッド化                              │
│  src/components/steps/Step3Editor.tsx                       │
│    └─ PriceBadge / CtaButton を配置（Rnd で drag 可）         │
│    └─ バッジ・CTA スタイルセレクタ追加                        │
└─────────────────────────────────────────────────────────────┘
```

**変更規模**: 新規 4 ファイル、修正 5 ファイル、削除なし。既存 Phase A 実装との後方互換を保つ増分変更のみ。

---

## 3. 5 機能の詳細仕様

### 3.1 コピー 8 アングル拡張

#### アングル定義

**既存 4 アングル（抽象層：課題発見）**

| ID | 名称 | 訴求軸 | 主ターゲット感情 |
|---|---|---|---|
| `benefit` | ベネフィット | 得られる未来 | 期待・向上心 |
| `fear` | フィア | 失うリスク | 不安・焦り |
| `authority` | 権威 | 社会的証明 | 安心・信頼 |
| `empathy` | 共感 | 悩みの可視化 | 納得・共鳴 |

**追加 4 アングル（具体層：表現技法）**

| ID | 名称 | 訴求軸 | 典型フレーズ |
|---|---|---|---|
| `numeric` | 数字表現型 | 定量具体化 | 「367 種」「初回 ¥980」「50%OFF」 |
| `target` | ターゲット絞込み型 | 呼びかけ | 「40 代の男性へ」「忙しいあなたに」 |
| `scene` | 利用シーン提案型 | 使用文脈 | 「浴室の 3 分で」「出張の朝に」 |
| `sensory` | 臨場感演出型 | 五感刺激 | 「とろける泡」「さらさら感」「ツヤ髪」 |

#### system prompt の全面改訂

`src/app/api/generate-copy/route.ts` の system prompt を以下のように改訂：

```
あなたは日本のダイレクトレスポンス広告に 15 年従事したコピーライター兼
クリエイティブディレクターです。banavo.net 上位バナーと同等の CTR（目標 1%+）
を叩き出すコピーを生成してください。

【8 アングル】それぞれで 1 本ずつ、計 8 本を生成してください。

抽象 4 層（課題発見の切り口）
1. benefit   : 得られる理想の未来を描写
2. fear      : 何もしないと失うものを提示
3. authority : No.1 / 実績 / 専門家の裏付け
4. empathy   : ターゲットの内心を代弁

具体 4 層（表現技法）
5. numeric   : 数字を main_copy または sub_copy に必ず含める
6. target    : 「〇〇なあなたへ」「40 代男性必見」のような呼びかけで始める
7. scene     : 使用する時間・場所・状況を具体描写
8. sensory   : オノマトペ・触感・視覚効果で五感を刺激

【各アングル共通の制約】
- main_copy: 20 文字以内、<mark></mark> で強調 1 単語のみ囲む
- sub_copy: 35 文字以内、main を補強。改行可（\n で明示）
- emphasis_ratio: "2x" | "3x"（numeric と sensory と fear は 3x、それ以外は 2x）
- priceBadge: LP の価格情報から自動生成、情緒系は null 可
- ctaTemplate: 下記 5 種から商材 × 緊急度で選択
- urgency: "low" | "high"（LP 内に「期間限定」「本日限り」「残り〇〇」があれば high）

【JSON 構造】※ Markdown のバッククォートは含めない
[
  {
    "strategy": {
      "angle_id": "benefit|fear|authority|empathy|numeric|target|scene|sensory",
      "angle_label": "人間可読名",
      "target_insight": "このバナーを見た人がどう感じるべきか"
    },
    "copy": {
      "main_copy": "<mark>強調語</mark>を含む 20 字以内",
      "sub_copy": "35 字以内、\n 改行可",
      "emphasis_ratio": "2x" | "3x"
    },
    "priceBadge": {
      "text": "初回限定 ¥980",
      "shape": "circle-red",
      "color": "#E63946",
      "position": "bottom-left",
      "emphasisNumber": "980"
    } | null,
    "ctaTemplate": {
      "id": "cta-orange-arrow",
      "text": "今すぐ購入",
      "arrow": true
    },
    "urgency": "low" | "high",
    "design_specs": {
      "tone_and_manner": "...",
      "color_palette": { "main": "#1B1B1B", "accent": "#E63946" },
      "layout_id": "z-pattern | f-type | split-screen | center-focus | footer-type",
      "image_gen_prompt": "英語プロンプト（アングル固有キーワードを含む）"
    }
  }
]
```

**出力は 8 要素の配列**（現状 4 → 8）。UI 側で 4×2 グリッド表示。

#### 9 参考バナーとの型マッピング（検証済み）

| バナー | 商材 | 該当アングル | 根拠 |
|---|---|---|---|
| A | サプリ（男性向け）| benefit + numeric | 「パフォーマンス UP」+「50%OFF 2,500円」 |
| B | 黒酢ガーリック | target + fear | 「若々しくいたいあなたへ」+ 老化不安 |
| C | 青汁 | numeric + scene | 「367 種」+「簡単健康習慣」 |
| D | シャンプー | sensory + benefit | 「自然なツヤ髪」+「植物の力で」 |
| E | ヘアケア（浴室）| scene + sensory | 「洗うたび」+「しっとりツヤ髪」 |
| F | ヘアケア（スパ）| empathy + benefit | 「自信を持てる髪で新しい出発」 |
| G | イタリア旅行 | numeric + authority | 「3 日間 50 万円」+「ロレンツォが特別にアテンド」 |
| H | 京都旅行 | sensory + scene | 「瞬間を京都で感じて」 |
| I | バリ旅行 | numeric + scene | 「3 泊 4 日 15 万円」+「絶景巡り」 |

**洞察**: 9 枚中 9 枚で「数字 or 臨場感」が必ず 1 レイヤー入っている。既存 4 アングルだけではこの層が生成されず、ここが CTR を決めている。

### 3.2 価格バッジ生成

#### JSON スキーマ

```typescript
// src/lib/banner-state.ts に追加
export type PriceBadgeShape =
  | 'circle-red'       // 赤丸（セール・定番）
  | 'circle-gold'      // 金丸（プレミアム・D2C）
  | 'rect-red'         // 赤角丸（緊急・限定）
  | 'ribbon-orange'    // リボン型（キャンペーン告知）
  | 'capsule-navy';    // カプセル型ネイビー（BtoB・金融）

export type PriceBadgePosition =
  | 'top-left' | 'top-right'
  | 'bottom-left' | 'bottom-right'
  | 'center-right' | 'floating-product';

export interface PriceBadge {
  text: string;
  shape: PriceBadgeShape;
  color: string;
  position: PriceBadgePosition;
  emphasisNumber?: string;  // 他より 1.5x サイズで描画
}
```

#### text 生成の優先順位

1. **LP 解析結果を最優先**: `analyze-lp` に `pricing.initialOffer` / `pricing.discount` フィールドを追加し、そこから自動抽出
2. **フォールバック（アングル別定型文）**:
   - `numeric`: 「初回限定 ¥{number}」
   - `fear`: 「今だけ 50%OFF」
   - `authority`: 「累計販売 〇〇万個」
   - `scene` / `sensory`: 「送料無料」（価格訴求より体験訴求）
3. **ユーザー上書き**: Step3 の `<input>` で常に編集可能（最優先）

#### 5 形状の HTML/CSS 実装

```typescript
// src/components/canvas/PriceBadge.tsx
const BADGE_STYLES: Record<PriceBadgeShape, string> = {
  'circle-red':
    'w-[120px] h-[120px] rounded-full bg-[#E63946] text-white flex flex-col items-center justify-center text-center font-black shadow-lg',
  'circle-gold':
    'w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#D4A017] to-[#8B6914] text-white flex flex-col items-center justify-center text-center font-black shadow-lg border-2 border-[#FFD700]',
  'rect-red':
    'px-6 py-3 rounded-xl bg-[#E63946] text-white font-black shadow-md -rotate-3',
  'ribbon-orange':
    'relative px-8 py-2 bg-[#FF6B35] text-white font-black shadow-md before:absolute before:left-0 before:top-full before:border-t-[10px] before:border-l-[10px] before:border-t-[#B8471C] before:border-l-transparent',
  'capsule-navy':
    'px-6 py-2 rounded-full bg-[#1D3557] text-white font-bold shadow-sm',
};
```

**emphasisNumber** は内部で `<span className="text-[32px]">` と `<span className="text-[14px]">` に分けて描画、数字部分を 1.5x 以上で強調。

#### 配置ロジック（AI デフォルト）

```typescript
// src/lib/banner-state.ts
export function computeDefaultBadgePosition(
  layout: LayoutStyle,
  hasPerson: boolean,
  angle: AngleId
): PriceBadgePosition {
  if (layout === 'left' && hasPerson) return 'bottom-left';     // 人物右 → バッジ左下
  if (layout === 'right' && hasPerson) return 'top-right';      // 人物左 → バッジ右上
  if (angle === 'authority') return 'top-right';                 // 権威は信頼感ヘッダー
  if (angle === 'numeric') return 'center-right';                // 数字は主役センター
  return 'bottom-right';
}
```

#### 情緒系（sensory / empathy 単体）は null 可

参考バナー F, H（ヘアケアスパ / 京都旅行）はバッジなし。価格訴求より体験訴求を優先するため。JSON スキーマで `priceBadge: PriceBadge | null` を許可。

### 3.3 CTA テンプレート 5 種

#### 5 種のデザイン仕様

```typescript
// src/lib/cta-templates.ts
export type CtaTemplateId =
  | 'cta-green-arrow'    // 健康食品・通販
  | 'cta-orange-arrow'   // EC 全般
  | 'cta-red-urgent'     // 期間限定・セール
  | 'cta-gold-premium'   // プレミアム D2C
  | 'cta-navy-trust';    // BtoB・金融・医療

export const CTA_TEMPLATES = {
  'cta-green-arrow': {
    className:
      'px-8 py-4 rounded-full bg-gradient-to-b from-[#22C55E] to-[#15803D] text-white font-black text-lg shadow-[0_4px_12px_rgba(34,197,94,0.4)] hover:shadow-[0_6px_16px_rgba(34,197,94,0.6)] hover:scale-[1.03] transition-all',
    suggestedText: ['今すぐ購入', '無料で試す', '今すぐ予約'],
    arrow: true,
  },
  'cta-orange-arrow': {
    className:
      'px-8 py-4 rounded-xl bg-gradient-to-b from-[#FF8C42] to-[#D96A1F] text-white font-black text-lg shadow-[0_4px_12px_rgba(217,106,31,0.45)] hover:scale-[1.03] transition-all',
    suggestedText: ['今すぐ購入', 'カートに入れる', '詳細を見る'],
    arrow: true,
  },
  'cta-red-urgent': {
    className:
      'px-8 py-4 rounded-xl bg-gradient-to-b from-[#EF4444] to-[#B91C1C] text-white font-black text-lg shadow-[0_4px_12px_rgba(185,28,28,0.5)] hover:scale-[1.03] transition-all animate-pulse',
    suggestedText: ['本日限り', '残りわずか', '今すぐ申し込む'],
    arrow: true,
  },
  'cta-gold-premium': {
    className:
      'px-8 py-4 rounded-lg bg-gradient-to-b from-[#D4A017] to-[#8B6914] text-white font-black text-lg shadow-md border border-[#FFD700] hover:scale-[1.02] transition-all',
    suggestedText: ['詳細を確認する', '無料体験を申し込む', '特別価格で購入'],
    arrow: false,
  },
  'cta-navy-trust': {
    className:
      'px-8 py-3 rounded-md bg-[#1D3557] text-white font-bold shadow-sm hover:bg-[#2A4A7F] transition-all',
    suggestedText: ['資料請求する', '無料相談を予約', 'お問い合わせ'],
    arrow: false,
  },
} as const;

export const CtaArrow = () => (
  <svg className="inline ml-2 w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.59 16.58L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);
```

#### 文言生成ルール（商材 × 緊急度）

| 商材タイプ | 低緊急度 | 高緊急度 |
|---|---|---|
| 健康食品 / D2C | `cta-green-arrow` | `cta-red-urgent` |
| コスメ / ヘアケア | `cta-gold-premium` | `cta-orange-arrow` |
| 旅行 | `cta-orange-arrow` | `cta-red-urgent` |
| BtoB / 金融 | `cta-navy-trust` | `cta-navy-trust` |
| EC 全般 | `cta-orange-arrow` | `cta-red-urgent` |

**緊急度判定**: Gemini が `urgency: "low" | "high"` を JSON に含める。LP に「期間限定」「本日限り」「残り〇〇」のいずれかがあれば `high`。

#### ホバー・シャドウ仕様
- **shadow**: RGBA でベース色の 0.4〜0.5 透明度、縦オフセット 4px、ブラー 12px
- **hover**: scale(1.03) + shadow 強化
- **transition**: 200ms ease
- **緊急度 high**: `animate-pulse` で 2 秒周期の脈動

### 3.4 ジャンプ率の自動設計

#### 「強調 1 単語」特定：ハイブリッド方式

**Gemini 側（一次指定）**: system prompt で `<mark></mark>` 強制、優先順位は「①数字 → ②核心ベネフィット → ③オノマトペ → ④動詞」。

**後処理（二次バリデーション）**:
```typescript
// src/lib/banner-state.ts
export function validateAndFixMarkTag(mainCopy: string): string {
  const markCount = (mainCopy.match(/<mark>/g) || []).length;
  if (markCount === 1) return mainCopy;
  if (markCount === 0) {
    const withNumberMark = mainCopy.replace(/([0-9]+[%円]?)/, '<mark>$1</mark>');
    if (withNumberMark !== mainCopy) return withNumberMark;
    return mainCopy.replace(/^([ぁ-んァ-ヶ一-龠]{2,5})/, '<mark>$1</mark>');
  }
  let count = 0;
  return mainCopy.replace(/<mark>(.+?)<\/mark>/g, (m, p1) => {
    count++;
    return count === 1 ? m : p1;
  });
}
```

#### 倍率の出し分け基準

| アングル | 倍率 | 理由 |
|---|---|---|
| `numeric` | **3x** | 数字は広告の主役 |
| `sensory` | **3x** | 五感刺激は躍動感が必要 |
| `fear` | **3x** | 煽り系は強ジャンプ |
| `benefit` | 2x | 未来描写は落ち着き |
| `authority` | 2x | 信頼感は落ち着き |
| `empathy` | 2x | 共感は同じ目線 |
| `target` | 2x | 呼びかけは自然なトーン |
| `scene` | 2x | シーン描写は情緒 |

#### ターゲット層補正

`analyze-lp` の `inferred_target_demographic` から判定：
- 30代以下 / SNS 世代: **+0.5x**
- 50代以上 / シニア: **-0.5x**
- BtoB: **-0.5x**

> **Phase A.5 では未実装、Phase A.6 で対応予定**。
> `analyze-lp` の `inferred_target_demographic` からの自動判定ロジックは、リファレンス学習モード（Phase A.6）の一部として実装する。Phase A.5 では `emphasis_ratio` は Gemini 出力（`2x` or `3x`）をそのまま使う。

#### `renderRichText` 拡張

```typescript
// src/lib/banner-state.ts
export function renderRichText(
  content: string,
  accentColor: string,
  emphasisRatio: '2x' | '3x' = '2x'
): React.ReactNode {
  const parts = content.split(/(<mark>.*?<\/mark>)/);
  const scale = emphasisRatio === '3x' ? 1.5 : 1.0;
  return parts.map((p, i) => {
    const match = p.match(/<mark>(.*?)<\/mark>/);
    if (match) {
      return (
        <span key={i} style={{
          color: accentColor,
          fontSize: `${scale}em`,
          fontWeight: 900,
          display: 'inline-block',
          margin: '0 0.1em',
        }}>
          {match[1]}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
```

実装時は `transform: scale()` と `fontSize` 倍率の両方を試し、行高への影響を見て最適な方を採用。

### 3.5 画像プロンプトの広告化

#### 共通プレフィックス（全アングル共通）

```
high-quality Japanese direct-response ad banner aesthetic,
commercial photography, crisp focus, dramatic studio lighting,
strong negative space on the {layoutSide} for overlay typography,
16:9 or 1:1 composition, shot on Canon EOS R5, 85mm lens
```

#### プロバイダ別

**Imagen 4** (Google 系、人物・テキスト整合に強い):
```
追加: "photorealistic, magazine cover quality, soft rim light, shallow depth of field"
negativePrompt: "no lens flare"
```

**FLUX 1.1 pro** (Replicate、スタイル制御に強い):
```
追加: "cinematic color grading, product hero shot, editorial advertising style"
negativePrompt: "text, letters, watermark, logo, low quality, blurry, cartoon, 3d render, nsfw"
```

#### アングル別キーワード辞書

```typescript
// src/lib/prompts/angle-keywords.ts
import type { AngleId } from '@/lib/banner-state';

export const ANGLE_KEYWORDS: Record<AngleId, string> = {
  benefit:   'bright uplifting mood, warm sunlight, confident smile, aspirational lifestyle',
  fear:      'moody dramatic lighting, concerned expression, contrast between before and after, muted tones',
  authority: 'professional trustworthy, business attire, clean white background, authoritative composition',
  empathy:   'intimate relatable, natural home setting, soft window light, candid unposed moment',
  numeric:   'product hero shot with prominent price tag area, bold composition, high contrast for text overlay',
  target:    'demographic-specific setting, direct eye contact with camera',
  scene:     'specific use-case environment (bathroom/office/kitchen), in-the-moment action shot',
  sensory:   'tactile texture emphasis, slow-motion splash or flow, macro details, vibrant saturation',
};
```

#### 既存 useEffect への統合

`src/app/page.tsx` の画像プロンプト構築 useEffect に、以下の合流ロジックを追加：

```typescript
const PROVIDER_PREFIX: Record<ImageProviderId, string> = {
  imagen4: 'photorealistic, magazine cover quality, soft rim light',
  flux: 'cinematic color grading, product hero shot, editorial advertising style',
};

const megaPrompt = [
  'high-quality Japanese direct-response ad banner aesthetic, commercial photography',
  PROVIDER_PREFIX[imageModel],
  ANGLE_KEYWORDS[activeVariation.strategy.angle_id],  // NEW
  activeVariation.design_specs.image_gen_prompt,
  `strong negative space on the ${layoutStyle} for overlay typography`,
  hasPerson === 'yes' ? `${personAttr} person, natural pose, looking at product` : '',
  bannerTone,
  additionalInstructions,
].filter(Boolean).join(', ');
```

---

## 4. データモデル変更

`prisma/schema.prisma` の `Banner` モデルに以下を追加（Phase A.5 完了時に migration 実行）：

```prisma
model Banner {
  // ... 既存フィールド ...
  imageModel       String?  // Phase A
  parentBannerId   String?  // 予約（Phase B）
  readabilityScore Float?   // 予約（Phase C）
  heatmapUrl       String?  // 予約（Phase D）
  counterSourceId  String?  // 予約（Phase E）

  // Phase A.5 で追加
  angleId          String?  // "benefit" | "fear" | ... 8 種
  priceBadge       String?  // JSON stringified PriceBadge | null
  ctaTemplateId    String?  // "cta-green-arrow" | ...
  ctaText          String?  // 実際に使われた CTA 文言
  emphasisRatio    String?  // "2x" | "3x"
  urgency          String?  // "low" | "high"

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

`save-banner/route.ts` と `page.tsx` の `handleSaveList` で新フィールドを POST body に含める。

---

## 5. データフロー（改訂版）

```
LP URL 入力
   ↓
analyze-lp（改訂: pricing.initialOffer 追加）
   ↓
generate-copy（全面刷新: 8 アングル、priceBadge/ctaTemplate/emphasis_ratio/urgency を JSON に含める）
   ↓
Step2Angles（改訂: 4×2 グリッド UI、8 カード表示）
   ↓ カード選択
Step3Editor（改訂）
   ├─ 画像生成（useEffect 改訂: ANGLE_KEYWORDS + PROVIDER_PREFIX 合流）
   ├─ PriceBadge 配置（computeDefaultBadgePosition から推奨、Rnd で drag 可能）
   ├─ CtaButton 適用（CTA_TEMPLATES から選定、文言編集可能）
   ├─ renderRichText で emphasis_ratio 適用（2x or 3x 自動ジャンプ）
   └─ ユーザーはスタイルセレクタで切替（shape / color / position）
   ↓
save-banner（JSON に angleId / priceBadge / ctaTemplateId / emphasisRatio / urgency 追加）
```

---

## 6. エラーハンドリング・フォールバック戦略

| シナリオ | 対応 |
|---|---|
| Gemini が 8 個未満返す | 欠けたアングル ID を検出し、既存の benefit 生成ロジックで補填。UI にバッジ「生成不足」表示 |
| `<mark>` タグ 0 個 | `validateAndFixMarkTag()` で数字優先自動ラップ |
| `<mark>` タグ 2 個以上 | 先頭のみ残し他は平文化 |
| LP から価格抽出失敗 | アングル別定型文フォールバック |
| `priceBadge` が不正スキーマ | null にフォールバックし UI 側でバッジ非表示 |
| `ctaTemplate` 未知 ID | `cta-orange-arrow` にフォールバック |
| `emphasis_ratio` 未指定 | `2x` デフォルト |
| アングル ID が未知 | `benefit` にフォールバック、ログ警告 |

---

## 7. テスト戦略

### 手動受入テスト（Phase A.5 完了時）

参考 9 枚と同種カテゴリの LP 3 本（健康食品・ヘアケア・旅行）で各アングル 1 本ずつ生成、合計 24 枚を目視評価。評価シートを `docs/baselines/2026-04-21-phase-a5/evaluation.md` に記録。

**評価軸（各 1〜5 点）**:
1. 広告らしさ（参考バナー比）
2. 可読性
3. 商品への視線誘導
4. 価格バッジの自然さ
5. ジャンプ率の効果

**合格基準**: 24 枚平均で各軸 3.5 以上、かつ参考バナーと並べたブラインドテストで 30% 以上が Phase A.5 側を選ぶ。

### 自動テスト
Phase A と同様、スコープ外。`image-providers` のようなユニットテスト追加もなし。

### AB テスト（運用後）

| 仮説 | A 群 | B 群 | 評価指標 | 最低ライン |
|---|---|---|---|---|
| H1 | 既存 4 アングル | 新 8 アングル | 人間「使える率」 | 8 アングル群が 1.3x |
| H2 | priceBadge なし | priceBadge あり | CVR | あり群が 1.3x |
| H3 | emphasis_ratio 2x 固定 | アングル別 2x/3x | 視線到達率（Phase D） | 出し分け群が 1.1x |
| H4 | Imagen 4 単独 | FLUX 単独 | 画質評価 5 段階 | （判断材料） |
| H5 | CTA 固定 | 商材別自動選定 | CTR | 自動選定群が 1.2x |

**最優先検証**: H1 と H2。H1/H2 が 1.3x 未満なら Phase A.5 のスコープ自体を再検討する。

---

## 8. スコープ外（明示・再掲）

- 文字装飾（座布団・フチ自動判定）→ Phase C で統合
- リファレンス画像学習モード → Phase A.6 で独立
- ターゲット層補正（`inferred_target_demographic` → `emphasis_ratio` 自動加減）→ Phase A.6 で独立
- スマートリサイズ（3 サイズ自動展開）→ Phase B
- 動画バナー・アニメーション GIF
- A/B テスト配信機能
- 自動テストスイート
- モバイル専用 UI（デスクトップのレスポンシブ対応のみ）

---

## 9. 実装順序（7 日スプリント）

| Day | タスク | 主な変更ファイル |
|---|---|---|
| 1 | `generate-copy/route.ts` の 8 アングル化 + JSON スキーマ拡張 | `src/app/api/generate-copy/route.ts`、`src/lib/banner-state.ts`（型追加） |
| 2 | `PriceBadge` コンポーネント + 5 種 CSS + 配置ロジック | `src/components/canvas/PriceBadge.tsx`、`src/lib/banner-state.ts` |
| 3 | `CTA_TEMPLATES` 5 種 + `CtaButton` + Step3 UI 統合 | `src/lib/cta-templates.ts`、`src/components/canvas/CtaButton.tsx`、`src/components/steps/Step3Editor.tsx` |
| 4 | `renderRichText` 拡張 + `validateAndFixMarkTag` + `emphasis_ratio` 適用 | `src/lib/banner-state.ts` |
| 5 | 画像プロンプト広告化（`angle-keywords.ts` + useEffect 改修） | `src/lib/prompts/angle-keywords.ts`、`src/app/page.tsx` |
| 6 | Step2Angles の 4×2 グリッド UI 改修 + `analyze-lp` に pricing 追加 | `src/components/steps/Step2Angles.tsx`、`src/app/api/analyze-lp/route.ts` |
| 7 | Prisma schema 更新 + save-banner 拡張 + 手動受入テスト 24 枚 | `prisma/schema.prisma`、`src/app/api/save-banner/route.ts`、`docs/baselines/2026-04-21-phase-a5/` |

---

## 10. オープンクエスチョン

**なし**。creative-direction による詳細化で全要素が実装可能レベルに定義済み。実装中に `transform: scale()` vs `fontSize` 倍率の行高影響が判明したら、現場判断で実装プランに差し戻す（Day 4 のタスク内で吸収可能）。

---

## 変更履歴

- 2026-04-21: 初稿（小池さんとのブレスト後、調査レポート + creative-direction 詳細化を統合して起草）
