# Phase A.6 設計書：リファレンス学習モード（Reference Learning Mode）

- **作成日**: 2026-04-21
- **対象リポジトリ**: `satoru-design/banner-tsukurukun`
- **起点ブランチ**: `main`（`phase-a5-complete` タグ時点）
- **前提資料**:
  - Phase A.5 設計書: `docs/superpowers/specs/2026-04-21-phase-a5-ad-quality.md`
  - 調査レポート: `docs/references/banner-kingsroad.md`
  - クリエイティブ詳細化: `docs/references/phase-a5-creative-direction.md`
- **コードネーム**: AntigravityCreative v2.6

---

## 1. 目的と成果物

### North Star
> **「参考バナー 3〜5 枚を一度アップロードすれば、以降その商材の生成はすべて参考水準で量産される。」**

Phase A.5 までで「広告っぽい要素（8 アングル・価格バッジ・CTA・ジャンプ率）」を載せられる状態にした。Phase A.6 では、**小池さんが実際に使いたい参考バナーから style を学習**し、生成物を**参考水準に引き上げる**。

### 核心仮説
banavo.net 上位事例や小池さんが理想とする広告バナー群は、
1. **visualStyle**（色・ライティング・構図）
2. **typography**（書体・縦組み・ジャンプ率）
3. **priceBadge**（形状・配置・マイクロコピー）
4. **cta**（色・文言パターン）
5. **layout**（人物/商品/テキストの配置規則）
6. **copyTone**（語彙・格式・NG 表現）

の 6 要素の組み合わせで品質が決まる。参考画像 3〜5 枚を Gemini 2.5 Pro Vision で一括解析し、構造化 JSON（`StyleProfile`）として保存 → 生成時に注入すれば、参考水準を再現できる。

### 完成後のユースケース

**初回（プロファイル作成、5 分）**:
1. Step 1 の「+ 新規プロファイル作成」をクリック → 全画面モーダル
2. 参考画像 3〜5 枚を D&D
3. 「解析開始」 → Vercel Blob に保存、Gemini Vision で抽出、`StyleProfile` JSON 返却
4. Editor UI で各フィールドを確認・微調整
5. 「保存」 → Prisma に INSERT

**2 回目以降（使用、0 秒）**:
1. Step 1 で **プロファイルセレクタ**から「5 Point Detox 用」を選択
2. LP URL 貼り付け → 「AIで8つのアングルを生成」
3. 以降、プロファイルに寄った 8 アングル + 広告画像 + 価格バッジ + CTA が出力
4. Step 3 に進むと `priceBadge.primary` / `secondary` と `cta` の**デフォルト配置**がプロファイルから自動ロード

### 目標効果

- 参考バナー比 **90〜95% の品質**（目視評価）
- プロファイル 1 つ作成: 初回 **5 分**、再利用は **0 秒**
- 小池さんの各クライアント（5 Point Detox / 美容液 A / BtoB C 等）ごとにプロファイルを蓄積 → **資産化**
- 広告代理店の納品水準に到達

### 非ゴール

- プロファイルのバージョニング（履歴保持）
- プロファイルのエクスポート/インポート（マルチユーザー共有）
- プロファイル間の比較 UI
- A/B テスト用の複数プロファイル並行使用
- 参考画像内テキストの OCR 抽出
- 動的プロファイル自動切替（時期・季節別）
- AI によるプロファイル推薦

---

