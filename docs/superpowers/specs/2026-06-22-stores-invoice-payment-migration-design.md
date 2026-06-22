# Stripe → STORES請求書決済 移行 設計書

- 日付: 2026-06-22
- 対象: banner-tsukurukun (autobanner.jp) / Next.js 16 バナー生成SaaS
- ステータス: 設計承認済み（実装計画へ）

## 背景

Stripeアカウントが**凍結・閉鎖**され、決済が継続できなくなった。代替として **STORES請求書決済（旧Coiney）** へ移行する。

オーナー（小池）確定事項:
- 課金モデルは**手動の請求書払い**に変更してよい
- 請求サイクルは**月額を維持**（月次手動請求）
- 超過従量課金は**廃止し、ハードキャップ一本**にする
- STORES請求書決済の**加盟店審査は承認済み・API利用可能**

## 前提と既知の事実（検証済み）

- STORES請求書決済は **継続課金（サブスク自動引き落とし）を提供しない**。都度の請求書URL発行のみ。（出典: Coiney公式サポート）
- 決済手段は **クレジットカードのみ**（Visa/Master/JCB/Amex/Diners）。銀行振込・コンビニ不可。
- 加盟店審査が必須（＝事業カテゴリ起因の凍結なら、Stripe同様に後日凍結し得るリスクが残る）。
- API: 請求（支払い）を作成し、レスポンスに決済画面URL（`links.paymentUrl` 相当）が返る。APIキーは「STORES管理画面 > STORES請求書決済 > 開発者用設定」から取得。

### 現状（移行前）のStripe実装サマリ
- 課金モデル: サブスク（継続課金）＋メータード超過課金のハイブリッド
- プラン定義: `src/lib/billing/prices.ts`（Starter / Pro / Business）
- Checkout: `src/lib/billing/checkout.ts`, `src/app/api/billing/checkout-session/route.ts`
- Customer Portal: `src/app/api/billing/portal-session/route.ts`
- メータード送信: `src/lib/billing/usage-records.ts`（`stripe.billing.meterEvents.create()`）
- Webhook: `src/app/api/billing/webhook/route.ts` ＋ `src/lib/billing/webhook-handlers/*`
  - `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.payment_succeeded` / `invoice.payment_failed`
- 課金状態判定・機能制限: `src/lib/plans/usage-check.ts`, `src/lib/plans/limits.ts`, `src/app/api/ironclad-generate/route.ts`
- DB: `prisma/schema.prisma` の `User`（plan, planExpiresAt, stripeCustomerId, stripeSubscriptionId, usageCount 等）, `WebhookEvent`, `OverageCharge`
- 既存の代替足場: `payjp-*`（`PAYMENT_PROVIDER` フラグ、payjpCustomerId/payjpSubscriptionId 等）が存在

## 目的・成功条件

1. 新規ユーザーがSTORES経由でカード決済し、有料プランが有効化される
2. 既存有料ユーザーがサービス断なく新方式へ移行する
3. 月次の請求・入金確認・督促・降格が極力自動で回る
4. 超過従量課金が撤廃され、ハードキャップで生成制御される
5. Stripeコードは削除せず温存され、`PAYMENT_PROVIDER` で切替可能

## アーキテクチャ

新規に `src/lib/billing/stores/` を追加し、既存の `payjp-*` と同じ「プロバイダ差し替え」パターンに乗せる。`PAYMENT_PROVIDER='stores'` で全課金フローをSTORES経路へルーティングする。

### 主要モジュール

| モジュール | 責務 | 依存 |
|---|---|---|
| `stores/stores-client.ts` | STORES請求書決済APIクライアント（`createInvoice` / `getPaymentStatus`）。APIキーは環境変数。 | `STORES_API_KEY` |
| `stores/invoice.ts` | プラン→金額決定、月次請求書(paymentUrl)発行、Invoice台帳への記録 | stores-client, Prisma |
| `stores/payment-detection.ts` | 支払い検知（webhook or ポーリング）→ プラン有効化。`Invoice.status` で冪等化 | Prisma |
| `stores/dunning.ts` | 未払い督促メール ＋ 猶予超過で free 降格 | Prisma, mailer |
| `stores/plan-activation.ts` | 支払い確定時に `User.plan` / `planStartedAt` / `planExpiresAt(+1ヶ月)` 更新 | Prisma |

各モジュールは単一責務・明確なインターフェースを持ち、独立してテスト可能とする。

## データモデル変更（Prisma）

手動請求では「誰に・いつ請求し・入金済か」の台帳を自前で持つ必要がある（Stripe時代はStripeが台帳だった）。**これはデータ設計の不可逆領域**のため、以下を最初に確定する。

### 新規 `Invoice` テーブル（月次請求台帳）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | String @id | PK |
| `userId` | String | FK → User |
| `plan` | String | 請求時のプラン（starter/pro/business） |
| `amount` | Int | 請求額（円） |
| `periodStart` | DateTime | 対象期間開始 |
| `periodEnd` | DateTime | 対象期間終了 |
| `storesPaymentId` | String? | STORES側の支払いID |
| `paymentUrl` | String? | 決済画面URL |
| `status` | String | `issued` / `paid` / `overdue` / `canceled`（**物理削除しない＝論理削除**） |
| `dueDate` | DateTime | 入金期限 |
| `issuedAt` | DateTime | 発行時刻 |
| `paidAt` | DateTime? | 入金確定時刻 |

