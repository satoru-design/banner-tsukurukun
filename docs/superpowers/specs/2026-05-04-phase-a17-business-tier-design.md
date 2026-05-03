# Phase A.17.0: Business プラン（4列目）追加設計書

**作成日:** 2026-05-04
**ステータス:** ブレインストーミング完了 / 実装プラン作成前
**前提:** Phase A.12 live mode 完了 / Phase A.14 メータード課金稼働中 / Phase A.16.1 multi-style 6 pattern 解禁完了
**配置場所:** `docs/superpowers/specs/2026-05-04-phase-a17-business-tier-design.md`

---

## 1. 背景・目的

### 1.1 派生課題の発生

Phase A.16.1（commit `422f4f7`）で複数スタイル選択が最大 6 まで拡張された結果、Pro プラン（月 100 内包枠 + ¥80/枠 メータード / ハードキャップ 500）の上限に **1 セッションで** 到達するケースが発生する:

```
6 pattern × 17 size = 102 枠/セッション
→ Pro 月 100 内包枠を 1 セッションで使い切る
→ 残りはメータード ¥80/枠 で吸収するが、ハードキャップ 500 枠で頭打ち
→ Pro maxed = ¥14,800 + 400 × ¥80 = ¥46,800/月（最大）
```

このユースケースを本格化したい大型ユーザー（広告代理店・中堅 EC 運用部隊）向けに、**Pro と Plan C の中間に Business プラン（自己完結セルフサーブ）を新設**する。

### 1.2 戦略的位置づけ

事業計画 v2 の 3階層 + 個別商談 を **4階層 + 個別商談** に拡張:

| | Free | Starter | Pro | **🆕 Business** | Plan C |
|---|---|---|---|---|---|
| 月額 | ¥0 | ¥3,980 | ¥14,800 | **¥39,800** | 個別 |
| 内包枠/月 | 3（生涯） | 30 | 100 | **1,000** | 個別 |
| メータード | -- | -- | ¥80/枠 | **¥40/枠** | -- |
| ハードキャップ | 3（生涯） | 30 | 500 | **3,000** | -- |
| LP 表示 | ✅ | ✅ | ✅ | **✅（4列目）** | 「より大規模なご利用は▶」 |

**LP 戦略:** 4 列で自己完結セルフサーブ + 下部に「より大規模なご利用は▶」で Plan C 商談動線維持。Plan C は SLA・年契約・専任サポートの真の Enterprise として温存。

### 1.3 ARR 上振れ試算

| 経路 | 想定 | MRR 増 | ARR 増 |
|---|---|---|---|
| Pro→Business 転換 | 既存 Pro 200名のうち 5%（10名）が ¥39,800 へ | +¥250,000 | **+¥300万** |
| Business 直接獲得 | LP 4列目経由で 5名/月 × 12ヶ月 | +¥199,000（12ヶ月後） | **+¥240万** |
| **合計** | | | **+¥540万 ARR 上乗せ** |

事業計画 v2 ARR 目標 ¥5,000万 → **¥5,540万** への上振れ余地。

---

## 2. スコープ定義

### 2.1 含むもの（A.17.0）

- **Stripe**: Business Product / Base Price ¥39,800 / Metered Price ¥40 を live mode で発行
- **DB**: `User.upgradeNoticeShownAt` + `UpgradeNotice` テーブル追加。`User.plan` enum に `'business'` 追加
- **plan limits**: `USAGE_LIMIT_BUSINESS=1000`, `HARDCAP_BUSINESS=3000`, `OVERAGE_RATE_BUSINESS=40`
- **API**:
  - `/api/billing/checkout-session` の許可 priceId に Business 追加（既存ロジック流用）
  - `/api/billing/downgrade` の対応に Business→Pro 追加（Subscription Schedule 既存パターン）
- **plan-sync.ts 拡張**: `syncUserPlanFromSubscription` に Business plan 値の同期ロジック追加
- **メータード送信**: `usage-records.ts` を Business overage にも対応（plan に応じて event_name 切替 or 単価切替）
- **UI**:
  - `BusinessPlanCard.tsx` — /account の Plan セクションに常設のプラン切替カード（W: ベースライン）
  - `UpgradeToBusinessBanner.tsx` — IroncladGenerateScreen の inline 通知（Y: リアルタイム検知）
  - `BusinessUpgradeAccountBanner.tsx` — /account の動的バナー（X: 月次 Cron 検知結果）
  - `/lp01` 料金表を 3列 → 4列 に拡張