## 2. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router) / React 19 / TypeScript                 │
│                                                                  │
│  ── 新規 API ルート ───────────────────────────────────────── │
│  /api/style-profile                                              │
│    POST    - create (name + extracted StyleProfile)              │
│    GET     - list                                                │
│  /api/style-profile/[id]                                         │
│    GET     - 単体取得                                             │
│    PUT     - 更新（編集 UI からの保存）                            │
│    DELETE  - 削除                                                 │
│  /api/style-profile/extract                                      │
│    POST    - 参考画像を Blob アップ → Gemini Vision 抽出         │
│              → StyleProfile JSON 返却（DB 未保存）                 │
│                                                                  │
│  ── 改修 API ──────────────────────────────────────────────── │
│  /api/generate-copy          - styleProfileId を body で受取     │
│                                 → copyTone / typography を注入   │
│  /api/generate-image         - 同上                              │
│                                 → visualStyle.imagePromptKeywords│
│                                 → layout を注入                  │
│                                                                  │
│  ── 新規コンポーネント ──────────────────────────────────── │
│  src/components/steps/StyleProfileSelector.tsx                  │
│    Step1 上部。プロファイル一覧（ラジオ）+ 新規作成リンク          │
│  src/components/style/ReferenceImageUploader.tsx                │
│    D&D 領域 + プレビュー（最大 7 枚）                              │
│  src/components/style/StyleProfileEditor.tsx                    │
│    全画面モーダル。抽出結果の編集 UI（6 要素すべて）               │
│  src/components/style/StyleProfileCard.tsx                      │
│    一覧画面（将来用、Phase A.6 では MVP として Selector のみ）    │
│                                                                  │
│  ── 新規ライブラリ ───────────────────────────────────────── │
│  src/lib/style-profile/                                          │
│    ├─ schema.ts           StyleProfile TypeScript 型定義         │
│    ├─ extractor.ts        Gemini Vision 抽出プロンプト + 正規化  │
│    ├─ injector.ts         generate-copy / image への合流ロジック │
│    ├─ blob-client.ts      Vercel Blob SDK ラッパー              │
│    └─ defaults.ts         欠損フィールドのデフォルト値           │
│                                                                  │
│  ── Prisma モデル追加 ───────────────────────────────────── │
│  StyleProfile                                                    │
│  Banner テーブルに styleProfileId カラム追加（任意参照）          │
│                                                                  │
│  ── 環境変数 ────────────────────────────────────────────── │
│  BLOB_READ_WRITE_TOKEN   Vercel Blob 用                          │
└─────────────────────────────────────────────────────────────────┘
```

**変更規模**: 新規 12 ファイル、修正 6 ファイル、削除 0。Phase A.5 を壊さない純粋増分。

---

## 3. StyleProfile データスキーマ

### Prisma モデル

```prisma
model StyleProfile {
  id                  String   @id @default(cuid())
  name                String   @unique  // "5 Point Detox 用"
  productContext      String?  // 商材メモ（任意）

  // Vercel Blob の URL 配列を JSON 文字列で保存
  referenceImageUrls  String   // JSON.stringify(string[])

  // 抽出結果 6 要素を JSON 文字列で保存
  visualStyle         String   // JSON.stringify(VisualStyle)
  typography          String   // JSON.stringify(Typography)
  priceBadge          String   // JSON.stringify(PriceBadgeSpec)
  cta                 String   // JSON.stringify(CtaSpec)
  layout              String   // JSON.stringify(LayoutSpec)
  copyTone            String   // JSON.stringify(CopyTone)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  banners             Banner[]
}

model Banner {
  // 既存フィールド省略
  styleProfileId      String?
  styleProfile        StyleProfile? @relation(fields: [styleProfileId], references: [id])
  // Phase A.5 フィールド省略
}
```

### TypeScript 型定義（src/lib/style-profile/schema.ts）

```typescript
export interface StyleProfile {
  id: string;
  name: string;
  productContext?: string;
  referenceImageUrls: string[];

  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;

  createdAt: Date;
  updatedAt: Date;
}

export interface VisualStyle {
  colorPalette: {
    primary: string;     // "#1A5F3F"
    accents: string[];   // ["#E67E22", "#F4C430"]
    background: string;  // "#F8F7F2"
  };
  lighting: 'high-key' | 'low-key' | 'natural' | 'dramatic' | 'studio';
  mood: string;          // 自由記述「爽やか・健康的」
  composition: string;   // 自由記述「人物左 + 商品中央 + テキスト右」
  imagePromptKeywords: string;  // 英語、画像生成プロンプト注入用
}