制約:
- `@@unique([userId, periodStart])` で **同一期間の二重請求を構造的に防止**（冪等）
- `status` は論理削除前提。物理削除しない。

### `User` への追加
- `storesCustomerId String?` を追加
- 既存の `stripe*` / `payjp*` カラムは**温存**（削除しない）

### 環境分離
- 開発/本番でAPIキー・DBブランチを分離（既存 Neon dev/prod 構成・`scripts/migrate-prod.mjs` を踏襲）
- マイグレーションはコード経由。本番DBは直接触らない。

## 課金フロー

### 新規アップグレード
```
Free → [アップグレード] → backend が STORES invoice 作成（createInvoice）
     → paymentUrl を画面表示 / メール送付
     → ユーザーがカード決済
     → 支払い検知（webhook or ポーリング）
     → plan 有効化（planExpiresAt = now + 1ヶ月）
```

### 月次更新（cron）
```
毎日 cron: planExpiresAt が近い有料ユーザーを抽出
     → STORES invoice 自動発行（Invoice テーブルへ issued 記録）
     → paymentUrl をメール送付
     → 支払い検知 → planExpiresAt を +1ヶ月延長 / Invoice.status=paid
     → dueDate まで未払い → 督促メール（dunning）
     → 猶予超過 → Invoice.status=overdue, User.plan=free に降格
```

### 支払い検知
- **第一候補**: STORES webhook（支払い完了通知）→ **有無を実装計画フェーズで公式ドキュメント確認**
- **fallback**: status ポーリング cron（`issued` の Invoice を定期 `getPaymentStatus`）
- いずれも `Invoice.status` 遷移で二重処理を防止（冪等）。Stripe既存の `WebhookEvent` 冪等パターンを踏襲。

## ハードキャップ移行

- `src/lib/plans/limits.ts` の `USAGE_LIMIT_*` を実質ハードキャップ化
- `src/app/api/ironclad-generate/route.ts` 内の `sendMeteredUsage()` / `meterEvents` 呼び出しを**停止**
- `src/lib/billing/prices.ts` のメータードprice参照を撤去
- 上限到達 → 429 ＋ 上位プラン誘導UI（既存の警告/透かしUIを流用）
- `OverageCharge` テーブルは温存（過去データ保持、新規書き込み停止）

## 既存Stripe利用者の移行

- 現契約の `planExpiresAt` まで**現状維持で猶予**（サービス断を作らない）
- 「決済方法変更のお願い」告知メールを送付 → 次サイクルからSTORES invoiceへ乗せ替え
- Stripe webhookは当面**受信維持**（残存イベントの整合）。新規課金は発生させない。
- 移行完了後も `stripe*` カラム・コードは温存（ロールバック余地）

## 環境変数

| 変数 | 用途 |
|---|---|
| `PAYMENT_PROVIDER=stores` | 課金経路の切替フラグ |
| `STORES_API_KEY` | STORES請求書決済 APIキー（開発者用設定から取得） |
| `STORES_WEBHOOK_SECRET` | webhook検証用（webhookがある場合） |
| `STRIPE_*`（既存） | 温存・無効化 |

シークレットはコード直書きせず `.env` / Vercel 環境変数で管理。

## テスト計画

- `invoice.ts`: 金額計算・冪等性（同一期間二重発行が弾かれる）
- `payment-detection`: 支払い検知 → plan有効化（webhook/ポーリング両経路）
- `dunning`: dueDate・猶予の境界、督促送信、free降格
- ハードキャップ: 上限 ±1 の境界（429/通過）
- 既存Stripe利用者: 猶予 → 乗せ替えの移行シナリオ
- 「仕様 → テストケース一覧 → 実装」の順で進める

## 未検証ポイント（実装計画フェーズで公式ドキュメント確定）

1. STORES請求書決済APIの正式エンドポイント / 認証方式 / リクエスト・レスポンス形
2. **webhook（支払い完了通知）の有無** → 無ければポーリング一本に確定
3. 請求書の有効期限・再発行・キャンセルの仕様
4. APIのレート制限・冪等キー対応の有無

## リスクと対策

| リスク | 対策 |
|---|---|
| 加盟店審査リスク（事業カテゴリ起因なら後日凍結し得る） | 自前Invoice台帳でデータ主権を確保。再移行時の損失を最小化。`PAYMENT_PROVIDER` 抽象でプロバイダ差し替えを容易に保つ |
| 月次手動請求の運用負荷 | cron＋メール＋ポーリングで極力無人化。未入金の個別対応のみ人手 |
| 支払い検知のwebhook未確認 | ポーリングfallbackを最初から設計に内包 |
| 二重請求 | `@@unique([userId, periodStart])` ＋ `Invoice.status` 冪等 |
| データ不可逆性 | Invoice台帳は論理削除のみ。マイグレーション経由。dev/prod分離 |

## スコープ外（YAGNI）

- 銀行振込・コンビニ決済対応（STORESがカードのみ）
- 年額前払いプラン（今回は月額維持）
- 超過従量課金の自動請求（廃止確定）
- Pay.jp 経路の本実装（足場は温存するが今回は触らない）
