# banner-tsukurukun v2 設計書

- **作成日**: 2026-04-21
- **対象リポジトリ**: `satoru-design/banner-tsukurukun`
- **コードネーム**: AntigravityCreative v2
- **起点ブランチ**: `main`（10 commits 時点、Phase A1 で `_archive/` への退避を行う）

## 1. 目的と成果物

既存プロトタイプ `banner-tsukurukun`（Next.js 16 + Gemini Flash 画像生成）を、banavo.net に匹敵する**広告バナー量産兵器**にブラッシュアップする。核心は「画質改善 → 周辺機能追加」の順で、LP 1 本から 4 アングル × 3 サイズの広告バナーを 1 クリック量産できる状態にする。

### 完成後のユースケース

1. LP URL を貼り付け
2. AI が LP を解析し 4 アングル（Benefit / Fear / Authority / Empathy）のコピー+画像プロンプトを生成
3. 任意のアングルで画像モデル（Imagen 4 / FLUX 1.1 pro）を選択して背景画像生成
4. 3 サイズ（1080×1080 / 1200×628 / 1080×1920）に自動展開
5. 視線ヒートマップで可読性確認
6. ZIP 一括ダウンロード

**目標所要時間**: 5 分 / LP（現状は試行錯誤含め 30 分程度）

### 非ゴール

- 個別ユーザーアカウント・RBAC（小池さん 1 人 or 社内ごく少人数運用のため）
- 課金・プラン管理
- 自動テストスイート（個人利用ツールのため YAGNI、Phase 毎に手動受入のみ）
- モバイルアプリ

## 2. 現状監査サマリ（2026-04-21 時点）

### ✅ 動いているもの

| 領域 | 実装 | モデル |
|---|---|---|
| LP 解析 | Jina Reader (`r.jina.ai`) で HTML→テキスト → 構造化 JSON | `gemini-2.5-pro` |
| 4 アングル生成 | Benefit/Fear/Authority/Empathy 同時生成 | `gemini-3.1-pro-preview` |
| バナー画像解析 | 画像→構図・訴求・counter_strategy 抽出 | `gemini-2.5-pro` (vision) |
| 背景画像生成 | **← Phase A で置き換え対象** | `gemini-3.1-flash-image-preview` |
| 編集 UI | `react-rnd` でドラッグ移動/リサイズ、`html2canvas` 書き出し | — |
| 永続化 | Prisma + SQLite、`Banner` モデル | — |

### 🚨 現状の問題（Phase A で解決）

画像生成が `gemini-3.1-flash-image-preview`（速度・コスト優先の Flash モデル）で行われており、広告クリエイティブに必要な画質に達していない。

### 🟡 未実装

- 視線ヒートマップ予測（Phase D）
- テキスト可読性スコア（Phase C）
- 自動 1px フチ取り（Phase C）
- スマートリサイズ（サイズ定義はあるが再配置ロジックなし、Phase B）
- 競合カウンター「コピー」生成（解析 API はあるが `generate-copy` と非接続、Phase E）

### 🧹 クリーンアップ対象（Phase A1）

- 旧 `/api/analyze/route.ts`（`analyze-lp` に置き換え済み）
- ルート直下の `fix-*.js` / `patch-*.js` / `update*.js` / `scratch*.ts/js`（10 本以上、AI エディタ作業残骸）

## 3. アーキテクチャ概要

```
┌──────────────────────────────────────────────────────┐
│  Next.js 16 (App Router, RSC + Client Components)    │
│  ├─ src/app/page.tsx                                 │
│  │     → Step1Input / Step2Angles / Step3Editor に分割│
│  ├─ src/app/api/                                     │
│  │   ├─ analyze-lp       (Jina + Gemini 2.5 Pro)     │
│  │   ├─ generate-copy    (Gemini 3.1 Pro, 4 angles)  │
│  │   ├─ generate-image   (NEW: dual provider router) │
│  │   │     ├─ provider=imagen4 → Google AI Studio    │
│  │   │     └─ provider=flux    → Replicate           │
│  │   ├─ resize-banner    (NEW: Phase B)              │
│  │   ├─ score-readability(NEW: Phase C)              │
│  │   ├─ predict-saliency (NEW: Phase D)              │
│  │   └─ analyze-banner   (既存、Phase E で接続)       │
│  └─ src/lib/                                         │
│      ├─ image-providers/                             │
│      │   ├─ imagen4.ts  (Google Imagen 4 Ultra)      │
│      │   ├─ flux.ts     (Replicate FLUX 1.1 pro)     │
│      │   └─ types.ts    (共通インターフェース)          │
│      ├─ sharp-ops.ts    (1pxフチ, コントラスト計算)     │
│      └─ prompts/        (プロンプト集約)               │
│                                                      │
│  Prisma + Neon Postgres (履歴・比較データ)             │
│  middleware.ts: Vercel Basic Auth                    │
└──────────────────────────────────────────────────────┘
```

