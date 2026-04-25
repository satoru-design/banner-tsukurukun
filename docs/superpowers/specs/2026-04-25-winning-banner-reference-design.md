# Phase A.8: 勝ちバナー参照機能 設計書

**作成日:** 2026-04-25
**ステータス:** ブレインストーミング完了 / 実装プラン作成前
**前提:** Phase A.7 / A7-Ironclad（素材保持モード）本番動作確認済み
**配置場所:** `docs/superpowers/specs/2026-04-25-winning-banner-reference-design.md`

---

## 1. 背景・目的

過去にCV/CTRが高かったバナー（勝ちバナー）をユーザーがアップロードできるようにし、その視覚的・コピー的特徴を Vision AI で抽出。次回のサジェスト生成（`/api/ironclad-suggest`）プロンプトに「勝ちパターン傾向」として注入することで、勝ちパターンに沿ったコピー/デザイン提案を引き出す。

**配置場所:** `IroncladBriefForm.tsx` の「LP URL から自動抽出（任意）」セクション**直下**に新セクション「🏆 勝ちバナー参照（任意）」を追加。

---

## 2. 設計判断の根本原則

### 2.1 漏洩リスク 0.1% 以下要件
ユーザー判断により、**勝ちバナー画像内の具体的なテキスト・ロゴ・商品が、生成バナーに「漏れ込む」リスクを 0.1% 以下に抑えること**が必須要件。

### 2.2 上記要件を満たす3原則
1. **画像は生成パイプライン（gpt-image-2）に渡さない** — 既存3スロット（商品画像/バッジ1/バッジ2）には一切手を入れず、勝ちバナーは別経路で扱う
2. **抽象テキストだけ** が `/api/ironclad-suggest` プロンプトに流れる — 具体文字列は構造上注入経路に存在しない
3. **DB二層保存** — `analysisAbstract`（プロンプト注入用）と `analysisConcrete`（将来分析用）を分離

### 2.3 SaaS化を見据えた設計原則
今は単一テナント（自分専用）だが、将来 SaaS 化時に**勝ちバナー機能のUI/ロジックは1行も書き直さずに済む**よう、データモデルとAPI層に最小限の抽象化を仕込む。

---

## 3. 機能要件

### 3.1 ユーザーストーリー
> マーケターとして、過去に当たった勝ちバナーをアップロード（URL指定 or ファイル）したい。アップロードすると AI が要素を解析し、次回のサジェスト生成時に「勝ちパターン傾向」として参考にしてくれる。生成バナー画像に勝ちバナー内の具体的なテキストやロゴが漏れることは絶対にあってはならない。

### 3.2 機能スコープ（Phase 1）
- 勝ちバナーの登録（URL or ファイル）
- アップロード時の Vision 解析（1回のみ）
- ライブラリ表示（サムネ + 抽象タグ + 削除）
- 「直近3枚」を自動で suggest プロンプトに集約注入
- 「☑ 勝ちパターンを参考にする」チェックボックス（デフォルトON）

### 3.3 スコープ外（Phase 2 以降）
- 業種タグ・タグ別フィルタリング
- 集計ダッシュボード（勝ちパターン分析レポート）
- Google Drive 連携
- マルチテナント認証・課金

---

## 4. UI 設計

### 4.1 IroncladBriefForm のセクション構成（変更後）

| 順 | セクション | 状態 |
|---|---|---|
| 1 | STEP 1. ブリーフ入力（ヘッダ） | 既存 |
| 2 | LP URL から自動抽出（任意） | 既存・変更なし |
| **3** | **🏆 勝ちバナー参照（任意）** | **新規** |
| 4 | パターン | 既存・変更なし |
| 5 | 商材 | 既存・変更なし |
| 6 | ターゲット | 既存・変更なし |
| 7 | 目的・コンセプト | 既存・変更なし |
| 8 | サイズ | 既存・変更なし |
| 9 | 🧴 商品画像 | 既存・変更なし |
| 10 | 🏅 認証バッジ 1 | 既存・変更なし |
| 11 | 🏆 認証バッジ 2 | 既存・変更なし |

### 4.2 新セクション「勝ちバナー参照」の構成