- **Cron**: `scripts/check-business-upgrade-candidates.mjs` — 月初実行で `UpgradeNotice` 履歴 insert
- **アップグレード/ダウングレード**:
  - upgrade（Pro→Business）: 即時 prorate（Stripe `proration_behavior='always_invoice'`）
  - downgrade（Business→Pro）: 期末切替（Subscription Schedule）

### 2.2 含まないもの（明示的に切る / Phase A.17.x として後追い）

- **A.17.1**: クライアント別フォルダ（`Generation.clientTag` 追加 + 履歴 UI 改修）
- **A.17.2**: 拡張 Brand Kit 5 セット（`BrandKit` を 1→N に拡張）
- **A.17.3**: CSV ZIP 一括 DL（generation id 群を一発 ZIP）
- チームシート（マルチユーザー）→ 必要なら Plan C 商談 / Phase B 級
- API アクセス（プログラマブル生成）→ 同上
- Business 専用プロモーションコード → ローンチ後の販促タイミングで別 Coupon 発行
- メール通知 → A.15 周辺で別途整備（既存方針踏襲）

### 2.3 完了基準

1. Stripe live mode で Business Product / Base Price ¥39,800 / Metered Price ¥40 が発行されている
2. test mode で Free → Business Checkout 完了 → DB plan=business 反映 → Plan badge 即時更新
3. Pro ユーザーが /account から Business に upgrade → 即時 prorate 課金 → DB plan=business 反映
4. Business ユーザーが /account から Pro に downgrade → 期末切替予約 → planExpiresAt 設定 → 期末到達で plan=pro
5. Business ユーザーが月 1,000 枠超過時に ¥40/枠 で Stripe meterEvents に記録される
6. 1 セッションで Pro 100 枠を使い切る挙動を発生させる → IroncladGenerateScreen に `UpgradeToBusinessBanner` が表示される
7. 月初 Cron 実行 → 過去 3 ヶ月で ¥10,000 超のメータード超過があった Pro ユーザーに `UpgradeNotice` レコードが insert される → /account に `BusinessUpgradeAccountBanner` 表示
8. `/lp01` の料金表が 4 列構成で表示される
9. 自分のカードで本番 Business 購入 → 後日 Pro へ downgrade して期末切替検証

---

## 3. 主要設計判断（Brainstorm 結果）

| Q | 論点 | 決定 |
|---|---|---|
| Q1 | 既存 Plan C との関係 | **A: 4列 + Plan C 個別商談を残す**。Pro→Business（自己完結）→Plan C（SLA・年契約・専任サポート）の3段で代理店規模に対応 |
| Q2 | 枠数 × 価格 × メータード | **案 Y: ¥39,800 / 1,000 枠 / ¥40 メータード / ハードキャップ 3,000**。Pro maxed (¥46,800) との比較で「同価格帯で枠 2 倍・追加も半額」、粗利率 約 75% |
| Q3 | 枠数以外の差別化 | **案 Q（軽い代理店機能）を採用、ただし段階導入**。A.17.0 は枠数のみ先行、A.17.1〜A.17.3 で代理店機能を後追い |
| Q4 | プラン名 | **A: Business**。SaaS 業界標準（Slack/Notion/Figma/Webflow/Canva）で学習コスト ゼロ、Plan C を将来 Enterprise 化する余地も残す |
| Q5 | アップグレード導線 | **W + Y + X すべて並行実装**。W=/account 常設切替カード（ベースライン）、Y=リアルタイム inline 通知、X=月次 Cron バナー |

---

## 4. アーキテクチャ

### 4.1 主要データフロー

#### ① Pro → Business アップグレード（即時 prorate）