export interface Typography {
  mainCopyStyle: {
    family: 'mincho' | 'gothic' | 'brush' | 'modern-serif' | 'hand-written';
    orientation: 'horizontal' | 'vertical';
    weight: 'normal' | 'bold' | 'black';
    emphasisRatio: '2x' | '3x' | '4x';
    color: string;
    strokeColor?: string;
    strokeWidth?: number;
  };
  subCopyStyle: {
    family: 'mincho' | 'gothic' | 'modern-serif';
    size: 'small' | 'medium' | 'large';
    color: string;
  };
  microCopyExamples: string[];  // "※1 販売期間1981年4月〜" 等の実例
}

export interface PriceBadgeSpec {
  primary: {
    shape: 'circle-red' | 'circle-gold' | 'rect-red' | 'ribbon-orange' | 'capsule-navy';
    color: string;
    textPattern: string;  // "初回 ¥{NUMBER}"
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-right' | 'floating-product';
  };
  secondary?: {
    shape: 'circle-flower' | 'ribbon' | 'circle' | 'rect';
    color: string;
    textPattern: string;  // "累計 {NUMBER} 本突破!!"
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-right' | 'floating-product';
  };
}

export interface CtaSpec {
  templateId: 'cta-green-arrow' | 'cta-orange-arrow' | 'cta-red-urgent' | 'cta-gold-premium' | 'cta-navy-trust';
  textPattern: string;  // "{ACTION}で始める →"
  position: 'bottom-center' | 'bottom-left' | 'bottom-right';
}

export interface LayoutSpec {
  personZone: 'left' | 'right' | 'center' | 'none';
  productZone: 'left' | 'right' | 'center' | 'bottom';
  mainCopyZone: 'left' | 'right' | 'top' | 'bottom' | 'center';
  brandLogoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none';
  decorations: Array<{
    type: 'ribbon' | 'diagonal-line' | 'frame' | 'particle';
    position: string;  // 自由記述
    color: string;
  }>;
}

export interface CopyTone {
  formalityLevel: 'casual' | 'neutral' | 'formal';
  vocabulary: string[];     // ["若々しい", "リセット", "手間ゼロ"]
  taboos: string[];         // ["激安", "絶対", "必ず"]
  targetDemographic: string;  // "40代女性、美容意識高い層"
}
```

### Gemini Vision 抽出プロンプト（src/lib/style-profile/extractor.ts）

```
あなたは広告クリエイティブ分析のプロフェッショナルです。
提供された参考バナー画像 {N} 枚を精読し、共通する「スタイル仕様」を
以下の JSON スキーマで抽出してください。Markdown ブロックを含めず、
純粋な JSON テキストのみ出力してください。

【スキーマ】
（上記 TypeScript 型を JSON 表現にしたもの、全 6 要素）

【抽出の注意】
- 画像ごとに違う要素は多数決で決定
- 色は Hex コードで推定
- タイポグラフィは書体系列を 5 種類から選ぶ
- マイクロコピーは実際に画像内で読み取れた文字列を 3〜5 例
- copyTone.vocabulary は 3〜7 語、taboos は推測 3 語
- 判定不能な場合は null は使わず、最も近いデフォルト値を選ぶ
```

---

## 4. データフロー

### 4.1 プロファイル作成フロー（初回）

```
[Step1] ユーザーが「+ 新規プロファイル作成」をクリック
    ↓
[フロント] StyleProfileEditor モーダル起動
    ↓
[フロント] ReferenceImageUploader で 3〜5 枚 D&D
    ↓
[フロント] 「解析開始」ボタン
    ↓
[API] POST /api/style-profile/extract
    body: { images: File[], productContext?: string }
    ↓
[サーバー] 各画像を Vercel Blob に PUT
    → referenceImageUrls[] 取得
    ↓
[サーバー] Gemini 2.5 Pro Vision に画像 URL（または inline data）+ 抽出プロンプト
    → StyleProfile JSON 受領（validate + 欠損補完）
    ↓
[API レスポンス] { referenceImageUrls, visualStyle, typography, priceBadge, cta, layout, copyTone }
    ↓
[フロント] StyleProfileEditor に結果表示。各フィールド編集可能
    ↓
[フロント] 「保存」ボタン → POST /api/style-profile
    body: { name, productContext, ...StyleProfile }
    ↓