```
┌──────────────────────────────────────────────────────┐
│ 🏆 勝ちバナー参照（任意）                                  │
│                                                       │
│ 過去にCV/CTRが高かったバナーを登録すると、次回サジェスト    │
│ 生成時に勝ちパターン傾向を参考にします。                    │
│ ⚠ 生成画像には合成されません（解析専用）。                  │
│                                                       │
│ ☑ 今回の生成で勝ちパターンを参考にする  [デフォルトON]      │
│                                                       │
│ [ライブラリ - 横スクロール可能]                            │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐  ┌─────────┐          │
│ │ 🗑  │ │ 🗑  │ │ 🗑  │ │ 🗑  │  │ + 新規追加 │          │
│ │画像1│ │画像2│ │画像3│ │画像4│  └─────────┘          │
│ │⭐参考│ │⭐参考│ │⭐参考│ │     │                       │
│ │中   │ │中   │ │中   │ │     │                       │
│ │タグ1│ │タグ1│ │タグ1│ │タグ1│                        │
│ │タグ2│ │タグ2│ │タグ2│ │タグ2│                        │
│ └────┘ └────┘ └────┘ └────┘                          │
│                                                       │
│ [30枚超えた時のみ警告表示]                                │
│ ⚠ 30枚を超えています。古いものを削除推奨。                 │
└──────────────────────────────────────────────────────┘
```

**直近3枚の表示ルール:**
- `createdAt` 降順で先頭3件に「⭐参考中」バッジ（右下）
- 4枚目以降は登録されているがプロンプトに注入されない
- ユーザーが3枚を選択する操作は不要（自動）

### 4.3 「+ 新規追加」モーダル仕様

タブ切替式モーダル：

```
┌────────────────────────────────────────┐
│ 勝ちバナーを追加                          │
│ ─────────────────────                  │
│ [URLで追加] [ファイル選択]                  │  ← タブ切替
│ ─────────────────────                  │
│                                         │
│ [URLで追加 タブ選択時]                     │
│ URL: [_________________________]        │
│                                         │
│ [ファイル選択 タブ選択時]                   │
│ [📎 ファイルを選択]                        │
│ または ここにドラッグ&ドロップ                │
│                                         │
│ ─────────────────────                  │
│              [キャンセル]  [登録]          │
└────────────────────────────────────────┘
```

- 登録ボタン押下後、モーダル内で「アップロード中→解析中」のステップ表示
- 完了したらモーダル閉じる + ライブラリ更新
- エラー時はモーダル内で赤帯表示

### 4.4 解析結果の可視化

サムネ下に**抽象タグを2〜3個**表示。例：
- `ベネフィット型` `黄黒系` `ゴシック太字`
- `権威訴求` `白赤系` `明朝信頼感`

サムネクリックで詳細パネル展開は **Phase 1 では実装しない**（Phase 2 で追加余地）。

---

## 5. データモデル

### 5.1 Prisma Schema 変更（既存 `Asset` モデルを拡張）

```prisma
model Asset {
  // === 既存フィールド（変更なし） ===
  id          String   @id @default(cuid())
  type        String   // 'product' | 'badge' | 'logo' | 'other' | 'winning_banner' (NEW)
  name        String
  blobUrl     String
  mimeType    String?
  isPinned    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // === 追加フィールド（全てNULL許容） ===
  /// SaaS化見据え。Phase 1 は全 NULL で運用。
  userId            String?
  /// 勝ちバナー解析結果：プロンプト注入用の抽象タグ
  /// JSON: { palette: string, copyAngle: string, cta: string, layout: string, typo: string, mood: string, pattern: string, abstractTags: string[] }
  analysisAbstract  Json?
  /// 勝ちバナー解析結果：分析・デバッグ用の生抽出データ
  /// JSON: { paletteHex: string[], extractedTexts: string[], detectedElements: string[], rawObservations: string }
  analysisConcrete  Json?
  /// 解析プロンプトのバージョン管理（将来プロンプト改善時の互換性用）
  analysisVersion   Int?

  @@index([type])
  @@index([createdAt])
  @@index([userId])  // 追加
}
```