```
1. User: /account の BusinessPlanCard で「Business にアップグレード」クリック
2. Front: POST /api/billing/checkout-session { priceIds: [PRO_BUSINESS_BASE, PRO_BUSINESS_METERED] }
3. API: 既存 stripeSubscription があるので「Subscription Update」モードで実行
   - stripe.subscriptions.update(subId, {
       items: [
         { id: <既存 base item>, price: PRICE_BUSINESS_BASE },
         { id: <既存 metered item>, price: PRICE_BUSINESS_METERED },
       ],
       proration_behavior: 'always_invoice',
     })
4. Stripe: 即時 prorate Invoice 発行 → 自動引き落とし
5. Stripe → Webhook: customer.subscription.updated
6. Webhook handler (plan-sync): User.plan='business' 反映
7. UI: /account 再描画で Plan badge="business"、BusinessPlanCard が「現在のプラン」表示に切替
```

#### ② Business → Pro ダウングレード（期末切替）

```
1. User: /account の BusinessPlanCard で「Pro にダウングレード」クリック
2. Front: POST /api/billing/downgrade { targetPlan: 'pro' }
3. API: Stripe Subscription Schedule で期末切替を予約
   - stripe.subscriptionSchedules.create({ from_subscription: subId })
   - schedule.update({
       phases: [
         { items: [...current_business_items], end_date: current_period_end },
         { items: [{ price: PRICE_PRO_BASE }, { price: PRICE_PRO_METERED }] },
       ],
     })
4. Stripe → Webhook: customer.subscription.updated（schedule != null）
5. Webhook handler: planExpiresAt = current_period_end 保存（plan は 'business' のまま維持）
6. UI: /account に「YYYY/MM/DD まで Business / 以降 Pro」表示
7. （期末到達）Stripe: schedule apply → customer.subscription.updated
8. Webhook: User.plan='pro', planExpiresAt=NULL
```

#### ③ Business メータード送信（1,001 枠目以降）

```
1. User: 生成ボタンクリック
2. POST /api/ironclad-generate
3. 既存 incrementUsage() 後の usageCount を確認
4. A.17.0 追加分岐: if (plan === 'business' && usageCount > USAGE_LIMIT_BUSINESS) →
   stripe.billing.meterEvents.create({
     event_name: 'banner_generation_overage',  // A.14 と同じ event 名
     payload: { stripe_customer_id: user.stripeCustomerId, value: '1' },
     identifier: generation.id,
   })
5. Stripe: 月末請求で base ¥39,800 + (超過数 × ¥40) を自動 invoice
```

**重要:** A.14 の Pro メータードと同一の `event_name: 'banner_generation_overage'` を使い回す。Stripe 側で plan ごとの単価切替は **Subscription Item の Price** で行う（¥80 vs ¥40 は Stripe Meter の Pricing Tier ではなく、Subscription Item に紐づく Price で決まる）。

#### ④ Y: 1 セッション内で Pro 100 枠枯渇 → inline 通知

```
1. STEP3 マトリクス生成中、N 枚目で usageCount >= USAGE_LIMIT_PRO に到達
2. IroncladGenerateScreen: state に `proLimitReachedInSession = true` セット
3. UI: マトリクス上部に <UpgradeToBusinessBanner /> 表示
   「このセッションで Pro 100 枠を使い切りました。Business なら月 1,000 枠 + ¥40/枠で、今のペースだと月 ¥X 安くなります。」
   [Business にアップグレード] ボタン → BusinessPlanCard と同じ checkout-session API 呼出
4. localStorage に `businessUpgradeBannerDismissedAt` を記録 → 同月内は再表示しない
```

#### ⑤ X: 3ヶ月平均バナー（/account）

```
1. 月初 Cron: scripts/check-business-upgrade-candidates.mjs 実行
2. 過去 3 ヶ月の Pro ユーザーで「メータード超過合計 ¥10,000/月 平均」を抽出
3. 該当ユーザーごとに UpgradeNotice テーブルに insert（type='business_upgrade_recommendation', shownAt=null）
4. ユーザー次回ログイン時、/account の BusinessUpgradeAccountBanner が
   - User.upgradeNoticeShownAt を確認 → 未表示なら表示
   - 「過去 3 ヶ月平均 N 枠 / 月 ¥X のメータード課金です。Business なら月 ¥Y 安くなります。」
5. ユーザーがバナーを dismiss → upgradeNoticeShownAt = now() で次月まで非表示
```

### 4.2 plan-sync.ts の拡張

