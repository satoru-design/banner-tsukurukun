# meta-autopause GAS

Phase 3b: Meta広告の自動PAUSE監視スクリプト。

## 機能

毎時1回実行:
- 全 ACTIVE ad の直近24h/7d Insights 取得
- 閾値超過 → 自動 PAUSE (status=PAUSED)
- 学習期間中（72h未満 OR CV<10）は判定凍結
- 結果を Slack 通知

## 閾値（autobanner.jp想定 LTV ¥18,000 / CAC ¥6,000）

| 指標 | 自動 PAUSE | 増額提案（Slack 通知のみ） |
|---|---|---|
| CPA | >¥9,000 連続3日 | <¥4,500 + CV5件超 |
| CPM | >¥3,500 | - |
| CTR | <0.8% | >2.5% |
| Frequency | >3.5（疲弊先行指標） | <1.8 |

## セットアップ

1. https://script.google.com で新規プロジェクト作成
2. プロジェクト名: `meta-autopause`
3. Code.gs と appsscript.json をコピペ
4. プロジェクト設定 → スクリプトプロパティ:
   - `META_SYSTEM_USER_TOKEN`: meta-ads-autopilot で発行した token
   - `META_AD_ACCOUNT_ID`: `act_1664983991362612`
   - `SLACK_WEBHOOK_URL`: 通知先 Slack webhook
   - `DRY_RUN`: `true` (テスト時) または `false` (本番)
5. トリガー追加: `monitorAndAutopause` を1時間ごと
6. 実行権限の認可

## DRY_RUN

- `true`: 閾値判定はするが PAUSE API は呼ばない（Slack には「DRY_RUN」と付記）
- `false`: 実 PAUSE 実行

## ログ

実行履歴は Google Cloud Logging（Stackdriver）に。
Slack 通知は実 PAUSE / 増額提案候補のみ（noise 削減）。