**変更点まとめ:**
- 新規 `type` 値: `'winning_banner'`
- 追加カラム4本（全て NULL 許容、既存データに影響なし）
- 追加インデックス1本（`userId`）

**migration名:** `add_winning_banner_fields_to_asset`

### 5.2 解析結果 JSON 構造

#### `analysisAbstract`（プロンプト注入用）
```typescript
{
  palette: string;         // "黄+黒高コントラスト系"
  copyAngle: string;       // "ベネフィット型・具体数値訴求"
  cta: string;             // "行動促進型・短文"
  layout: string;          // "商品オフセンター + テキスト右寄せ"
  typo: string;            // "ゴシック太字・パワー系"
  mood: string;            // "明るい・健康的・爽快"
  pattern: string;         // 既存IRONCLAD_PATTERNS分類: "benefit"
  abstractTags: string[];  // UI表示用: ["ベネフィット型", "黄黒系", "ゴシック太字"]
}
```

#### `analysisConcrete`（将来分析用、プロンプトには絶対に流さない）
**漏洩防止ルール:** このフィールドの内容は、`/api/ironclad-suggest` を含む**いかなる外部 LLM API 呼び出しのプロンプトにも含めてはならない**。Phase 1 時点ではDB保存のみ・UI非表示。Phase 2 で集計ダッシュボードを作る場合も、サーバー内集計→集計結果のみUI表示とし、生データは外部に出さない。

```typescript
{
  paletteHex: string[];           // ["#FFD700", "#000000"]
  extractedTexts: string[];       // ["2kg減", "16日間集中", "今すぐ始める"]
  detectedElements: string[];     // ["商品パッケージ", "認証バッジ", "人物モデル"]
  rawObservations: string;        // Geminiの生観察テキスト全文
}
```

---

## 6. API 設計

### 6.1 新規エンドポイント

#### `POST /api/winning-banners`
**役割:** 勝ちバナー登録（URL指定 or ファイルアップロード）+ Vision解析

**入力（リクエスト形式は2パターン）:**

ファイルアップロード時（`Content-Type: multipart/form-data`）:
```
file: File         # 必須
name?: string      # 任意、未指定時はファイル名から生成
```

URL指定時（`Content-Type: application/json`）:
```json
{ "url": "https://...", "name": "任意の表示名" }
```

サーバー側は `Content-Type` ヘッダで分岐。両形式とも同じレスポンスを返す。

**処理フロー:**
1. URL指定の場合、サーバー側で fetch → Buffer 化
2. Vercel Blob (Public) に保存（パス: `winning-banners/{cuid}.{ext}`）
3. Gemini 2.5 Pro Vision で解析 → `analysisAbstract` + `analysisConcrete` 生成
4. Prisma で Asset 作成（type='winning_banner'）
5. レスポンス：作成された Asset 全フィールド

**maxDuration:** 60（Vision解析が15-30秒程度想定）

#### `GET /api/winning-banners`
**役割:** ライブラリ一覧取得

**クエリ:** なし（type='winning_banner' で絞り込み、createdAt降順）

**レスポンス:**
```typescript
{ banners: Asset[] }
```

#### `DELETE /api/winning-banners/[id]`
**役割:** 削除

**処理:**
1. Asset を `type='winning_banner'` 確認
2. Vercel Blob からファイル削除（best-effort）
3. Prisma で Asset 削除

### 6.2 既存エンドポイント変更

#### `POST /api/ironclad-suggest`（変更）

**入力に追加:**
```typescript
{
  // 既存フィールドそのまま
  brief: IroncladBrief;
  // 追加
  useWinningRef?: boolean;  // API側デフォルト false（後方互換性のため未指定なら既存挙動）
}
```

**UI側との整合:** UI のチェックボックスは「デフォルトON」だが、これはあくまで**ユーザーへの推奨初期値**。クライアントは必ず明示的に `useWinningRef: true | false` を送信する。API はリクエストに含まれないフィールドを `false` 扱い（既存クライアント・古いキャッシュ等への安全側デフォルト）。