A.12 の中核ロジック `syncUserPlanFromSubscription` を Business 対応に拡張:

```typescript
// src/lib/billing/plan-sync.ts
const PRICE_TO_PLAN: Record<string, Plan> = {
  [PRICE_STARTER]: 'starter',
  [PRICE_PRO_BASE]: 'pro',
  [PRICE_BUSINESS_BASE]: 'business',  // 🆕 A.17.0 追加
};

// subscription.items から base price ID を取得 → plan 判定
// metered item は plan 判定に使わない（base のみで判定）
```

### 4.3 月次サイクル整合

A.12 で導入した「subscription 持ちは Stripe 起点 lazy reset」が前提:
- payment_succeeded webhook で usageCount=0, usageResetAt=current_period_end が設定される
- A.17.0 の Business 上限判定 `usageCount > USAGE_LIMIT_BUSINESS` は Stripe billing 月単位で正しく動く
- A.14 の Pro メータード送信ロジックと完全並行（plan に応じた閾値分岐のみ追加）

---

## 5. DB スキーマ変更

```prisma
enum Plan {
  free
  starter
  pro
  business  // 🆕 A.17.0 追加
  admin
}

model User {
  // ... 既存フィールド ...

  /// Phase A.17.0: Business アップグレード推奨バナーの最終表示時刻
  /// X (月次 Cron) で出すバナーの再表示制御に使用
  upgradeNoticeShownAt  DateTime?
}

/// Phase A.17.0: アップグレード推奨履歴
/// 月次 Cron がメータード超過 Pro ユーザーを抽出して insert する
/// /account の BusinessUpgradeAccountBanner が参照
model UpgradeNotice {
  id           String   @id @default(cuid())
  userId       String
  type         String   // 'business_upgrade_recommendation'
  recommendedPlan String  // 'business'
  metricSnapshot Json    // { avgOveragePerMonth: 12000, last3MonthsAvgUsage: 380, ... }
  createdAt    DateTime @default(now())
  shownAt      DateTime?
  dismissedAt  DateTime?

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([type])
}
```

### 5.1 マイグレーション

```sql
-- prisma migration name: 20260504_phase_a17_business_tier
ALTER TYPE "Plan" ADD VALUE 'business';

ALTER TABLE "User" ADD COLUMN "upgradeNoticeShownAt" TIMESTAMP(3);

CREATE TABLE "UpgradeNotice" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "recommendedPlan" TEXT NOT NULL,
  "metricSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shownAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3)
);

CREATE INDEX "UpgradeNotice_userId_createdAt_idx" ON "UpgradeNotice"("userId", "createdAt");
CREATE INDEX "UpgradeNotice_type_idx" ON "UpgradeNotice"("type");
```

既存ユーザー / Subscription への影響: なし（NULL 許容カラム追加 + enum 値追加 + 新規テーブルのみ）。

### 5.2 設計判断

**`upgradeNoticeShownAt` を User に持たせる理由:**
- BusinessUpgradeAccountBanner の表示判定を JOIN なしで済ませる（高頻度 read）
- UpgradeNotice 側の shownAt と二重管理になるが、User 側はキャッシュとして扱う

**`UpgradeNotice` テーブルを別途持つ理由:**
- 月次 Cron の実行履歴 + どの metric で抽出されたかのスナップショットを保存（後日分析用）
- 将来的に他の type（例: Pro → Pro Plus 推奨など）も同じ枠組みで追加可能
- 「いつ・どの metric で・どのプラン推奨を出したか」の監査ログにもなる

---

## 6. ファイル/モジュール構成

### 6.1 新規ファイル

#### Stripe / Plan 設定（`src/lib/billing/`, `src/lib/plans/`）
```
src/lib/billing/
├── prices.ts                    # 拡張: BUSINESS_BASE / BUSINESS_METERED 追加
├── plan-sync.ts                 # 拡張: PRICE_TO_PLAN に Business 追加
├── usage-records.ts             # 拡張: plan に応じた meterEvents 送信（既存とほぼ同じ）
└── upgrade-detection.ts         # 🆕 Pro maxed 検知 + 推奨計算ロジック

src/lib/plans/
├── limits.ts                    # 拡張: USAGE_LIMIT_BUSINESS=1000 / HARDCAP_BUSINESS=3000 追加
└── overage-rates.ts             # 🆕 plan -> overage rate (¥80 / ¥40) のマッピング
```

