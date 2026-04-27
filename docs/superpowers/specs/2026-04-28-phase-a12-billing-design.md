# Phase A.12: Stripe Checkout + Webhook + Customer Portal 設計書

**作成日:** 2026-04-28
**ステータス:** ブレインストーミング完了 / 実装プラン作成前
**前提:** Phase A.11.5 完了（履歴 + お気に入り + plan-based lock 本番動作確認済み）
**配置場所:** `docs/superpowers/specs/2026-04-28-phase-a12-billing-design.md`

---

## 1. 背景・目的

事業計画書 v2 で予告した Phase A.12（Stripe Checkout + Promotion Codes）に Phase A.13（Stripe Webhook + Customer Portal）を**併合**して実装する。本フェーズのゴール：

**autobanner.jp を有料サービスとしてローンチ可能な状態にする。** Stripe Checkout / Webhook / Customer Portal を完成させ、FRIENDS コードで Beta 配布開始できる土台を作る。

### 1.1 ブレストで確定した戦略変更（重要）

旧ロードマップ：
- A.12: Stripe Checkout + Promotion Codes（1週間）
- A.13: Stripe Webhook + Customer Portal（3-5日）

→ **A.13 を A.12 に併合**：
- Webhook なし運用は実質「自分でテストして終わり」になり、A.13 完了までユーザーに売れない（収益発生しない期間が長い）
- Stripe SDK の初期化・型・テスト環境構築は Checkout も Webhook も共通 → 一気にやる方が合理的
- Customer Portal は数十行で済むので Portal も入れて顧客自己完結化

**期間見積もり: 1.5〜2 週間（事業計画上の A.12+A.13 = 1.5週間と概ね一致）**

---

## 2. スコープ定義

### 2.1 含むもの（A.12）
- Stripe Products + Prices（Starter / Pro base / Pro metered）
- Stripe Checkout Session（FRIENDS URL 自動適用対応）
- Webhook 5 events（session.completed / subscription.updated / subscription.deleted / payment_succeeded / payment_failed）
- Customer Portal（プラン切替・解約・支払い方法・請求書 DL・顧客情報編集・解約理由アンケート）
- 暫定 mailto モーダル 3 つの Stripe Checkout 化
- ヘッダーアップグレード CTA
- payment_failed 時の警告バナー（DB `paymentFailedAt` フラグ）
- Stripe Tax 有効化 + インボイス登録番号設定（株式会社4th Avenue Lab / T8010901045333）
- 月次サイクル統一（Stripe `current_period_end` 起点で usage リセット）

### 2.2 含まないもの（明示的に切る）
- メール通知（Resend 等）→ A.15 周辺で別途整備
- /pricing ページ → A.15 LP 制作で本格版を作る
- Pro メータード課金の `usage_records` 送信 → A.14
- 4セッション目グレーアウト（free プランの段階制限）→ A.14
- LP 制作 → A.15
- Plan C（個別商談）の Stripe 連携 → 当面個別契約のまま、A.15 で問合せ動線整備

### 2.3 完了基準
1. test mode で free → Pro Checkout 完了 → DB plan=pro 反映 → Plan badge 即時更新
2. URL `?promo=FRIENDS` 経由で Pro 初月無料が Checkout 画面に適用済表示
3. Customer Portal でプラン切替・解約予約 → webhook 受信 → DB 反映
4. test mode のカード強制失敗 → 警告バナー表示 → カード更新で消える
5. Stripe Invoice にインボイス登録番号 T8010901045333 が記載される
6. 本番モードに切り替え + 自分のカードで実際に Pro 購入 → 本番動作確認

---

## 3. 主要設計判断（Brainstorm 結果）

| Q | 論点 | 決定 |
|---|---|---|
| Q1 | A.13 を併合するか | **B: 併合する**（Webhook + Portal 込み） |
| Q2 | Pro subscription 構造 | **B: base ¥14,800 + metered ¥80 の 2-item subscription**（A.12 では metered usage 送信なし、A.14 で送信開始） |
| Q3 | プラン切替の課金タイミング | **C: ハイブリッド**（upgrade=即時 prorate / downgrade=期末 / cancel=期末） |
| Q4 | Promotion Code 初期実装 | **B: FRIENDS のみ + URL `?promo=FRIENDS` 自動適用 + Checkout 標準入力欄** |
| Q5 | Webhook イベント範囲 | **B: 5 events**（session.completed / subscription.updated / subscription.deleted / payment_succeeded / payment_failed） |
| Q6 | Customer Portal 機能範囲 | **B: プラン切替/解約/支払い方法/請求書/顧客情報編集/解約理由アンケート ON、クーポン適用 OFF** |
| Q7 | 支払い失敗時 dunning | **B: Stripe Smart Retries + アプリ内警告バナー（paymentFailedAt フラグ）** |
| Q8 | アップグレード UI | **A: 直接 Checkout**（モーダル本文を Starter/Pro の 2 ボタンに置換、/pricing は A.15 へ） |
| Q9 | 税表記/インボイス | **B: Stripe Tax + 適格請求書対応**（事業主体=株式会社4th Avenue Lab / T8010901045333） |