**処理変更:**
1. `useWinningRef === true` かつ `process.env.WINNING_BANNER_ENABLED !== 'false'` の場合のみ実行
2. DB から `type='winning_banner'` を `createdAt` 降順で最大3件取得
3. 各 Asset の `analysisAbstract` を集約して「勝ちパターン傾向」テキスト生成（`prompt-injection.ts` 経由）
4. 既存の suggest プロンプトに**追加セクション**として注入（既存プロンプトは1文字も変更しない）
5. それ以外（`useWinningRef === false` または該当データなし）は**完全に既存挙動と同一**

---

## 7. Vision 解析仕様

### 7.1 使用モデル
- **Gemini 2.5 Pro Vision**（既存 `/api/analyze-lp` と同じモデル）
- 環境変数: `GEMINI_API_KEY` または `GOOGLE_AI_STUDIO_API_KEY`（既存）

### 7.2 解析プロンプト（`src/lib/winning-banner/analyze.ts`）

```
あなたは広告クリエイティブ分析の専門家です。添付された広告バナー画像を解析し、
以下のJSON形式で出力してください。

【重要な原則】
- 「abstract」フィールドには、業種・商材を問わず転用可能な抽象的特徴のみを記述
- 具体的な商品名・ブランド名・コピー文言・ロゴテキストは「abstract」に含めないこと
- 「concrete」フィールドには分析・デバッグ用に具体情報を記録（こちらには具体名OK）

【出力JSON】
{
  "abstract": {
    "palette": "...",       // 例: "黄+黒高コントラスト系"
    "copyAngle": "...",     // 例: "ベネフィット型・具体数値訴求"
    "cta": "...",           // 例: "行動促進型・短文"
    "layout": "...",        // 例: "商品オフセンター + テキスト右寄せ"
    "typo": "...",          // 例: "ゴシック太字・パワー系"
    "mood": "...",          // 例: "明るい・健康的・爽快"
    "pattern": "benefit",   // benefit | fear | authority | story | sensory | comparison | curiosity | aspirational のいずれか
    "abstractTags": ["...", "...", "..."]  // UI表示用、3個まで
  },
  "concrete": {
    "paletteHex": ["#...", "#..."],
    "extractedTexts": ["...", "..."],
    "detectedElements": ["...", "..."],
    "rawObservations": "..."
  }
}
```

**responseSchema** で構造化出力を強制（Gemini API のスキーマ機能を使用、メモリの「prisma_schema 違反防止」教訓を反映）。

### 7.3 タイムアウト・エラー処理
- Vision API タイムアウト: 30秒
- 失敗時はアップロード自体を失敗扱い（Blob 保存もロールバック）
- ユーザーには「解析に失敗しました。画像を確認して再度お試しください」表示

---

## 8. プロンプト注入仕様（`src/lib/winning-banner/prompt-injection.ts`）

### 8.1 集約ロジック
直近3件の `analysisAbstract` から、各フィールドの**最頻値 or 列挙**を生成：
- `palette`: 列挙（例: "高コントラスト系（黄+黒）優位"）
- `copyAngle`: 最頻パターン
- `cta`: 列挙
- `pattern`: 出現頻度順
- 等

### 8.2 注入テキストフォーマット

```
[過去の勝ちパターン傾向（直近3件集約）]
配色: {palette}
コピー切り口: {copyAngle}
CTA: {cta}
レイアウト: {layout}
タイポ: {typo}
ムード: {mood}
訴求パターン: {pattern}

⚠ 重要な解釈指示:
上記傾向は過去の勝ちバナーから抽出されたもので、業種・商材が今回のブリーフと
異なる場合があります。**ブリーフで指定された商材性質・ターゲットを最優先**し、
過去傾向は「視覚スタイル・コピー切り口の方向性のヒント」として柔軟に解釈してください。
一致しない要素は無視して構いません。
```

この保険文言により、業種をまたぐ場合でも Gemini が「ブリーフ優先・傾向は参考程度」と判断できる。

### 8.3 既存プロンプトとの結合
注入位置: 既存の suggest プロンプトの末尾、ブリーフ情報の後・指示文の前に挿入。

---

## 9. 環境変数

