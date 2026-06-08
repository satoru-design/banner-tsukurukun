# AdLoop 週次/月次 Slack レポート 設計書

- 日付: 2026-06-08
- 対象: banner-tsukurukun（プロダクト名: **AdLoop**）
- 前提: 配信成果フィードバックループ（2026-06-08-performance-feedback-loop）がマージ済み
- ステータス: 設計承認済み（実装へ）

## プロダクト名

この自律型広告クリエイティブ運用ループの製品名を **AdLoop** に確定。
「生成→配信→分析→改善のループを回し続ける」= meteo（流星＝単発）へのコンセプト対比。
Slack レポートのタイトルにも `AdLoop` を冠する。

## 背景・目的

フィードバックループは「学習して黙って次回に活かす」だけで人間向けレポートが無かった。
本機能は週次/月次で Slack に可視化し、図の「確認・承認」ゲートを意味あるものにする。

## 確定方針（ブレストでの判断）

1. Slack 送信先: **専用 webhook を新設**（`SLACK_WEBHOOK_URL_AD_REPORT`、未設定時は `SLACK_WEBHOOK_URL_NEW_USER` にフォールバック）
2. 「次回への示唆」: **ルールベーステンプレ**（API コストなし・決定的・テスト可能）
3. 分析指標: 各勝ち要因に **CPA / CPC / CTR** ＋ 広告本数・CV件数を併記
4. スナップショットのデータ元: **banner 側の広告実績で自完結**（AdPerformanceSnapshot）。
   売上・AOV・ROAS・ファネルCVR は banner にデータが無いため**出さない**。

## レポート構成（週次 = 2部構成）

### パート1: 勝ち要因レポート
```
🏆 AdLoop 勝ちクリエイティブ分析（6/1〜6/7）
score≥0.5 のみ（= 実際に次回生成へ反映される要因）
 ・訴求軸: ベネフィット型（CPA ¥480 / CPC ¥38 / CTR 2.9% ・広告5本・CV62件）
 ・緊急性: 高（CPA ¥520 / CPC ¥45 / CTR 2.4% ・広告4本・CV41件）

⚠️ 疲労で要差し替え（2件）
 ・夏キャンペーンA（CTRピーク比 -38%）
 ・送料無料訴求B（frequency 2.8）

💡 次回への示唆
 次回の自動生成は上記の勝ち要因を優先反映します。
 ⚠️ 疲労広告はMeta管理画面でOFFを検討してください。
```
- 空状態: 勝ち要因0件 → 「今週は有意な勝ち要因なし（データ不足）」/ 疲労0件 → 該当ブロック非表示
- score≥0.5 閾値は C4 注入と同一（レポート = 実際に反映される要因、で一致）
- 信頼シグナル: CPA/CPC/CTR・広告本数・CV件数を併記し誤学習でないか人が判断可能に

### パート2: 週次スナップショット（直近16週・スクショ形式）
```
📅 AdLoop 週次スナップショット 直近16週 2026年6月7日時点
期間              広告費   表示    クリック  CTR    CPC   CV   CPA
26/05/24-05/30   ¥276K   1.2M    8,400    0.70%  ¥33   16   ¥17.3K
26/05/31-06/06   ¥271K   1.1M    7,900    0.72%  ¥34   11   ¥24.6K
...
```
- 出す指標: 広告費 / 表示(impressions) / クリック / CTR / CPC / CV(conversions) / CPA
- 出さない: 売上・AOV・ROAS・Cart/Chko/Ord ファネル（banにデータ無し）
- 形式: Slack monospace 等幅テーブル（既存 kpi-summary の整形を流用）
- データ0週: `–` 表示

### 月次スナップショット（直近Nヶ月・別 cron）
週次と同じ列構成で月バケット集計。既定 N=6ヶ月。

## アーキテクチャ（cadence）