---

## 4. アーキテクチャ

### 4.1 システム構成

```
[ User Browser ]
      |
      v
[ banner-tsukurukun (Next.js 16 / Vercel) ]
      |
      |---> [ /api/billing/checkout-session ]  → Stripe Checkout URL 発行 → リダイレクト
      |---> [ /api/billing/portal-session ]    → Customer Portal URL 発行 → リダイレクト
      |
      |<--- [ /api/billing/webhook ]           ← Stripe イベント 5 種を受信
      |
      v
[ Neon Postgres ]
  - User.plan / planExpiresAt / planStartedAt
  - User.stripeCustomerId / stripeSubscriptionId
  - User.usageCount / usageResetAt
  - User.paymentFailedAt (新規)
  - WebhookEvent (新規 / idempotency 用)
```

### 4.2 主要データフロー

#### ① Free → Pro Checkout 成功
```
1. User: アップグレードモーダル「Pro にする」クリック
2. Front: POST /api/billing/checkout-session { priceId: PRO_PRICE_ID, promo?: "FRIENDS" }
3. API: stripeCustomerId 未取得なら Stripe Customer 作成 → DB 保存
4. API: Stripe Checkout Session 作成（mode=subscription, line_items=[base+metered], discounts?）
5. Front: Stripe URL に redirect
6. User: Stripe で支払情報入力 → 完了
7. Stripe → Webhook: checkout.session.completed
8. Webhook handler: User.plan='pro', stripeSubscriptionId, planStartedAt, usageResetAt 更新
9. Stripe → User: success_url=/account?stripe=success に redirect
10. /account: SessionSyncer が DB 再取得 → JWT を update() で refresh → Plan badge="pro"
11. Toast: 「Pro にアップグレードしました 🎉」
```

#### ② プラン切替（via Customer Portal）
```
1. User: /account の「お支払い情報を管理」クリック
2. Front: POST /api/billing/portal-session
3. API: Stripe Billing Portal Session 発行
4. User: Portal でプラン変更 → 確定
5. Stripe → Webhook: customer.subscription.updated
6. Webhook handler:
   - upgrade (Starter→Pro): proration_behavior='always_invoice' → 即時 plan='pro'
   - downgrade (Pro→Starter): pending_update を持つ subscription → planExpiresAt 設定、現状 plan は維持
7. （downgrade の場合）期末を迎えた時に customer.subscription.updated で新プラン start
```

#### ③ 解約（Pro → free）
```
1. User: Portal で「解約」クリック
2. Stripe: cancel_at_period_end=true 設定
3. Stripe → Webhook: customer.subscription.updated (cancel_at_period_end=true)
4. Webhook: planExpiresAt = current_period_end 保存（plan は 'pro' のまま）
5. UI: /account に「YYYY/MM/DD まで Pro / 以降 Free」表示
6. （期末到達）Stripe → Webhook: customer.subscription.deleted
7. Webhook: User.plan='free', stripeSubscriptionId=NULL, planExpiresAt=NULL
```

#### ④ 支払い失敗
```
1. Stripe: 月次自動引き落とし失敗
2. Stripe → Webhook: invoice.payment_failed
3. Webhook: User.paymentFailedAt = now()
4. UI: アプリ全体に警告バナー表示（PaymentFailedBanner コンポーネント）
5. Stripe Smart Retries: 3〜4 回自動リトライ（最大 30 日）
6a. リトライ成功 → Webhook: invoice.payment_succeeded → paymentFailedAt = NULL → バナー消える
6b. 全失敗 → Webhook: customer.subscription.deleted → plan='free' / paymentFailedAt=NULL / バナー消える
```

### 4.3 月次サイクルの統一（重要な設計変更）