[API] Prisma に INSERT → { id, ...プロファイル全体 }
    ↓
[フロント] StyleProfileSelector 一覧を更新、作成したプロファイルを選択済み状態に
```

### 4.2 プロファイル使用フロー（2 回目以降）

```
[Step1] ユーザーが StyleProfileSelector で「5 Point Detox 用」選択
  （State: selectedStyleProfileId）
    ↓
[Step1] LP URL 入力 → 「AIで8つのアングルを生成」
    ↓
[API] POST /api/generate-copy
    body: { productName, target, lpText, styleProfileId }
    ↓
[サーバー] Prisma から StyleProfile を取得
    ↓
[サーバー] injector.injectIntoCopyPrompt(systemPrompt, styleProfile)
    - copyTone.vocabulary を「必ず含めてほしい語彙」として注入
    - copyTone.taboos を「避けるべき表現」として注入
    - copyTone.formalityLevel を全体トーンとして注入
    - typography.mainCopyStyle.emphasisRatio を各アングルのデフォルトとして注入
    - priceBadge.primary.textPattern を数字アングルの priceBadge.text に注入
    ↓
[サーバー] Gemini 2.5 Pro に拡張プロンプトで generateContent
    → 8 アングル配列（プロファイルに寄ったコピー）
    ↓
[フロント] Step2Angles で表示（既存 Phase A.5 UI）
    ↓
[フロント] アングル選択 → Step3 へ
    ↓
[フロント] Step3Editor 初期化時、StyleProfile から以下を読込:
    - priceBadge.primary / secondary を Rnd 要素として配置
    - cta.templateId + cta.textPattern で CtaButton をレンダリング
    - typography.mainCopyStyle を main-text Rnd 要素に適用
    - layout.brandLogoPosition でロゴ位置デフォルト
    - layout.decorations で装飾要素を追加配置
    ↓
[フロント] 「背景画像を生成してエディタへ」
    ↓
[API] POST /api/generate-image
    body: { prompt, provider, aspectRatio, styleProfileId }
    ↓
[サーバー] injector.injectIntoImagePrompt(basePrompt, styleProfile)
    - visualStyle.imagePromptKeywords を prefix 注入
    - visualStyle.colorPalette を "dominant colors: {primary} with accents..."
    - visualStyle.lighting + mood + composition を指示
    - layout.personZone / productZone / mainCopyZone を negative space 指示
    ↓
[サーバー] Imagen 4 / FLUX で画像生成
    ↓
[フロント] Step3Editor のキャンバスに背景画像が表示される
    ↓