#### API ルート
```
src/app/api/billing/
├── checkout-session/route.ts    # 拡張: priceId 許可リストに Business 追加
└── downgrade/route.ts           # 拡張: Business→Pro の Subscription Schedule
```

#### UI コンポーネント
```
src/components/billing/
├── BusinessPlanCard.tsx               # 🆕 /account 常設のプラン切替カード（W）
├── UpgradeToBusinessBanner.tsx        # 🆕 IroncladGenerateScreen 用 inline 通知（Y）
└── BusinessUpgradeAccountBanner.tsx   # 🆕 /account 用 月次 Cron 検知バナー（X）
```

#### Cron スクリプト
```
scripts/
└── check-business-upgrade-candidates.mjs   # 🆕 月初実行 / Pro maxed 検知 / UpgradeNotice insert
```

#### 環境変数追加
```
STRIPE_PRICE_BUSINESS_BASE      # price_xxx (Business base ¥39,800/月)
STRIPE_PRICE_BUSINESS_METERED   # price_xxx (Business 超過 ¥40/枠 metered)
```

`scripts/stripe-live-ids.json` にも `PRICE_BUSINESS_BASE` / `PRICE_BUSINESS_METERED` / `PRODUCT_BUSINESS` を追記。

### 6.2 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | Plan enum に business 追加 / User.upgradeNoticeShownAt / UpgradeNotice モデル |
| `src/lib/plans/limits.ts` | USAGE_LIMIT_BUSINESS=1000 / HARDCAP_BUSINESS=3000 追加 |
| `src/lib/billing/prices.ts` | Business 用 priceId エクスポート |
| `src/lib/billing/plan-sync.ts` | PRICE_TO_PLAN 拡張 |
| `src/lib/billing/usage-records.ts` | plan に応じた挙動分岐（base price ID は同じ event_name でよい、subscription item で単価判定される） |
| `src/app/api/ironclad-generate/route.ts` | A.14 既存ロジックを Business にも適用（usageCount > USAGE_LIMIT_BUSINESS で meterEvents 送信） |
| `src/app/api/billing/checkout-session/route.ts` | 許可 priceId に Business 追加 |
| `src/app/api/billing/downgrade/route.ts` | Business→Pro 対応 |
| `src/components/ironclad/IroncladGenerateScreen.tsx` | UpgradeToBusinessBanner 統合 / proLimitReachedInSession 検知 |
| `src/app/account/PlanSection.tsx`（または相当箇所） | BusinessPlanCard / BusinessUpgradeAccountBanner 統合 |
| `src/app/lp01/...`（料金表セクション） | 3列 → 4列に拡張、Business 列追加 |
| `src/components/lp/PricingSection.tsx`（推定） | 同上 |

### 6.3 共通化ポリシー

- A.12 の `plan-sync.ts` を中核として Business を **enum 値 1 つ追加 + Price ID 1 セット追加** で吸収
- A.14 の `ironclad-generate` メータード送信ロジックを **plan に応じた閾値分岐** で Business 対応
- メータード送信は A.14 と同一 event_name（`banner_generation_overage`）を流用、単価は Stripe Subscription Item に紐づく Price で決まる

---

## 7. エラーハンドリング設計

### 7.1 Pro→Business アップグレード時の prorate 失敗

```
1. checkout-session API: stripe.subscriptions.update を呼出
2. 失敗時（カード残高不足等）→ Stripe API がエラー返す
3. 既存 subscription はそのまま（Pro 維持）
4. UI: Toast「アップグレードに失敗しました。お支払い方法をご確認ください」
5. 再試行は /account の BusinessPlanCard から
```

### 7.2 Business→Pro downgrade 後に Business 戻し

```
1. ユーザーが downgrade 予約後に「やっぱり Business 続ける」と判断
2. /account の BusinessPlanCard に「ダウングレード予約をキャンセル」ボタン表示
3. POST /api/billing/cancel-downgrade
4. API: stripe.subscriptionSchedules.release(scheduleId) → 予約解除
5. Webhook: customer.subscription.updated（schedule=null） → planExpiresAt=NULL 戻し
```