**Before（A.11.0）:** `usageResetAt` は月初リセット（毎月 1 日に lazy reset）
**After（A.12）:** Stripe の `current_period_end` 起点で同期

理由: Stripe が月途中に契約した顧客の billing cycle を加入日基準で管理するため、アプリ側も Stripe 起点に統一する方が境界ずれが消える。`invoice.payment_succeeded` 受信時に `usageCount=0`, `usageResetAt=次の current_period_end` を設定。

**移行ロジック:** 既存 admin / 既存 free ユーザーは引き続き月初リセット（subscription なし）。Stripe 契約発生時のみ Stripe 起点サイクルに切り替わる。

---

## 5. DB スキーマ変更

```prisma
model User {
  // ... 既存フィールド ...

  /// Phase A.12: 直近の支払い失敗時刻（NULL なら正常）
  /// invoice.payment_failed で now() / payment_succeeded で NULL
  paymentFailedAt  DateTime?
}

/// Phase A.12: Webhook idempotency 用
model WebhookEvent {
  id          String    @id  // Stripe event.id をそのまま使う
  type        String
  receivedAt  DateTime  @default(now())
  processedAt DateTime?
  payload     Json      // デバッグ用に raw event 保存

  @@index([type])
  @@index([receivedAt])
}
```

### 5.1 設計判断

**`paymentFailedAt` を追加する理由:**
- 警告バナー表示の条件判定に必要（`User.paymentFailedAt != null` で出す）
- Stripe の subscription.status だけだと `past_due` 状態を即時に検知するために毎回 Stripe API を叩く必要が出てしまう
- DB に持たせれば SessionSyncer + JWT update で UI 反映できる

**`WebhookEvent` テーブルを追加する理由:**
- Stripe webhook は同じイベントを複数回送ってくる可能性がある（タイムアウト時のリトライ）
- idempotency 担保のため、event.id を一意キーとして「処理済みか」を判定
- payload 保存はデバッグ・障害調査に必須
- `processedAt` を持たせると「受信済み・未処理」のキューも実装可能（A.14 で活用）

**`planExpiresAt` は流用:**
- 既存カラムが Phase A.11.0 で「有料プラン期限」として定義済
- 解約予約も「期限が切れたら free に戻る」という意味で同じ
- 新カラムは追加せず集約

### 5.2 マイグレーション

```sql
-- prisma migration name: 20260428_phase_a12_billing
ALTER TABLE "User" ADD COLUMN "paymentFailedAt" TIMESTAMP(3);

CREATE TABLE "WebhookEvent" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "payload" JSONB NOT NULL
);

CREATE INDEX "WebhookEvent_type_idx" ON "WebhookEvent"("type");
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");
```

既存ユーザーへの影響: なし（NULL 許容カラム追加と新規テーブルのみ）。

---

## 6. ファイル/モジュール構成

### 6.1 新規ファイル

#### Stripe ライブラリ層（`src/lib/billing/`）
```
src/lib/billing/
├── stripe-client.ts          # Stripe SDK インスタンス（server only）
├── prices.ts                 # Price ID 定数 + plan ⇄ priceId マッピング
├── checkout.ts               # createCheckoutSession() ヘルパー
├── portal.ts                 # createPortalSession() ヘルパー
├── webhook-handlers/
│   ├── index.ts              # event.type → handler ルーター
│   ├── checkout-completed.ts # checkout.session.completed
│   ├── subscription-updated.ts
│   ├── subscription-deleted.ts
│   ├── payment-succeeded.ts
│   └── payment-failed.ts
├── idempotency.ts            # WebhookEvent テーブル経由の重複判定
└── plan-sync.ts              # Stripe Subscription → User.plan 反映ロジック共通化
```

#### API ルート（`src/app/api/billing/`）
```
src/app/api/billing/
├── checkout-session/route.ts    # POST: Checkout Session 作成
├── portal-session/route.ts      # POST: Customer Portal Session 作成
└── webhook/route.ts             # POST: Stripe Webhook 受信
```

#### UI コンポーネント
```
src/components/billing/
├── CheckoutButton.tsx           # 「Starter にする」「Pro にする」共通ボタン
├── PortalButton.tsx             # 「お支払い情報を管理」ボタン
├── PaymentFailedBanner.tsx      # 警告バナー（layout.tsx に常駐）
└── UpgradeCTAHeader.tsx         # ヘッダー右上の「⬆️ アップグレード」リンク
```

