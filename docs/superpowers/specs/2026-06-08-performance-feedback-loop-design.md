# 配信成果フィードバックループ 設計書

- 日付: 2026-06-08
- 対象: banner-tsukurukun / autobanner.jp
- 関連: meta-ads-autopilot (Phase 2 batch-generate), autobanner KPI集計 GAS
- ステータス: 設計承認済み（実装計画へ）

## 背景・目的

競合 meteo-ai.jp が「配信後、広告効果を分析して次の自動生成バナーに活かす」自律運用を訴求している。
これは Meta Marketing API (Insights) の標準機能（ad/creative 単位の CTR/CPA/CVR 取得）で技術的に実現可能であり、
当社は既にループの部品（生成タグ／自動入稿骨格／Insights取得 GAS）をほぼ保有している。

本設計は、欠けている **「生成バナー ↔ Meta広告の紐付け」「成果データの格納」「タグ×成果の勝ち要因抽出」** の
3点を加算的に実装し、生成→配信→分析→再生成のループを閉じる。

## 確定した方針（ブレストでの判断）

1. バナー↔Meta広告の紐付け: **API自動入稿で自動紐付け**（meta-ads-autopilot が ad_id を記録）
2. タグの持ち方: **既存 JSON 拡張**（`Generation.briefSnapshot` を「タグ次元 v1」として集計時に展開。新規タグテーブルは作らない）
3. 成果データの粒度: **日次スナップショット**（クリエイティブ疲労検知・期間集計を可能にする）
4. 勝ちスコア定義: **CPA主・CTR従**（KPIがCPA/ROAS最適化のため。設定値で切替可能）

## アーキテクチャ（ループ全体）

```
[batch-generate] 生成（タグ = briefSnapshot JSON）
   → GenerationImage
   → [自動入稿] meta-ads-autopilot が Marketing API で入稿 → ad_id 記録 (MetaAd)
   → [日次Cron] Insights API → AdPerformanceSnapshot（ad × statDate で upsert）
   → [勝ち要因抽出ジョブ] briefSnapshot のタグ × 成果 を集計 → WinningPattern
   → [プロンプト注入] 次の batch-generate が勝ちタグを重み付けして生成
   ↻ ループ
```

タグは新規に持たない。`Generation.briefSnapshot` に既存の
`angleId / ctaTemplateId / priceBadge / urgency / emphasisRatio / size / provider` を
「タグ次元 v1」として集計時に展開する。

### タグ次元 v1（集計対象）

| dimension | 取得元 | 値の例 |
|---|---|---|
| angleId | briefSnapshot / Banner.angleId | benefit / fear / sensory ... |
| ctaTemplateId | briefSnapshot / Banner.ctaTemplateId | テンプレID |
| urgency | briefSnapshot / Banner.urgency | low / high |
| emphasisRatio | briefSnapshot / Banner.emphasisRatio | 2x / 3x |
| priceBadge | briefSnapshot / Banner.priceBadge | 有無・型 |
| size | GenerationImage.size | 1080x1080 等 |
| provider | GenerationImage.provider | gpt-image / flux / imagen4 |

join 経路: `AdPerformanceSnapshot → MetaAd → GenerationImage → Generation.briefSnapshot`

## スキーマ変更（加算のみ・破壊なし・3テーブル + 逆リレーション1行）

```prisma
/// 入稿された Meta 広告 ↔ 生成画像 の紐付け（1画像 → N広告を許容）
model MetaAd {
  id                String   @id @default(cuid())
  adId              String   @unique           // Meta Ad ID（自動入稿時に記録）
  adSetId           String?
  campaignId        String?
  adName            String?
  status            String?                     // active/paused 等
  generationImageId String?                     // どの生成画像由来か
  generationImage   GenerationImage? @relation(fields: [generationImageId], references: [id], onDelete: SetNull)
  publishedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  snapshots         AdPerformanceSnapshot[]
  @@index([generationImageId])
  @@index([status])
}

/// 日次成果スナップショット（疲労検知・期間集計が可能）
model AdPerformanceSnapshot {
  id          String   @id @default(cuid())
  metaAdId    String
  metaAd      MetaAd   @relation(fields: [metaAdId], references: [id], onDelete: Cascade)
  statDate    DateTime @db.Date              // 成果の対象日
  impressions Int      @default(0)
  clicks      Int      @default(0)
  spend       Decimal  @default(0) @db.Decimal(12,2)
  conversions Int      @default(0)
  ctr         Decimal? @db.Decimal(8,4)
  cpa         Decimal? @db.Decimal(12,2)
  cpm         Decimal? @db.Decimal(12,2)
  frequency   Decimal? @db.Decimal(8,2)
  roas        Decimal? @db.Decimal(8,2)
  raw         Json?                            // Insights 生レスポンス1行（監査用）
  createdAt   DateTime @default(now())
  @@unique([metaAdId, statDate])              // 日次 upsert の冪等キー
  @@index([statDate])
}

/// 勝ち要因の集計結果（学習信号・監査ログ兼用）
model WinningPattern {
  id           String   @id @default(cuid())
  dimension    String                          // 'angleId' | 'ctaTemplateId' | 'urgency' ...
  value        String                          // 'benefit' | 'limited' ...
  windowStart  DateTime @db.Date               // 集計期間
  windowEnd    DateTime @db.Date
  adCount      Int                             // 採用広告数（閾値ガード用）
  impressions  Int
  conversions  Int
  avgCtr       Decimal? @db.Decimal(8,4)
  avgCpa       Decimal? @db.Decimal(12,2)
  score        Decimal  @db.Decimal(8,4)       // 正規化した勝ちスコア
  computedAt   DateTime @default(now())
  @@index([dimension, value, windowEnd])
}
```