### 7.3 メータード送信失敗（A.14 と同じ）

- Stripe API 障害でメータード送信失敗 → ログに残し、ユーザーには成功を返す
- 月末 Invoice 確定前に Stripe Dashboard で漏れ検知 → 手動補正
- A.14 v2 での Cron リトライ実装時に Business も同じ仕組みで対応

### 7.4 Cron 実行失敗

```
1. scripts/check-business-upgrade-candidates.mjs が落ちる
2. 翌月初の次回実行で再評価される（毎月 idempotent）
3. UpgradeNotice の重複 insert を防ぐため、既存レコードの存在確認:
   if (last UpgradeNotice for userId within 30 days exists) → skip
```

### 7.5 BusinessUpgradeAccountBanner の表示制御

- 表示判定: `User.upgradeNoticeShownAt == null OR > 30日経過` AND 直近 UpgradeNotice が dismissed でない
- 過剰表示を防ぐ: dismissed 後は最低 60 日表示しない

---

## 8. テスト戦略

### 8.1 Stripe CLI / Test Clock

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook

# Pro → Business upgrade 検証
stripe trigger customer.subscription.updated \
  --override-event-data '{"items": [{"price": "price_business_base"}, {"price": "price_business_metered"}]}'

# Business メータード送信検証
stripe billing meter-events create banner_generation_overage \
  --payload "stripe_customer_id=cus_xxx,value=1"