#### 環境変数追加
```
STRIPE_SECRET_KEY              # sk_test_xxx (test) / sk_live_xxx (prod)
STRIPE_WEBHOOK_SECRET          # whsec_xxx
STRIPE_PRICE_STARTER           # price_xxx (Starter ¥3,980/月)
STRIPE_PRICE_PRO_BASE          # price_xxx (Pro base ¥14,800/月)
STRIPE_PRICE_PRO_METERED       # price_xxx (Pro 超過 ¥80/回 metered)
STRIPE_PROMO_FRIENDS           # promo_xxx (FRIENDS の Promotion Code ID)
STRIPE_ENABLED                 # 'true' | 'false' (L1 ロールバック用)
```

### 6.2 変更ファイル

#### 既存暫定 mailto モーダルを Stripe Checkout 化
- `src/app/account/UpgradeModal.tsx` — mailto → CheckoutButton × 2（Starter/Pro）
- `src/components/layout/UsageLimitModal.tsx` — 同上
- `src/app/history/UpgradeLockModal.tsx` — 同上

#### Layout / Header 統合
- `src/app/layout.tsx` — `<PaymentFailedBanner />` を `<body>` 直下に常駐
- `src/components/layout/Header.tsx` — `<UpgradeCTAHeader />` を追加（free/starter のみ表示）

#### Account ページ
- `src/app/account/page.tsx` or `BillingSection.tsx` — PortalButton 追加
- success_url / cancel_url の query を読んで Toast 表示

#### Webhook で更新する既存ライブラリ
- `src/lib/plans/usage-counter.ts` — Stripe 起点リセットに対応する関数追加
  - 既存の月初 lazy reset は admin / free 用に維持
  - subscription 持ちは payment_succeeded 時に reset

### 6.3 共通化ポリシー

`src/lib/billing/plan-sync.ts` が中心:
```typescript
// Stripe Subscription オブジェクトを受け取って User の plan 関連カラムを同期
export async function syncUserPlanFromSubscription(
  userId: string,
  subscription: Stripe.Subscription
): Promise<void>
```

これを 4 つの subscription 系 webhook handler で共通利用 → Stripe → DB の同期ロジックを 1 箇所に集約 → 仕様変更時の修正点が 1 ファイルで済む。

---

## 7. エラーハンドリング設計

### 7.1 Webhook 受信フロー

```
[Stripe POST /api/billing/webhook]
  ↓
1. raw body 取得（req.text()）
2. signature 検証（stripe.webhooks.constructEvent + STRIPE_WEBHOOK_SECRET）
   → 失敗 → 400 + ログ
   ↓
3. WebhookEvent.findUnique({id: event.id})
   → 既存 + processedAt != null → 200（idempotent skip）
   ↓
4. WebhookEvent.upsert({id, type, payload}) — receivedAt 記録
   ↓
5. switch (event.type) で handler dispatch
   → 不明な type → 200（Stripe には ACK 返す、ログだけ残す）
   ↓
6. handler 内で DB 更新
   → 失敗 → 500（Stripe が自動リトライ、idempotency で 2 回目以降は再処理可）
   ↓
7. WebhookEvent.update({processedAt: now()})
   ↓
8. 200 OK
```

**設計意図:**
- signature 検証を最初に: 不正な POST に処理を走らせない
- WebhookEvent.upsert を handler 実行前に: handler 中に落ちても event は記録される
- processedAt は handler 成功後: 失敗時は再送で再処理される（exactly-once 相当）
- 不明 type は 200: Stripe 側のイベントが将来追加されても webhook が止まらない

### 7.2 Checkout Session 作成

```
1. session.user 取得 → 未ログイン → 401
2. priceId 検証（許可リスト: STARTER / PRO_BASE のみ）→ 不正 → 400
3. Stripe Customer 取得 or 作成
   - User.stripeCustomerId あり → 既存 Customer
   - なし → Stripe Customer 作成（email, metadata.userId）→ DB に保存
4. Checkout Session 作成
   - 失敗（Stripe API エラー）→ 500 + ログ
5. URL を返却（クライアントで window.location.href = url）
```

### 7.3 Customer Portal Session 作成

```
1. session.user 取得 → 未ログイン → 401
2. User.stripeCustomerId 必須 → なし → 400「先にプランを購入してください」
3. Portal Session 作成
4. URL を返却
```

### 7.4 Plan downgrade のタイミング処理