### 画像プロバイダの共通インターフェース

```typescript
// src/lib/image-providers/types.ts
export interface ImageProvider {
  id: 'imagen4' | 'flux';
  displayName: string;
  generate(params: {
    prompt: string;
    aspectRatio: '1:1' | '16:9' | '9:16';
    seed?: number;
    negativePrompt?: string;
  }): Promise<{ base64: string; providerMetadata: Record<string, unknown> }>;
}
```

両プロバイダが同一インターフェースを実装し、UI 側は `provider: 'imagen4' | 'flux'` を切り替えるだけ。プロンプトは同一。

## 4. フェーズ別スコープ

### Phase A: 画像モデル Dual 化 + 基盤整備（目標 3 日）

**ゴール**: LP → 4 アングル → 画像生成で、ユーザーが Imagen 4 / FLUX 1.1 pro を選択できる。画質が目視で banavo.net レベル。

| タスク | 内容 |
|---|---|
| A0 | ベースライン録画: 現状 Gemini Flash の出力を同一 LP で 3 本キャプチャ。Phase A 完了時の比較資料として保存 |
| A1 | `_archive/` ディレクトリ作成、`fix-*.js` / `patch-*.js` / `update*.js` / `scratch*.ts/js` / 旧 `/api/analyze/route.ts` を退避（削除しない） |
| A2 | `src/app/page.tsx`（777 行）を `Step1Input.tsx` / `Step2Angles.tsx` / `Step3Editor.tsx` に分割。**ロジック変更なし**、ファイル移動のみ |
| A3 | `src/lib/image-providers/` 新設。`imagen4.ts` と `flux.ts` を共通インターフェースで実装 |
| A4 | `src/app/api/generate-image/route.ts` を `provider` 引数で振り分ける薄いルーターに書き換え |
| A5 | Step3 編集画面に「画像モデル選択」トグル追加（Imagen 4 / FLUX 1.1 pro） |
| A6 | Prisma スキーマに `imageModel String?` カラム追加、履歴に記録 |
| A7 | SQLite → Neon Postgres 移行（`provider = "postgresql"`、既存データは seed スクリプトで移送） |
| A8 | `middleware.ts` に Vercel Basic Auth を実装、`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` を環境変数化 |
| A9 | Phase A 完了レビュー: 同一 LP・同一プロンプトで両モデルを 3 本ずつ出力して目視比較 |

### Phase B: スマートリサイズ（目標 2〜3 日）

**ゴール**: アングル確定後、1080×1080 / 1200×628 / 1080×1920 の 3 サイズに自動展開。

| タスク | 内容 |
|---|---|
| B1 | `/api/resize-banner` 新設。入力: 確定アングルデータ、出力: 3 サイズ分の背景画像 + 要素再配置座標 |
| B2 | 背景画像は同 `seed` + 異 `aspectRatio` で再生成を試みる（完全な構図維持は保証できないため、B4 で目視確認して人間が不採用判定できる UI を用意） |
| B3 | テキスト・要素の再配置は Gemini に「同コピー・同 CTA で 1080×1920 用にレイアウトして」と投げて座標 JSON 取得 |
| B4 | Step3 に「全サイズ書き出し」ボタン、ZIP ダウンロード機能 |
| B5 | DB に `parentBannerId String?` 追加、リサイズ元を参照 |

### Phase C: 1px フチ + 可読性スコア（目標 1〜2 日）

**ゴール**: 「文字が背景に埋もれる」問題をゼロにする。

| タスク | 内容 |
|---|---|
| C1 | `src/lib/sharp-ops.ts` に `applyBorder1px()` / `computeTextContrast()` 実装 |
| C2 | `/api/score-readability` 新設。入力: 画像 base64 + テキスト要素の座標・カラー、出力: WCAG コントラスト比 + 改善提案（`"stroke"` / `"backgroundPlate"`） |
| C3 | Step3 に「可読性スコア」表示ピル、クリックで自動補正適用 |
| C4 | 書き出し時に「1px フチ付与」チェックボックス |
| C5 | DB に `readabilityScore Float?` 追加 |

### Phase D: 視線ヒートマップ予測（目標 2〜3 日）

**ゴール**: 生成バナーに視線予測ヒートマップをオーバーレイ表示。

| タスク | 内容 |
|---|---|
| D1 | Replicate で saliency 予測モデル選定（候補: `mihaelayeah/deepgaze2e` 等）。2 候補で精度比較 |
| D2 | `/api/predict-saliency` 新設、base64 画像を受けて heatmap 画像（赤→黄→透明のカラーマップ PNG、元画像と同解像度）を base64 で返す |
| D3 | Step3 に「視線予測」トグル、ON でヒートマップを半透明オーバーレイ |
| D4 | 精度が不十分なら Google Vision API の saliency 検出も試す |
| D5 | DB に `heatmapUrl String?` 追加して履歴に保存 |