# Test Clock で Business billing cycle 月末送信確認
stripe test-clock advance --frozen-time <next_period_end>
```

### 8.2 検証項目

| カテゴリ | 項目 | 方法 |
|---|---|---|
| 正常系 | Free → Business 直接 Checkout | test mode + 4242 |
| 正常系 | Pro → Business 即時 prorate upgrade | test mode + Subscription Update |
| 正常系 | Business → Pro 期末 downgrade | Stripe Test Clock で 1 ヶ月進める |
| 正常系 | Business 月 1,001 枠目で meterEvents 送信 | USAGE_LIMIT_BUSINESS を一時的に 5 に下げて手動検証 |
| 正常系 | Business メータード月末 Invoice 加算 | Test Clock で billing cycle 進める |
| UX (Y) | Pro 100 枠枯渇時に inline banner 表示 | USAGE_LIMIT_PRO を一時 5 に下げて生成 6 枚回す |
| UX (X) | Cron 実行で UpgradeNotice insert + バナー表示 | 手動で Cron スクリプト実行、特定 Pro ユーザーのメータード履歴を seed |
| UX (W) | /account に常設 BusinessPlanCard 表示 | 各 plan で /account 開いて表示確認 |
| LP | /lp01 料金表が 4 列で表示 | 各画面サイズ（mobile / tablet / desktop）で確認 |
| Idempotency | 同 Generation.id で 2 回 meterEvents → 1 件のみ | 既存 A.14 動作確認の Business 版 |
| Downgrade cancel | downgrade 予約後にキャンセル → 予約解除 | Stripe Dashboard で schedule released 確認 |
| 本番 | 自分のカードで Business 購入 → 後日 Pro へ downgrade | live mode + 実カード（実費 ¥39,800、後日 Customer Portal で解約 or downgrade） |

### 8.3 Cron スクリプトの dry-run

```bash
node scripts/check-business-upgrade-candidates.mjs --dry-run
```

`--dry-run` 時は UpgradeNotice insert せず、抽出対象の userId と metric を console 出力のみ。

---

## 9. 実装順序（チェックポイント分割）

### CP1: Stripe live mode セットアップ（0.5 日）
- Stripe Dashboard で Business Product 作成
- Business Base Price ¥39,800/月（税込・recurring monthly）
- Business Metered Price ¥40/枠（既存 meter `banner_generation_overage` に紐づく）
- `scripts/stripe-live-ids.json` に追記
- `STRIPE_PRICE_BUSINESS_BASE` / `STRIPE_PRICE_BUSINESS_METERED` を Vercel env に設定（test mode + live mode 両方）
- test mode でも同様の Product / Price を作成

**完了基準:** Stripe Dashboard で Business Product 確認、`stripe-live-ids.json` 更新、env 全部入る

### CP2: DB マイグレーション + plan limits 拡張（0.5 日）
- Prisma migration（Plan enum に business 追加 / upgradeNoticeShownAt / UpgradeNotice テーブル）
- `src/lib/plans/limits.ts` に USAGE_LIMIT_BUSINESS / HARDCAP_BUSINESS 追加
- `src/lib/billing/prices.ts` に Business priceId エクスポート
- `src/lib/billing/plan-sync.ts` の PRICE_TO_PLAN 拡張
- TypeScript ビルド通過確認

**完了基準:** Prisma generate / migrate dev / build 全 pass

### CP3: API 拡張（1 日）
- `/api/billing/checkout-session/route.ts` に Business priceId 許可
- `/api/billing/downgrade/route.ts` に Business→Pro 対応
- `/api/ironclad-generate/route.ts` の usage 判定 + meterEvents 送信を Business 対応
- ローカルで Free → Business Checkout 試行（test mode + 4242）
- Pro 既存契約から Business への upgrade 試行（test mode）

**完了基準:** test mode で Free → Business、Pro → Business、Business → Pro が全て webhook 経由で DB 反映

### CP4: UI 実装（W + Y + X 並行）（2 日）
- `BusinessPlanCard.tsx` 実装 + /account 統合（W）
- `UpgradeToBusinessBanner.tsx` 実装 + IroncladGenerateScreen 統合（Y）
- `BusinessUpgradeAccountBanner.tsx` 実装 + /account 統合（X）
- localStorage による dismissed 制御
- 各 plan で /account を開いて表示出し分け確認

**完了基準:** 各 banner / card が表示・dismiss・再表示制御込みで動作

### CP5: Cron スクリプト（0.5 日）
- `scripts/check-business-upgrade-candidates.mjs` 実装
- `--dry-run` フラグで安全に検証
- 過去 3 ヶ月のメータード履歴は **Stripe Invoice Line Items API** から取得（`invoice.lines.list` で `price.id == STRIPE_PRICE_PRO_METERED` の amount を集計）。理由: A.14 のメータード単価は Stripe 側に確定済 + ローカル DB に集計テーブルが存在しないため、Stripe を Single Source of Truth にする
- 月初 1 日に Vercel Cron で実行する設定（`vercel.json` の `crons` に登録）

**完了基準:** dry-run で正しいユーザー抽出、本実行で UpgradeNotice insert、/account でバナー表示

### CP6: LP 料金表 4 列化（1 日）
- `/lp01` の PricingSection を 3 列 → 4 列に拡張
- mobile では縦積み or 横スワイプ（既存 LP の breakpoint 規約に従う）
- 「Business」列の見せ方: 「広告代理店・中堅 EC 運用部隊向け」コピー追加
- LP 下部の「より大規模なご利用は▶」（Plan C 動線）はそのまま維持

**完了基準:** mobile / tablet / desktop で 4 列が崩れずに表示、CTA ボタンが Business Checkout に遷移

### CP7: 本番モード移行 + 実購入検証（0.5 日）
- Vercel env を live mode の Business Price ID に切替
- 自分のカードで Business 購入実行（実費 ¥39,800、後日 Pro へ downgrade で期末切替検証）
- インボイス PDF に T8010901045333 が記載されているか確認
- main マージ + タグ `phase-a17-business-tier-complete`

**完了基準:** 本番カードで Business 購入成功、Stripe Invoice 確認、Pro へ downgrade 予約 → 期末切替動作

### 累計工数
**6 営業日（約 1.2 週間）**

---

## 10. リスクと緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| Pro→Business prorate 計算の境界バグ | 課金額ずれ | Stripe `proration_behavior='always_invoice'` で Stripe 側に計算を委ねる、test mode で月途中アップグレードを Test Clock で検証 |
| Business メータード Price と Pro メータード Price が混同 | 単価ずれ | Subscription Item に紐づく Price で単価決定 / plan-sync で base Price から plan 判定 / event_name は共通でも問題なし |
| Cron 抽出ロジックの誤検知 | 不要な banner 表示でユーザー不信 | `--dry-run` で十分検証、初月は閾値 ¥10,000 を保守的に運用、フィードバック後に調整 |
| BusinessUpgradeAccountBanner の表示頻度過多 | UX 劣化 | dismissed 後 60 日表示しない / 同月内は再表示しない |
| LP 4 列が mobile で崩れる | 直帰率上昇 | mobile 縦積み or 横スワイプの両方を A/B 試行可、初期は縦積みで保守的に |
| 既存 Plan C 商談中の顧客が Business で自己完結してしまう | 個別商談機会損失 | Business 列に「より大規模・年契約・SLA をご希望なら Plan C へ」リンク追加 / LP 下部の「より大規模なご利用は▶」コピーを「年契約・SLA・専任サポートをご希望の方は▶」に明確化 |
| Business 列追加で Pro が見劣りして Pro 新規が減る | 売上機会損失 | Pro の見せ方を「個人〜10名規模 EC に最適」と明確に絞る / Business 列の対象を「11名以上の代理店・運用部隊」と明示 |

### 10.1 ロールバック手順

- **L1（即座）**: env `STRIPE_PRICE_BUSINESS_BASE` / `STRIPE_PRICE_BUSINESS_METERED` を空に → checkout-session API が Business priceId を弾く / UI 側は env 未設定で BusinessPlanCard 非表示
- **L2（数分）**: feature ブランチを revert merge
- **L3（数時間）**: 最新安定 commit（A.17.0 着手直前の main HEAD）に巻き戻し。A.17.0 着手時に新規タグ `phase-a16.1-pattern-unlock-stable` を切ってから feature ブランチに入る運用

### 10.2 既存顧客への影響評価

- **既存 Pro 顧客**: 影響なし。subscription はそのまま。/account に Business 切替カードが追加表示されるのみ
- **既存 Starter 顧客**: 影響なし。Business は LP では 4 列目に増えるが、Starter からの直接アップグレード動線は Pro のまま（Business 直接は Pro 経由が UX 上自然）
- **既存 Free 顧客**: 影響なし。LP の見せ方が増えるのみ
- **既存 Plan C 顧客**: 影響なし。Plan C は引き続き個別契約で運用
- **FRIENDS クーポン保有者**: 影響なし。Pro 限定維持。Business 用プロモーションコードは別途新規発行（A.17.0 後の販促タイミング）

---

## 11. 法人情報（既存踏襲）

- **事業主体:** 株式会社4th Avenue Lab
- **インボイス登録番号:** T8010901045333（適格請求書発行事業者）
- **Stripe 設定:** A.12 の既存設定を流用（Business Product にも同じ Tax ID が記載される）

---

## 12. 次フェーズへの接続

### A.17.1（クライアント別フォルダ）
- `Generation.clientTag: String?` 追加
- 履歴 UI でクライアント別タブ表示
- ZIP DL 時にクライアント別フォルダ構成

### A.17.2（拡張 Brand Kit）
- `BrandKit` を 1→N に拡張（`User` -> `BrandKit[]`）
- /brand-kit ページで複数セット管理

### A.17.3（CSV ZIP 一括 DL）
- `/api/generations/zip-batch` を Business 専用機能化（既存 Pro でも使えるなら使えるままで OK、Business で UI 強化）

### B フェーズ
- 薬機法 AI スコアの Business 限定強化機能（バッチ処理 / 履歴 export 等）
- 月末 Business 利用レポートメール（B.3 リテンション機能）

---

## 13. 参考リンク

- 事業計画 spec v2: `docs/superpowers/specs/2026-04-26-business-plan.md`
- Phase A.12 課金実装: `docs/superpowers/specs/2026-04-28-phase-a12-billing-design.md`
- Phase A.14 メータード課金: `docs/superpowers/specs/2026-04-28-phase-a14-metered-billing-design.md`
- Phase A.16 multi-style: `docs/superpowers/specs/2026-05-03-multi-style-generation-design.md`
- Stripe Subscription Update（即時 prorate）: https://stripe.com/docs/billing/subscriptions/upgrade-downgrade
- Stripe Subscription Schedule（期末切替）: https://stripe.com/docs/billing/subscriptions/subscription-schedules
- Stripe Billing Meters（メータード課金）: https://stripe.com/docs/billing/subscriptions/usage-based