| cron | スケジュール | 送信内容 |
|---|---|---|
| `winning-pattern-weekly`（既存・改） | `0 0 * * 1`（月） | パート1 勝ち要因 ＋ パート2 週次スナップ（16週） |
| `ad-snapshot-monthly`（新） | `0 0 1 * *`（1日） | 月次スナップ（6ヶ月） |

## スキーマ変更（WinningPattern に加算・破壊なし）

CPC = spend/clicks のため clicks/spend が必要（現状未保存）。
```prisma
model WinningPattern {
  // ... 既存 ...
  clicks  Int      @default(0)                 // 追加（impressions と対称）
  spend   Decimal  @default(0) @db.Decimal(12, 2)  // 追加（CPC基礎・監査）
  avgCpc  Decimal? @db.Decimal(12, 2)          // 追加（= spend/clicks, clicks 0 で null）
}
```
→ 新マイグレーション `add_winning_pattern_cpc`（オフライン schema diff で安全生成・実DB適用は migrate-prod.mjs）

## コンポーネント／ファイル

| ファイル | 役割 |
|---|---|
| `src/lib/feedback-loop/fatigue-query.ts`（新） | `detectFatiguedAds()` — C5 route のインライン疲労検知を共通関数に抽出（純関数 isFatigued 再利用） |
| `src/app/api/cron/ad-fatigue-daily/route.ts`（改） | 抽出した `detectFatiguedAds()` を使用（重複解消） |
| `src/lib/feedback-loop/ad-snapshot.ts`（新） | `getAdSnapshotRows(granularity, periods)` — AdPerformanceSnapshot を週/月バケット集計（JST境界・週は日〜土でスクショ準拠） |
| `src/lib/slack/ad-report.ts`（新） | `formatWinningReport()`（純）/ `formatSnapshotTable()`（純・等幅）/ `sendWeeklyAdReport()` / `sendMonthlyAdSnapshot()`（POST） |
| `src/lib/feedback-loop/winning-score.ts`（改） | ScoredPattern に avgCpc 追加（avgCtr/avgCpa と同要領、clicks 0 で null） |
| `src/lib/feedback-loop/aggregate.ts`（改） | createMany で clicks/spend/avgCpc も永続化 |
| `src/app/api/cron/winning-pattern-weekly/route.ts`（改） | 集計後に sendWeeklyAdReport（try/catch・Slack失敗でcronは壊さない） |
| `src/app/api/cron/ad-snapshot-monthly/route.ts`（新） | 月次スナップ送信（CRON_SECRET認証） |
| `vercel.json`（改） | ad-snapshot-monthly cron 追加 |
| `tests/unit/feedback-loop/winning-score.test.ts`（改） | avgCpc テスト追加 |
| `tests/unit/feedback-loop/ad-report-format.test.ts`（新） | 勝ち要因文面の TDD（4状態: 要因あり/空/疲労あり/全空、CPA/CPC/CTR 含有） |
| `tests/unit/feedback-loop/ad-snapshot.test.ts`（新） | バケット集計＋等幅整形の TDD |

## エラー処理・ガード（vibe-coding 6条）
- Webhook 未設定 → skip + log（既存通知と同挙動）
- Slack 非200 → log、throw しない（集計成功を壊さない）
- Slack 4000字制限 → 週次16週×2部で収まる前提。超過時は週次スナップを12週へ縮約し log 明記（無言切り捨て禁止）
- 費用: 外部 API なし（ルールベース）・Slack Webhook 無料
- 整形 DRY: `¥276K` 等の短縮・等幅整形は既存 kpi-summary 関数を流用（重複生成しない）

## テスト方針
- 純ロジック（formatWinningReport / formatSnapshotTable / getAdSnapshotRows のバケット化 / avgCpc）は vitest TDD
- detectFatiguedAds / sendXxx（DB・POST）は tsc + 既存パターン準拠

## スコープ外（YAGNI）
- 売上/ROAS/ファネルCVR（adreport-daily 連携は別案件）
- AI 生成の示唆（ルールベースで確立後に検討）
- レポートの Web ダッシュボード化
