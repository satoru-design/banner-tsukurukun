# AdLoop マルチテナント化 設計書

- 日付: 2026-06-08
- 対象: banner-tsukurukun（プロダクト: AdLoop）
- 前提: 配信成果フィードバックループ + AdLoop レポートがマージ済み
- ステータス: 設計承認済み（実装へ）

## 目的

AdLoop を複数の Meta 広告アカウント（5 Point Detox / ココロミル / autobanner 自社 等）で運用するため、
account 別にデータを完全分離する（収集・集計・勝ち要因・レポート送信）。
これにより各クライアントのチャンネルへ、各クライアントのデータだけが届く。

## 確定方針（ブレストでの判断）

1. 認証情報: **ハイブリッド** — Account テーブルに非機密メタデータ、Meta token / Slack webhook は env（slug 規約で導出）
2. アカウント数: 当面数社〜十数社（手動 seed で回る。OAuth/セルフサーブは不要）
3. バナー紐付け: **batch-generate に accountId を渡す** → Generation.accountId
4. **単一テナント env は廃止**しクリーンに account 別へ（未デプロイ＝移行コストゼロ）。autobanner 自社も1 Account として登録
5. Account 登録（seed）・env 登録は **Claude が代行**。小池は ID とトークンを提供するのみ

## データモデル

### Account（新設）
```prisma
model Account {
  id              String   @id @default(cuid())
  slug            String   @unique   // 'five-point-detox' | 'kokoromil' | 'autobanner'
  name            String             // 表示名 '5 Point Detox'
  metaAdAccountId String             // act_ なし数値ID（識別子=非機密）
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  metaAds         MetaAd[]
  winningPatterns WinningPattern[]
  generations     Generation[]
}
```

### accountId の付与（移行差で扱い分け）
| テーブル | accountId | 根拠 |
|---|---|---|
| MetaAd | **必須 FK**（onDelete Cascade） | 実データ無し→NOT NULL 安全 |
| WinningPattern | **必須 FK**（onDelete Cascade） | 実データ無し |
| Generation | **nullable FK**（onDelete SetNull） | 本番実データあり→既存生成は account 無し。batch-generate 経由のみ付与。backfill 不要 |
| AdPerformanceSnapshot | 列追加せず | account は MetaAd 経由（`where:{ metaAd:{ accountId } }`）。数社規模で十分 |

- `MetaAd.adId @unique` は維持（Meta Ad ID はアカウント横断で一意）
- WinningPattern の窓置換は `(accountId, windowStart, windowEnd)` 単位に変更。index も accountId を含める

## 認証情報リゾルバ

`src/lib/feedback-loop/accounts.ts`:
- `getActiveAccounts(): Promise<Account[]>` — DB から isActive=true を取得
- `envKeyBase(slug)` — slug を ENV キーへ: `'five-point-detox'` → `FIVE_POINT_DETOX`（`-`→`_`・大文字化）
- `getAccountMetaToken(slug): string` — `process.env.ACCOUNT_<BASE>_META_TOKEN`。未設定は `AccountConfigError` を投げる
- `getAccountWebhook(slug): string | null` — `process.env.ACCOUNT_<BASE>_SLACK_WEBHOOK ?? process.env.SLACK_WEBHOOK_URL_NEW_USER ?? null`

env 命名例（5 Point Detox, slug=five-point-detox）:
- `ACCOUNT_FIVE_POINT_DETOX_META_TOKEN`
- `ACCOUNT_FIVE_POINT_DETOX_SLACK_WEBHOOK`

## コンポーネントの account 対応

| # | 変更内容 |
|---|---|
| C1 meta-ad-link | request body に `accountId`（必須）追加 → MetaAd.accountId 記録（Account 存在チェック） |
| C2 ad-insights-daily | active Account をループ。各 account の token＋metaAdAccountId で `fetchAdInsightsForDate(account)` → upsertSnapshots。1 account の失敗は他を止めない（個別 try/catch + ログ） |
| C3 winning-pattern-weekly | active Account をループ。`aggregateWinningPatterns({ accountId, window, ... })` で account 別集計。窓置換は (accountId, window) 単位 |
| C4 batch-generate | request body に `accountId`（任意）追加 → Generation.accountId 記録。accountId 有 → その account の最新 WinningPattern を注入。account 無し（既存 SaaS 生成）→ 注入なし（従来動作） |
| C5 fatigue | `detectFatiguedAds(accountId)` で account 別 |
| AdLoop レポート | active Account をループ。各 account の勝ち要因＋スナップを **その account の webhook** へ送信（C3 後の週次・新 cron の月次とも） |