Customer Portal で「Pro → Starter」が選択された場合:
- Stripe は subscription を「期末で切替」予約状態にする
- `customer.subscription.updated` が発火（`pending_update` を持つ subscription）
- 即時の DB plan 更新は **しない**（期末まで Pro のまま）
- `planExpiresAt` に current_period_end をセット → UI に「YYYY/MM/DD まで Pro」表示
- 期末到達時に `customer.subscription.updated` が再発火（pending_update が apply 済）
- そのタイミングで `User.plan = 'starter'` に更新

このロジックは `plan-sync.ts` の中で `subscription.pending_update` の有無を見て分岐。

---

## 8. テスト戦略

### 8.1 Stripe CLI を使った webhook 検証
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### 8.2 test mode カード
- `4242 4242 4242 4242` — 成功
- `4000 0000 0000 0002` — declined
- `4000 0000 0000 9995` — insufficient_funds（payment_failed）
- `4000 0027 6000 3184` — 3D Secure（オプション）

### 8.3 検証項目

| カテゴリ | 項目 | 方法 |
|---|---|---|
| 正常系 | Free → Pro Checkout 完了 | test mode + 4242 |
| 正常系 | URL ?promo=FRIENDS で割引適用 | Stripe Checkout 画面確認 |
| 正常系 | Customer Portal でプラン切替 | upgrade=即時 / downgrade=期末 |
| 正常系 | Customer Portal で解約 | planExpiresAt セット確認 |
| 正常系 | 期末到達で free に戻る | Stripe Test Clock |
| 異常系 | カード declined | Checkout 画面のエラー表示 |
| 異常系 | payment_failed → バナー表示 | trigger invoice.payment_failed |
| 異常系 | payment_succeeded でバナー消える | trigger invoice.payment_succeeded |
| Idempotency | 同一 event 2 回送信で 1 回だけ処理 | stripe trigger を 2 回 |
| Signature | 不正 signature 拒否 | curl で raw POST |
| Tax | Invoice にインボイス番号記載 | Stripe Invoice PDF 確認 |
| 本番 | 自分のカードで Pro 購入 | live mode + 実カード |

### 8.4 Stripe Test Clock 活用
- 加入直後に 1 ヶ月進めて payment_succeeded 自動発火を観察
- 期末解約も 1 ヶ月進めて subscription.deleted 観察
- 通常は数日〜数週間待たないと検証できないシナリオを数秒で再現

---

## 9. 実装順序（チェックポイント分割）

### CP1: 基盤整備（1〜1.5日）
- feature ブランチ作成（`feat/phase-a12-billing`）
- `stripe` SDK 追加
- 環境変数定義（test mode）
- DB マイグレーション（`paymentFailedAt` + `WebhookEvent`）
- Stripe ダッシュボードで Products + Prices 作成
  - Starter ¥3,980/月（税込）
  - Pro base ¥14,800/月（税込）
  - Pro metered ¥80/回 graduated tier
- Stripe Tax 有効化 + インボイス登録番号 T8010901045333 設定
- Promotion Code「FRIENDS」発行（Pro 100% off, duration=once, max=100, per_customer=1）
- `STRIPE_ENABLED` フラグ実装

**完了基準:** Stripe ダッシュボードで Product/Price 確認、DB マイグレーション成功、env 全部入る

### CP2: Checkout 動線（2〜3日）
- `src/lib/billing/stripe-client.ts` / `prices.ts` / `checkout.ts`
- `POST /api/billing/checkout-session` 実装
- `CheckoutButton.tsx` 実装
- 3 つの暫定 mailto モーダルを CheckoutButton に置換
- success_url / cancel_url の Toast 表示
- URL `?promo=FRIENDS` 自動適用ロジック

**完了基準:** test mode で Checkout 画面に遷移→4242 カードで決済成功→success_url に戻る（DB 反映は CP3 で）

### CP3: Webhook 基盤（2〜3日）
- `POST /api/billing/webhook` 実装（signature 検証 + idempotency + dispatch）
- 5 つの webhook handler 実装
- `plan-sync.ts`（中核ロジック）
- Stripe CLI で 5 events 全部 trigger テスト
- Stripe Test Clock で月次サイクル進行検証

**完了基準:** Checkout 成功→Webhook 経由で User.plan='pro' 反映、Plan badge 即時更新