### Phase E: 競合カウンター統合（目標 1〜2 日）

**ゴール**: 既存の `analyze-banner` と `generate-copy` を繋げて、競合バナー画像から**逆張りコピー**を生成。

| タスク | 内容 |
|---|---|
| E1 | Step1 に「競合バナーをアップロード」入力タブ追加 |
| E2 | `generate-copy` に `counterContext` 引数追加、競合解析結果を受けて「この訴求を上回るアングル」を指示 |
| E3 | UI に「カウンターモード」のバッジ表示、生成された 4 アングルが競合のどの弱点を突いているかを可視化 |
| E4 | DB に `counterSourceId String?` 追加、カウンター対象を参照 |

## 5. データモデル変更

```prisma
// prisma/schema.prisma (Phase A 以降)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"          // Phase A7 で sqlite から移行
  url      = env("DATABASE_URL")
}

model Banner {
  id               String   @id @default(cuid())
  productName      String?
  lpUrl            String?
  target           String?
  mainCopy         String?
  subCopy          String?
  elements         String?  // JSON serialized drag & drop elements
  base64Image      String?
  angle            String?
  imageModel       String?  // Phase A: "imagen4" | "flux"
  parentBannerId   String?  // Phase B: リサイズ元の参照
  readabilityScore Float?   // Phase C
  heatmapUrl       String?  // Phase D
  counterSourceId  String?  // Phase E: カウンター対象
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

移行は Phase A7 で以下の手順：

1. Neon で Postgres インスタンス作成、接続 URL を Vercel 環境変数に登録
2. ローカルの `dev.db` から `prisma db pull` で既存データを JSON 出力
3. `prisma migrate deploy` で新スキーマ適用
4. `scripts/migrate-sqlite-to-postgres.ts` 書いて既存データを Neon に流し込み

## 6. エラーハンドリング・フォールバック戦略

| 失敗シナリオ | 対応 |
|---|---|
| 画像生成 API が 500 | 選択プロバイダが失敗したら自動で他方を試行。レスポンスに `fallback: true` を含めて UI に表示 |
| Jina Reader が LP 取得失敗 | cheerio でのフォールバックスクレイピング（既存 `/api/analyze/route.ts` のロジックを `src/lib/scrape-lp.ts` に移植） |
| Replicate タイムアウト | 30 秒でタイムアウト、Imagen 4 に自動フォールバック |
| Postgres 接続失敗 | 起動時にエラーで止める。サイレントに SQLite に戻すなどはしない |
| Saliency モデル失敗 | Phase D の機能は optional、失敗してもバナー生成フローは止めない。UI でバッジ表示 |

## 7. テスト戦略

自動テストは今回スコープ外。フェーズ毎に以下の手動受入：

- **Phase A**: 同一 LP 3 本で `imagen4 vs flux × 4 angle = 24 本` を目視評価、スプレッドシートに記録
- **Phase B**: 1 アングルを 3 サイズに展開、要素の構図崩れがないか目視確認
- **Phase C**: コントラスト比が WCAG AA 基準 4.5:1 を下回るケースで改善提案が出るか
- **Phase D**: 明らかに顔が中央にある画像で saliency がそこを検出するか
- **Phase E**: 競合バナー 1 枚と無し状態での生成コピーに差が出るか

## 8. 運用・デプロイ

- **ホスティング**: Vercel（Phase A までに本番デプロイ）
- **DB**: Neon Postgres（無料枠 5GB）
- **認証**: `middleware.ts` で Basic Auth、共通パスワード 1 本
- **環境変数**:
  - `GEMINI_API_KEY`
  - `REPLICATE_API_TOKEN`
  - `GOOGLE_AI_STUDIO_API_KEY`（Imagen 4 用、Gemini と別契約枠の場合）
  - `ANTHROPIC_API_KEY`（将来の拡張用、現時点未使用）
  - `DATABASE_URL`（Neon Postgres）
  - `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`
- **Git ワークフロー**: フェーズ毎にブランチ（`feature/phase-a-image-dual` → PR → `main`）、Phase 終わりに `superpowers:requesting-code-review` でレビュー

## 9. スコープ外（明示）

- 多言語対応（日本語 UI のみ）
- クライアント向け SaaS 化（課金・RBAC）
- 動画バナー生成
- A/B テスト配信機能（バナー生成までがスコープ、配信は別ツール）
- 自動テストスイート

## 10. オープンクエスチョン

**なし**。Phase D の saliency モデルは候補を複数試す前提で設計済み、精度が悪ければ Google Vision にフォールバック。その他は全て決着済み。

---

## 変更履歴

- 2026-04-21: 初稿（小池さんとのブレスト後作成）