`GenerationImage` には逆リレーション `metaAds MetaAd[]` を1行追加するのみ。

## コンポーネント（4つ・各独立してテスト可能）

| # | 役割 | 置き場所 | 入力 → 出力 |
|---|---|---|---|
| C1 | 入稿時 ad_id 記録 | meta-ads-autopilot | 入稿APIレスポンス → MetaAd insert |
| C2 | 日次 Insights 取得 | Vercel Cron | ad単位 Insights → AdPerformanceSnapshot upsert |
| C3 | 勝ち要因抽出 | Cron（C2後） | briefSnapshot タグ × 成果 → WinningPattern upsert |
| C4 | プロンプト注入 | batch-generate | 直近 WinningPattern → 生成プロンプトに重み付け |

### C3 勝ちスコア定義（CPA主・CTR従）

- 集計単位: (dimension, value) ごとに期間内の `impressions / conversions / spend` を合算
- 一次指標: CPA = spend / conversions（低いほど良い → スコア高）
- 二次指標: CTR = clicks / impressions（CPA同等時のタイブレーク）
- 正規化: 同一 dimension 内で min-max 正規化し 0〜1 の score を付与
- 設定で CTR主・ROAS主へ切替可能（scoreFormula を環境変数 or 設定で選択）

## エラー処理・ガード（vibe-coding 6条対応）

- **統計的妥当性（誤学習防止）**: C3 は `adCount` および `impressions/conversions` が閾値未満の
  (dimension, value) を WinningPattern に**採用しない**。閾値は設定値（初期値: adCount>=3, conversions>=10 を仮）。
- **Standard Access 無し / Rate Limit**: C2 はスキップ + ログ。ループは止めない。
- **ad_id 欠落**: MetaAd を作らず nullable で許容。後から手動補完可能。
- **景表法・薬機法**: 自動入稿でも「確認・承認」ゲート or NG語サーバー検証を**必ず通す**
  （優良誤認・有利誤認・デトックス商材配慮）。
- **コスト**: C2 の Insights 取得は ad数 × 日数で課金影響小。
  C4 起点の自動生成は **1サイクル生成上限 + 日次予算ガード必須**（既存 batch-generate の 20本/回上限を踏襲）。

## データ不可逆性の根拠（なぜこの構造か）

- 紐付けを `MetaAd` 独立テーブル + 1画像→N広告 にした理由: A/Bや複数アドセットで
  同一クリエイティブが複数広告になるケースが現実にある。後から 1:1 → 1:N へ直すのは
  データ移行が重いため、最初から 1:N で確定。
- 成果を日次スナップショットにした理由: 最新値上書きだと疲労（CTR 低下・frequency 上昇）の
  時系列が失われ、後から復元不能。`@@unique([metaAdId, statDate])` で冪等 upsert。
- タグを JSON 据え置きにした理由: 既存 briefSnapshot を単一情報源にし、タグ体系の二重管理を避ける。
  集計は読み取り時展開。将来タグが安定したら主要次元のみ正規化カラムへ昇格できる（後方互換）。

## テスト方針

- C2: fixtures の Insights レスポンス → snapshot upsert（冪等性: 同日2回 upsert で重複なし）
- C3: 既知タグ分布 → 期待 weighted score / 閾値未満が除外されること
- C4: WinningPattern → プロンプト文字列に勝ちタグが反映されること

## スコープ外（YAGNI）

- タグ正規化テーブル（将来、次元が安定してから昇格）
- 手動入稿マッピング（今回は API 自動入稿に限定）
- 動画クリエイティブの成果フィードバック（まず静止画で確立）
```