### CP4: Customer Portal + 警告バナー（1.5〜2日）
- `POST /api/billing/portal-session`
- `PortalButton.tsx`
- `/account` に PortalButton 統合
- `PaymentFailedBanner.tsx` を `layout.tsx` に常駐
- ヘッダー `UpgradeCTAHeader.tsx` 追加
- Portal でプラン切替・解約予約・支払い方法変更の動作確認

**完了基準:** Portal で全機能（切替/解約/カード変更/インボイス DL/顧客情報編集）動作、警告バナー表示・消失動作

### CP5: 月次サイクル統一 + 既存ロジック調整（1日）
- `payment_succeeded` 受信時の `usageCount=0` / `usageResetAt=current_period_end` 更新
- 既存の月初 lazy reset を「subscription なし（admin/free）のみ」に分岐
- `planExpiresAt` 表示（「YYYY/MM/DD まで Pro / 以降 Free」UI）

**完了基準:** Stripe billing cycle と DB の usageResetAt が完全一致

### CP6: 本番モード移行 + 実購入検証（0.5〜1日）
- Vercel env を live mode キーに切替
- Stripe ダッシュボードで本番用 Product/Price/Promotion Code を再作成
- 本番 Webhook エンドポイント登録（`https://autobanner.jp/api/billing/webhook`）
- 自分のカードで Pro 購入実行（実費 ¥14,800、後日 Customer Portal で解約）
- インボイス PDF に T8010901045333 が記載されているか確認
- main マージ + タグ `phase-a12-complete`

**完了基準:** 本番カードで Pro 購入成功、Stripe Invoice にインボイス番号記載

### 累計工数
**8〜11.5日（約 1.5〜2 週間）**

---

## 10. リスクと緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| Stripe Tax 設定の手戻り | 価格再登録 | CP1 で確定させ、test mode で Invoice を確認してから CP2 へ |
| Webhook 署名検証の落とし穴 | 不正リクエスト処理 | Next.js 16 で `req.text()` の raw body を確実に取る実装パターンを CP3 冒頭で確立 |
| 月次サイクル統一の既存影響 | 既存ユーザーの usage リセット異常 | admin / free（subscription なし）は従来ロジック維持で分岐 |
| Pro metered の subscription item 構造 | A.14 で送る usage_records の Price ID ずれ | CP1 で metered Price を作る時点で Price ID を env 化 |
| 本番モード切替時の env 取り違え | test mode のまま本番デプロイ | Vercel の Environment（Production/Preview/Development）で分離管理、checkout.ts で `process.env.NODE_ENV` と Stripe key 種別の不整合を起動時に検出 |

### 10.1 ロールバック手順

Phase A.7 / A.8 の L1〜L3 ロールバック手順を踏襲:
- **L1（即座）**: `STRIPE_ENABLED=false` を Vercel env に設定 → Checkout/Portal API が 503 を返し、UI は暫定 mailto モーダルにフォールバック
- **L2（数分）**: feature ブランチを revert merge
- **L3（数時間）**: タグ `phase-a11.5-complete` に巻き戻し

---

## 11. 法人情報（請求書発行用）

- **事業主体:** 株式会社4th Avenue Lab
- **インボイス登録番号:** T8010901045333（適格請求書発行事業者）
- **Stripe アカウント設定:**
  - Business name: 株式会社4th Avenue Lab
  - Tax ID: T8010901045333
  - Country: Japan
  - Currency: JPY

---

## 12. 次フェーズへの接続

### A.13（A.12 に併合）
- → 内容を A.12 に吸収済み。A.13 のフェーズは消滅。

### A.14（メータード課金）
- A.12 で構築した Pro subscription の metered item に `usage_records` を送り始めるだけで実装完了
- 4セッション目グレーアウト（free プランの段階制限）も A.14 で実装

### A.15（公開LP）
- /pricing ページ本格版の作成
- Plan C（個別商談）動線整備
- LP コピー戦略統合

---

## 13. 参考リンク

- 事業計画 spec v2: `docs/superpowers/specs/2026-04-26-business-plan.md`
- 前 Phase: `docs/superpowers/specs/2026-04-27-history-favorites-design.md` (Phase A.11.5)
- Stripe Tax (Japan): https://stripe.com/docs/tax/supported-countries#japan
- Stripe Subscription Lifecycle: https://stripe.com/docs/billing/subscriptions/overview
- Stripe Customer Portal: https://stripe.com/docs/customer-management
- Stripe Webhooks Best Practices: https://stripe.com/docs/webhooks/best-practices
