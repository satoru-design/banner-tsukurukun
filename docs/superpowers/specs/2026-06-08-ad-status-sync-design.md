# Meta ad status 同期 設計書

- 日付: 2026-06-08
- 対象: banner-tsukurukun（AdLoop）
- 前提: AdLoop マルチテナント + autopilot 連携 稼働済
- ステータス: 設計承認済み（実装へ）

## 目的

autopilot は PAUSED 広告を作り、人が Meta UI で有効化するが `MetaAd.status` は null のまま。
C5 疲労検知は `status='active'` で絞るため対象を拾えない。
Meta から ad の effective_status を日次同期し、疲労検知を有効化する。自動停止はしない（通知のみ）。

## 方針

C2 日次 Insights cron（各 account のトークンで既に Meta を叩いている）に status 同期を相乗りさせる。

| 要素 | 内容 |
|---|---|
| 取得 | `act_<id>/ads?fields=id,effective_status&limit=500`（paging.next 追従）で全広告の effective_status |
| 反映 | その account の MetaAd の status を Meta の effective_status verbatim（'ACTIVE'/'PAUSED' 等）で更新 |
| 判定変更 | `detectFatiguedAds` のフィルタを `status: 'active'` → `status: 'ACTIVE'`（Meta 表記に統一） |
| 配線 | C2 cron で upsertSnapshots の後に syncAdStatuses(account)。account 別・1社失敗で他を止めない |
| 維持 | 自動停止なし。status は疲労検知の対象判定にのみ使用 |

## コンポーネント

`src/lib/feedback-loop/ad-status.ts`（新規）:
- `parseAdStatuses(data: { id: string; effective_status?: string }[]): Map<string, string>` — 純ロジック（adId→status）
- `fetchAdStatuses(account: { metaAdAccountId: string; token: string }): Promise<Map<string,string>>` — Graph `act_X/ads` をページネーション取得し parseAdStatuses。token は URL/ログに出さない（insights-client と同じ token-safe 方針）
- `syncAdStatuses(params: { accountId: string; metaAdAccountId: string; token: string }): Promise<{ updated: number }>` — fetch → その accountId の MetaAd の status を更新（adId 一致分のみ）

C2 cron（`src/app/api/cron/ad-insights-daily/route.ts`）:
- account ループ内、upsertSnapshots の後に `syncAdStatuses({ accountId: a.id, metaAdAccountId: a.metaAdAccountId, token })` を呼ぶ。失敗は warn して継続。

`src/lib/feedback-loop/fatigue-query.ts`:
- `where: { status: 'active', accountId }` → `where: { status: 'ACTIVE', accountId }`

## エラー処理・ガード
- token は env のみ・URL/ログ/エラーに出さない（insights-client 流用方針）。
- status 同期失敗はその account のみ skip + warn（全体・他 account を止めない）。
- effective_status 欠落の広告は status 更新スキップ（null のまま）。

## テスト方針
- `parseAdStatuses`：vitest TDD（id→effective_status のマップ化、欠落スキップ）。
- fetch/DB は tsc + 既存パターン。

## スコープ外（YAGNI）
- 自動 PAUSE（通知のみ方針を維持）
- status 履歴の保持（現在値のみ）