### 関数シグネチャ変更（account 引数の伝播）
- `fetchAdInsightsForDate(dateYmd)` → `fetchAdInsightsForDate(dateYmd, { metaAdAccountId, token })`
- `aggregateWinningPatterns({ window... })` → `aggregateWinningPatterns({ accountId, window... })`（snapshot を `metaAd.accountId=accountId` で絞り、WinningPattern に accountId を付与）
- `getLatestWinningHints()` / `getLatestWinningFull()` → 引数 `accountId` を取り、その account の最新窓のみ
- `detectFatiguedAds()` → `detectFatiguedAds(accountId)`（MetaAd を accountId で絞る）
- `getAdSnapshotRows(g, periods)` → `getAdSnapshotRows(accountId, g, periods)`（snapshot を accountId で絞る）

## アカウント登録（seed）

`scripts/seed-accounts.mjs`: slug で冪等 upsert。Claude が prod URL 指定で実行（migrate-prod と同じパターン＝本番直触りでなくコード経由）。
登録値（小池が提供）: slug / name / metaAdAccountId。token/webhook は env（vercel-set-env.mjs で Claude が登録）。

## マイグレーション

オフライン schema diff で生成（実DB非接続）、本番適用は `migrate-prod.mjs`。
- Account テーブル新設（CREATE TABLE）
- MetaAd / WinningPattern に accountId（NOT NULL + FK）。実データ無しで安全
- Generation に accountId（NULL許容 + FK）。本番データ保護・backfill 不要
- WinningPattern index を accountId 込みへ

⚠️ 注意: MetaAd/WinningPattern に NOT NULL カラムを足すマイグレーションは、既存行があると失敗する。
本機能デプロイ前にこれらに実データが無いこと（未デプロイ）を確認してから本番適用する。

## 単一テナント env の廃止

削除（account 別へ移行）:
- `META_INSIGHTS_ACCESS_TOKEN` → `ACCOUNT_<slug>_META_TOKEN`
- `META_AD_ACCOUNT_ID` → Account.metaAdAccountId
- `SLACK_WEBHOOK_URL_AD_REPORT` → `ACCOUNT_<slug>_SLACK_WEBHOOK`
- `FEEDBACK_MIN_AD_COUNT` / `FEEDBACK_MIN_CONVERSIONS` / `FEEDBACK_SCORE_FORMULA` / `FEEDBACK_CONVERSION_ACTION_TYPE` は**全 account 共通設定として存続**（account 別が必要になれば後で Account 列へ昇格）

## エラー処理・ガード（vibe 6条）
- 生 token/webhook は env のみ・DB/Git 厳禁。リゾルバ経由でのみ取得
- token を URL/ログ/エラーに出さない（既存 token-safe 実装踏襲）
- C2/C3/レポートの account ループは **1 account の失敗が他を止めない**（個別 try/catch + ログ）
- account の token/webhook 未設定 → その account のみ skip + ログ（全体は継続）
- AccountConfigError（token 欠落）は C2 で skip 扱い

## テスト方針
- 純ロジック（vitest TDD）:
  - `envKeyBase(slug)` の導出（`-`/大文字化）
  - account 別集計の分離（accountA と accountB の snapshot/tag が混ざらない）
  - レポートルーティング（account→webhook 解決・フォールバック）
- DB/POST/cron は tsc + 既存パターン準拠

## スコープ外（YAGNI）
- OAuth セルフサーブ接続（将来セルフサーブ化時）
- token の DB 暗号化保存（env 方式で当面十分）
- account 別の閾値/スコア式（共通設定で開始）
- 既存 Generation の account backfill（不要・nullable で運用）