### 新規追加
```
# 勝ちバナー機能のON/OFF（false にすると UI セクション非表示・API も無効化）
WINNING_BANNER_ENABLED=true
```

`.env.example` に上記を追加し、デフォルト値の意図をコメントで明記。

---

## 10. 3段階ロールバック機構

| レベル | 操作 | 所要時間 | 効果 |
|---|---|---|---|
| **L1** | UIで「☑ 勝ちパターンを参考にする」OFF | 即座 | プロンプト注入なし。既存と完全同一の挙動 |
| **L2** | `WINNING_BANNER_ENABLED=false` → 再デプロイ | 1-2分 | UIセクション・API両方が無効化 |
| **L3** | Git revert | 数分 | コード自体を巻き戻し、Phase A.7 状態へ |

### ロールバック安全性の保証条件（実装時に厳守）
1. 既存3スロットのロジックは1行も触らない
2. `useWinningRef === false` または該当データなしの場合、`/api/ironclad-suggest` のプロンプトは**文字レベルで既存と同一**
3. DBスキーマ変更は追加のみ（既存カラム変更ゼロ）
4. 着手前に `git tag phase-a7-stable` を切る

---

## 11. SaaS 化への準備（Phase 1 で仕込む最小実装）

### 11.1 データモデル
- `Asset.userId String?` カラム追加（Phase 1 は全 NULL）
- `@@index([userId])` 追加

### 11.2 API 層の抽象化
`src/lib/auth/get-current-user.ts` を新規作成：
```typescript
// Phase 1: 固定値返却スタブ
// Phase 2 (SaaS化時): NextAuth/Clerk等から実ユーザー取得に差し替え
export async function getCurrentUser(): Promise<{ userId: string | null }> {
  return { userId: null };  // Phase 1
}
```

全 `/api/winning-banners/*` ルートで `getCurrentUser()` を呼び、`userId` を Asset 作成・取得時に使う準備をしておく（Phase 1 では NULL なので動作影響なし）。

### 11.3 Vercel Blob パス命名
`winning-banners/{cuid}.{ext}` で統一（Phase 2 で `/{userId}/winning-banners/...` へ移行する時、prefix 追加だけで済む）。

---

## 12. 新規/変更ファイル一覧

### 新規作成
| パス | 役割 |
|---|---|
| `src/components/ironclad/WinningBannerLibrary.tsx` | ライブラリ表示UI |
| `src/components/ironclad/WinningBannerAddModal.tsx` | 追加モーダル（URL/ファイル切替） |
| `src/app/api/winning-banners/route.ts` | POST/GET エンドポイント |
| `src/app/api/winning-banners/[id]/route.ts` | DELETE エンドポイント |
| `src/lib/winning-banner/analyze.ts` | Gemini Vision 解析ロジック |
| `src/lib/winning-banner/prompt-injection.ts` | suggest プロンプト集約注入 |
| `src/lib/auth/get-current-user.ts` | SaaS化備えた認証スタブ |
| `prisma/migrations/{timestamp}_add_winning_banner_fields_to_asset/migration.sql` | Prisma migration |

### 変更
| パス | 変更内容 |
|---|---|
| `prisma/schema.prisma` | `Asset` モデルに4カラム追加・1インデックス追加 |
| `src/components/ironclad/IroncladBriefForm.tsx` | 「LP URL」セクション直下に新セクション追加（既存ロジック温存） |
| `src/app/api/ironclad-suggest/route.ts` | `useWinningRef` フラグ追加・条件分岐で prompt-injection 呼び出し（既存プロンプトは無変更） |
| `.env.example` | `WINNING_BANNER_ENABLED` 追加 |
| `src/lib/prompts/ironclad-banner.ts` | （必要なら）`IroncladBrief` 型に `useWinningRef?: boolean` 追加 |

---

## 13. テスト戦略