[フロント] 保存時、banner.styleProfileId を永続化
```

---

## 5. エラーハンドリング・フォールバック戦略

| シナリオ | 対応 |
|---|---|
| 参考画像サイズ上限（10MB/枚）超過 | フロント側で事前バリデーション、アップロード前にリジェクト |
| 参考画像の枚数が 2 未満 | 「最低 2 枚必要」エラー表示 |
| 参考画像の枚数が 7 超過 | 「最大 7 枚まで」エラー表示 |
| Vercel Blob アップロード失敗 | リトライ 3 回、全失敗で中止しユーザーへエラー通知 |
| Gemini Vision 抽出失敗（API エラー） | `src/lib/style-profile/defaults.ts` の最小 StyleProfile を返し、ユーザーに編集を促す |
| Gemini Vision 抽出結果が schema 違反 | 欠損フィールドを defaults で補完、成功扱い |
| StyleProfile 保存時に `name` 重複 | Unique 制約違反で 409、フロント側で別名を促す |
| 既存 Banner レコード（Phase A.6 前）の styleProfileId が null | UI で「プロファイル未使用」と表示、挙動は Phase A.5 と同じ |
| プロファイル DELETE 時に紐づく Banner あり | DELETE を拒否し、「このプロファイルで生成された N 件のバナーが存在します」エラー表示 |
| 画像生成時に styleProfileId が渡されない | Phase A.5 と同じ挙動（ANGLE_KEYWORDS + PROVIDER_PREFIX のみ） |

---

## 6. テスト戦略

### 手動受入テスト（Phase A.6 完了時）

小池さんが用意した参考バナー **5 枚**（5 Point Detox の公式既存バナー）を入力にして：
1. プロファイル作成: 抽出結果が妥当か目視評価
2. 編集 UI: 各フィールドを手動で修正できるか
3. 同じ LP で「プロファイル無し」vs「プロファイル有り」の A/B 比較生成
4. 参考バナーとの目視ブラインドテスト

**合格基準**：
- プロファイル有り群が参考比 **85% 以上**の品質
- 参考バナーと並べたブラインドで **50% 以上**が「どちらも人間が作った」と誤認
- 2 つ目のプロファイル作成時、1 つ目に影響なし（独立運用）

### 自動テスト
Phase A / A.5 と同様、スコープ外。

---

## 7. スコープ外（明示・再掲）

- プロファイルのバージョニング
- プロファイルのエクスポート/インポート
- プロファイル間の比較 UI
- 複数プロファイルの同時適用（ミックス）
- 参考画像の OCR
- 動的プロファイル自動切替
- AI によるプロファイル推薦
- プロファイルのマーケットプレイス化
- 参考画像を動画から抽出

---

## 8. 実装順序（7 日スプリント）

| Day | タスク | 主な変更ファイル |
|---|---|---|
| 1 | Prisma `StyleProfile` モデル追加 + migration。`Banner.styleProfileId` 追加。`src/lib/style-profile/schema.ts` の型定義作成 | `prisma/schema.prisma`、`src/lib/style-profile/schema.ts` |
| 2 | Vercel Blob SDK 導入、`blob-client.ts` 実装、`/api/style-profile/extract` 実装（Gemini Vision 抽出） | `package.json`、`src/lib/style-profile/blob-client.ts`、`src/lib/style-profile/extractor.ts`、`src/app/api/style-profile/extract/route.ts` |
| 3 | `/api/style-profile` CRUD 実装（POST list, GET, PUT, DELETE） | `src/app/api/style-profile/route.ts`、`src/app/api/style-profile/[id]/route.ts` |
| 4 | `ReferenceImageUploader` + `StyleProfileSelector` コンポーネント | `src/components/style/ReferenceImageUploader.tsx`、`src/components/steps/StyleProfileSelector.tsx` |
| 5 | `StyleProfileEditor` 全画面モーダル（6 要素の編集 UI） | `src/components/style/StyleProfileEditor.tsx` |
| 6 | `injector.ts` 実装（`generate-copy` / `generate-image` への合流ロジック）+ ルート側で `styleProfileId` 受取実装 | `src/lib/style-profile/injector.ts`、`src/app/api/generate-copy/route.ts`、`src/app/api/generate-image/route.ts`、`src/app/page.tsx`（handleSaveList 等） |
| 7 | Step3Editor 初期化時のプロファイル読込（priceBadge/cta/typography のデフォルト適用）+ 統合テスト + 参考 5 枚で実機評価 | `src/components/steps/Step3Editor.tsx`、`docs/baselines/2026-04-21-phase-a6/` |

---

## 9. Vercel Blob 有効化手順（A.6 着手時）

1. Vercel ダッシュボード → プロジェクト `banner-tsukurukun` → **Storage** タブ
2. 「Create Database」→「Blob」を選択
3. 名前: `banner-tsukurukun-blob` 等
4. 作成すると環境変数 `BLOB_READ_WRITE_TOKEN` が自動生成され、プロジェクトに紐づけられる
5. ローカル `.env` にも `BLOB_READ_WRITE_TOKEN=...` を追加（ダッシュボードでコピー可能）
6. `npm install @vercel/blob` をインストール

---

## 10. オープンクエスチョン

**なし**。ブレストで主要 3 軸（学習範囲・使い回しスコープ・画像保管）が決定済み、残りは標準値で合意済み。実装中に Gemini Vision の抽出精度が想定より低い場合、プロンプトチューニングで Day 2 内に調整する。

---

## 変更履歴

- 2026-04-21: 初稿（小池さんとのブレスト後作成、3 軸の主要決定＋標準値で設計まで到達）