### 13.1 手動E2Eテスト（必須）
1. 勝ちバナー1枚 URL 登録 → 解析タグ表示確認
2. 勝ちバナー1枚 ファイルアップロード → 解析タグ表示確認
3. 勝ちバナー4枚登録 → 「⭐参考中」が直近3枚のみに付くか
4. 「☑ 参考にする」OFF状態で suggest 実行 → 既存挙動と同一か（プロンプトログ比較）
5. 「☑ 参考にする」ON状態で suggest 実行 → プロンプトに「過去の勝ちパターン傾向」が注入されているか
6. `WINNING_BANNER_ENABLED=false` でデプロイ → UIセクション非表示確認
7. **業種違いのテスト**: 健康食品の勝ちバナー登録 → 金融SaaSのブリーフで suggest 実行 → 「2kg減」等の具体文言が生成バナーや suggest 出力に漏れていないか確認

### 13.2 漏洩リスク検証（最重要）
- 勝ちバナーに含まれる具体テキスト（例: 商品名・キャッチコピー）が、**生成されたバナー画像 or サジェスト出力に1度でも現れたら設計欠陥**
- Phase 1 リリース後の最初の10回生成で必ず目視確認

---

## 14. 段階的リリース計画

| Step | 内容 | 完了基準 |
|---|---|---|
| 1 | `git tag phase-a7-stable` | タグ作成確認 |
| 2 | Prisma migration 実行（dev DB） | migration 成功 |
| 3 | 新規ファイル実装・既存ファイル変更 | TypeScript ビルド通過 |
| 4 | 自分用環境（Basic Auth環境）で手動E2Eテスト | §13.1 全項目PASS |
| 5 | 漏洩リスク検証 10回 | §13.2 PASS |
| 6 | 本番デプロイ（`WINNING_BANNER_ENABLED=true`） | 本番動作確認 |
| 7 | プロジェクトメモリ更新（Phase A.8 完了記録） | memory ファイル更新 |

---

## 15. 残リスク・注意点

| リスク | 影響 | 緩和策 |
|---|---|---|
| Vision 解析の抽象化品質が低い | プロンプト注入が機能しない | Step 5 で 10件検証、品質低ければプロンプト改善 |
| Gemini が稀にスキーマ違反のJSON返す | 解析失敗・例外発生 | `responseSchema` で構造化出力強制 + リトライ1回 |
| 業種違いの勝ちバナーで品質劣化 | サジェスト精度低下 | 保険文言（§8.2）でブリーフ優先を明示。Phase 2 で業種タグ追加 |
| Vercel Blob 容量増 | コスト増（軽微） | 30枚警告UI で削除促進 |
| Vision API コスト | 1枚 $0.002〜0.005 | アップロード時のみ・1回限り。再解析なし |

---

## 16. 完了の定義

以下が全て満たされたら本機能を「完了」とみなす：
- §13.1 全項目 PASS
- §13.2 漏洩リスク検証 10件 PASS
- L1/L2/L3 ロールバック動作確認
- 本番URL（autobanner.jp）で正常動作
- プロジェクトメモリに Phase A.8 完了記録

---

## 付録 A: 設計判断の経緯（Q&A サマリ）

| Q | 採用案 | 理由 |
|---|---|---|
| Q1 生成への反映方式 | C+D ハイブリッド検討 → 後にA(解析パス)+保存ライブラリへ縮退 | 漏洩リスク0.1%以下要件のため画像直接参照を断念 |
| Q2 reference image 3枠制約 | 既存3スロット温存・勝ちバナーは別経路 | 同上 |
| Q3 役割分離方式 | （ペンディング → 後に「画像非渡し」で解決） | composite モードと style ref の意味的衝突回避 |
| Q4 複数バナー集約 | B 直近自動（N=3固定） | 「実運用で当たったクリエイティブをピンポイント」というユースケース |
| Q5 抽出構造 | A 二層保存（concrete + abstract） | プロンプト注入は抽象のみで漏洩ゼロ、具体は将来分析用 |
| Q6-1 追加UI | A タブ切替モーダル | 明示的・初見ユーザーが迷わない |
| Q6-2 解析結果表示 | B サムネ + 抽象タグ | 「どう解釈されたか」可視化で信頼性向上 |
| Q6-3 直近3枚決定 | A createdAt 降順 | ユーザーコメントから自動でOKと判断 |
| 補足確認 業種跨ぎ | 保険文言で対応 | 漏洩は構造的にゼロ、品質は文言で柔軟性確保 |
