# Phase A.12: Stripe Checkout + Webhook + Customer Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stripe Checkout / Webhook / Customer Portal を完成させ、autobanner.jp を有料サービスとしてローンチ可能な状態にする。FRIENDS コードで Beta 配布を開始できる土台を作る。

**Architecture:** ① Stripe SDK + DB schema 拡張（paymentFailedAt + WebhookEvent）。② Stripe Dashboard で Products/Prices/Promotion Code/Tax/Webhook を設定。③ Checkout Session API + 3 つの暫定 mailto モーダルを置換。④ Webhook 受信基盤（signature 検証 + idempotency + 5 handlers）。⑤ Customer Portal（プラン切替を OFF）+ 自前 Downgrade API（Subscription Schedule で期末切替）+ 警告バナー + ヘッダー CTA。⑥ 月次サイクルを Stripe `current_period_end` 起点に統一。⑦ 本番モード移行 + 実購入検証。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Prisma 7 / NextAuth.js v5 / Stripe SDK / Stripe Tax / Stripe Test Clock

**Spec:** [docs/superpowers/specs/2026-04-28-phase-a12-billing-design.md](../specs/2026-04-28-phase-a12-billing-design.md)

**Test方針:** プロジェクトはテストフレーム未導入。各タスクは「TypeScript ビルド通過 + Stripe CLI による webhook trigger + 段階手動確認」で検証。CP6 で実カードによる本番 Pro 購入検証。

---

## ファイル構成マップ

### 新規作成

| ファイル | 役割 |
|---|---|
| `prisma/migrations/<ts>_phase_a12_billing/migration.sql` | paymentFailedAt + WebhookEvent テーブル |
| `src/lib/billing/stripe-client.ts` | Stripe SDK インスタンス（server only） |
| `src/lib/billing/prices.ts` | Price ID 定数 + plan ⇄ priceId マッピング |
| `src/lib/billing/checkout.ts` | createCheckoutSession() ヘルパー |
| `src/lib/billing/portal.ts` | createPortalSession() ヘルパー |
| `src/lib/billing/idempotency.ts` | WebhookEvent CRUD + 重複判定 |
| `src/lib/billing/plan-sync.ts` | Stripe Subscription → User.plan 同期ロジック共通 |
| `src/lib/billing/webhook-handlers/index.ts` | event.type → handler ルーター |
| `src/lib/billing/webhook-handlers/checkout-completed.ts` | checkout.session.completed |
| `src/lib/billing/webhook-handlers/subscription-updated.ts` | customer.subscription.updated |
| `src/lib/billing/webhook-handlers/subscription-deleted.ts` | customer.subscription.deleted |
| `src/lib/billing/webhook-handlers/payment-succeeded.ts` | invoice.payment_succeeded |
| `src/lib/billing/webhook-handlers/payment-failed.ts` | invoice.payment_failed |
| `src/app/api/billing/checkout-session/route.ts` | POST: Checkout Session 作成 |
| `src/app/api/billing/portal-session/route.ts` | POST: Customer Portal Session 作成 |
| `src/app/api/billing/downgrade/route.ts` | POST: Pro→Starter 期末切替予約 |
| `src/app/api/billing/webhook/route.ts` | POST: Stripe Webhook 受信 |
| `src/components/billing/CheckoutButton.tsx` | 「Starter/Pro にする」共通ボタン |
| `src/components/billing/PortalButton.tsx` | 「お支払い情報を管理」ボタン |
| `src/components/billing/DowngradeButton.tsx` | 「Starter にダウングレード」ボタン |
| `src/components/billing/PaymentFailedBanner.tsx` | 警告バナー（layout.tsx 常駐） |
| `src/components/billing/UpgradeCTAHeader.tsx` | ヘッダー右上「⬆️ アップグレード」 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | User.paymentFailedAt 追加 + WebhookEvent モデル追加 |
| `package.json` | stripe SDK 依存追加 |
| `.env.local.example`（既存推定）または .env テンプレ | Stripe 関連 env 追記 |
| `src/app/account/UpgradeModal.tsx` | mailto → CheckoutButton × 2 に置換 |
| `src/components/layout/UsageLimitModal.tsx` | mailto → CheckoutButton × 2 に置換 |
| `src/app/history/UpgradeLockModal.tsx` | mailto → CheckoutButton × 2 に置換 |
| `src/app/layout.tsx` | `<PaymentFailedBanner />` を `<body>` 直下に常駐 |
| `src/components/layout/Header.tsx`（既存推定） | `<UpgradeCTAHeader />` 追加 |
| `src/app/account/page.tsx` または `BillingSection.tsx` | PortalButton + DowngradeButton 統合 |
| `src/app/account/page.tsx` | success_url/cancel_url の Toast 表示 |
| `src/lib/plans/usage-counter.ts`（既存推定） | Stripe 起点 reset 関数追加 + admin/free 分岐 |

---

## Task 0: 前提確認

**Files:**
- なし（git/環境確認のみ）

- [ ] **Step 1: 現在のブランチ・コミット確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
git branch --show-current
git log --oneline -3
```

期待:
- branch: `feat/phase-a12-billing`
- 最新 commit: `11ef109 docs(spec): fix Customer Portal proration limitation + metered Price config`
- working tree clean

- [ ] **Step 2: Node/npm バージョン確認**

```bash
node --version
npm --version
```

期待: Node 20+ / npm 10+（Phase A.11.5 と同じ環境）

- [ ] **Step 3: Stripe CLI インストール確認**

```bash
stripe --version
```

期待: `stripe version X.Y.Z` が表示される。未インストールなら https://stripe.com/docs/stripe-cli から DL（Windows scoop or 公式 zip）。

---

# CP1: 基盤整備

## Task 1: stripe SDK 追加

**Files:**
- 変更: `package.json`, `package-lock.json`

- [ ] **Step 1: stripe SDK インストール**

```bash
npm install stripe
```

期待: `package.json` の dependencies に `"stripe": "^X.Y.Z"`（執筆時点では最新メジャー）が追加される。

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功（既存コードに影響なし）。

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "deps: add stripe SDK for Phase A.12"
```

---

## Task 2: DB schema（paymentFailedAt + WebhookEvent）

**Files:**
- 変更: `prisma/schema.prisma`
- 作成: `prisma/migrations/<ts>_phase_a12_billing/migration.sql`

- [ ] **Step 1: schema.prisma に paymentFailedAt 追加**

`prisma/schema.prisma` の `model User` ブロック内、既存の `usageResetAt` の直下に追加:

```prisma
  /// Phase A.12: 直近の支払い失敗時刻（NULL なら正常）
  /// invoice.payment_failed で now() / payment_succeeded で NULL
  paymentFailedAt       DateTime?
```

- [ ] **Step 2: schema.prisma に WebhookEvent モデル追加**

`prisma/schema.prisma` の最末尾に追加:

```prisma
/// Phase A.12: Stripe Webhook idempotency 用
/// id は Stripe event.id をそのまま使い、重複処理を防ぐ
model WebhookEvent {
  id          String    @id
  type        String
  receivedAt  DateTime  @default(now())
  processedAt DateTime?
  payload     Json

  @@index([type])
  @@index([receivedAt])
}
```

- [ ] **Step 3: Prisma migration 生成**

```bash
npx prisma migrate dev --name phase_a12_billing
```

期待:
- `prisma/migrations/<timestamp>_phase_a12_billing/migration.sql` 生成
- migration が DB に適用される
- Prisma Client が再生成される

- [ ] **Step 4: 生成された migration.sql の内容確認**

```bash
cat prisma/migrations/*_phase_a12_billing/migration.sql
```

期待: `ALTER TABLE "User" ADD COLUMN "paymentFailedAt"` と `CREATE TABLE "WebhookEvent"` が含まれる。

- [ ] **Step 5: TypeScript ビルド**

```bash
npm run build
```

期待: ビルド成功（Prisma Client 再生成後の型整合）。

- [ ] **Step 6: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add paymentFailedAt + WebhookEvent for Phase A.12"
```

---

## Task 3: Stripe Dashboard - アカウント基本設定（手動作業）

**Files:**
- なし（Stripe ダッシュボード上の作業のみ）

このタスクはコード変更なし。Stripe ダッシュボードでの手動操作です。**全て test mode で実施**。

- [ ] **Step 1: Stripe アカウントに test mode でログイン**

ブラウザで https://dashboard.stripe.com/test/dashboard を開く。
画面上部のトグルが「テストモード」になっていることを確認。

- [ ] **Step 2: 事業者情報を「株式会社4th Avenue Lab」に設定**

Settings → Business settings → Public details
- Business name: `株式会社4th Avenue Lab`
- Public business name: `勝ちバナー作る君`（顧客側に見える名前）
- Country: Japan
- Default currency: JPY

- [ ] **Step 3: インボイス登録番号を設定**

Settings → Tax → Tax registrations または Tax IDs（場所は UI 改訂で異なる可能性あり）
- Country: Japan
- Tax ID type: 適格請求書発行事業者番号 (JP Tax Registration Number)
- Tax ID value: `T8010901045333`

- [ ] **Step 4: Stripe Tax を有効化**

Settings → Tax → Activate Tax
- Origin address: 株式会社4th Avenue Lab の登記住所を入力
- Default tax behavior: `inclusive`（税込価格として登録するため）

- [ ] **Step 5: チェック**

Settings → Tax で「日本：消費税 10%」が有効になっていることを確認。

---

## Task 4: Stripe Dashboard - Products + Prices 作成（手動）

**Files:**
- なし（Stripe ダッシュボード操作 + Price ID 控え）

- [ ] **Step 1: Product「Starter」作成**

Products → Add product
- Name: `勝ちバナー作る君 Starter`
- Description: `30回/月・5サイズ・お気に入り5枚保持`
- Pricing model: Standard pricing
- Price: `¥3,980`
- Billing period: Monthly
- Tax behavior: Inclusive（税込）
- Save

→ 生成された **Price ID をメモ**（`price_xxxxxxxxxxxxx` 形式）。これが `STRIPE_PRICE_STARTER`。

- [ ] **Step 2: Product「Pro」base 価格作成**

Products → Add product
- Name: `勝ちバナー作る君 Pro`
- Description: `100回/月・全17サイズ・勝ちバナー無制限・プロンプト閲覧・履歴無制限・ZIP DL`
- Pricing model: Standard pricing
- Price: `¥14,800`
- Billing period: Monthly
- Tax behavior: Inclusive
- Save

→ Price ID をメモ（これが `STRIPE_PRICE_PRO_BASE`）。

- [ ] **Step 3: Pro に metered 価格を追加**

直前の Product「Pro」を開く → Add another price
- Pricing model: **Usage-based pricing**
- Per unit pricing: `¥80`
- Billing period: Monthly
- Aggregation: `Sum of usage values during period`
- Usage type: `Metered`
- Tax behavior: Inclusive
- Save

→ Price ID をメモ（これが `STRIPE_PRICE_PRO_METERED`、A.14 で usage_records 送信に使用）。

- [ ] **Step 4: 全 Price ID を一時メモに記録**

`docs/temp-stripe-test-prices.md`（gitignore 対象）または paper メモに以下を記録:
```
STRIPE_PRICE_STARTER=price_xxx (test mode)
STRIPE_PRICE_PRO_BASE=price_xxx (test mode)
STRIPE_PRICE_PRO_METERED=price_xxx (test mode)
```

このメモは Task 6 で Vercel env / .env.local に投入する時に使う。

---

## Task 5: Stripe Dashboard - Promotion Code「FRIENDS」発行（手動）

**Files:**
- なし

- [ ] **Step 1: Coupon 作成**

Products → Coupons → New coupon
- Name: `Pro Friend Beta`
- Type: Percentage discount
- Percent off: `100`
- Duration: `Once`（初月のみ無料）
- Apply to specific products: `勝ちバナー作る君 Pro` のみ選択
- Save

→ Coupon ID をメモ（`coupon_xxx` 形式）。

- [ ] **Step 2: Promotion Code 発行**

直前の Coupon を開く → Add promotion code
- Code: `FRIENDS`
- Max redemptions: `100`
- Per-customer limit: `1`
- Expires: ローンチ後 3ヶ月後の日付（例: 2026-07-28）
- Save

→ Promotion Code ID をメモ（`promo_xxx` 形式）。これが `STRIPE_PROMO_FRIENDS`。

- [ ] **Step 3: 動作テスト**

Stripe ダッシュボード上で Coupon 詳細を開き、`FRIENDS` が active で「100% off, once, max 100」になっていることを確認。

---

## Task 6: 環境変数を Vercel と .env.local に設定

**Files:**
- 変更: `.env.local`（既存・gitignore 対象）
- 変更: Vercel Environment Variables（手動）

- [ ] **Step 1: .env.local に Stripe 関連 env を追記**

既存の `.env.local` に以下を追記（Task 4/5 でメモした Price ID/Promo ID を使用）:

```
# Phase A.12: Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO_BASE=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO_METERED=price_xxxxxxxxxxxxx
STRIPE_PROMO_FRIENDS=promo_xxxxxxxxxxxxx
STRIPE_ENABLED=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`STRIPE_SECRET_KEY` は Stripe ダッシュボード Developers → API keys から「Secret key」を取得。
`STRIPE_WEBHOOK_SECRET` は Task 14 の Stripe CLI listen 起動時に表示される値（一時的に空でOK、Task 14 で設定）。
`NEXT_PUBLIC_APP_URL` は Stripe Checkout の success_url/cancel_url 構築に使用。

- [ ] **Step 2: Vercel に同じ env を設定（Production / Preview / Development 全て）**

Vercel ダッシュボード → banner-tsukurukun プロジェクト → Settings → Environment Variables

各 env を「Production」「Preview」「Development」全てにチェックを入れて追加。
ただし **本番用の sk_live_xxx は CP6 で設定**。今は **全て sk_test_xxx の値を入れる**（test mode で本番動作確認するため）。

- [ ] **Step 3: 設定反映確認**

Vercel ダッシュボードの env 一覧に 8 個の `STRIPE_*` / `NEXT_PUBLIC_APP_URL` が並んでいることを確認。

---

## Task 7: stripe-client.ts + STRIPE_ENABLED フラグ

**Files:**
- 作成: `src/lib/billing/stripe-client.ts`

- [ ] **Step 1: stripe-client.ts 作成**

`src/lib/billing/stripe-client.ts`:

```typescript
import Stripe from 'stripe';

/**
 * Phase A.12: Stripe SDK インスタンス（server only）
 *
 * - STRIPE_ENABLED=false の場合は null を返す（L1 ロールバック用）
 * - apiVersion は SDK 同梱の最新を使用（明示しない）
 */

export const isStripeEnabled = (): boolean => {
  return process.env.STRIPE_ENABLED === 'true' && !!process.env.STRIPE_SECRET_KEY;
};

let cachedClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!isStripeEnabled()) {
    throw new Error('Stripe is disabled (STRIPE_ENABLED!=true or STRIPE_SECRET_KEY missing)');
  }
  if (!cachedClient) {
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }
  return cachedClient;
};
```

- [ ] **Step 2: TypeScript ビルド**

```bash
npm run build
```

期待: ビルド成功（型エラーなし）。

- [ ] **Step 3: コミット**

```bash
git add src/lib/billing/stripe-client.ts
git commit -m "feat(billing): add Stripe SDK client + STRIPE_ENABLED flag"
```

---

# CP2: Checkout 動線

## Task 8: prices.ts（Price ID 定数 + plan マッピング）

**Files:**
- 作成: `src/lib/billing/prices.ts`

- [ ] **Step 1: prices.ts 作成**

`src/lib/billing/prices.ts`:

```typescript
/**
 * Phase A.12: Stripe Price ID マッピング
 *
 * - 本ファイルは Price ID を「許可リスト」として明示することで、
 *   Checkout API で任意 priceId を受け取って成立しないように防衛する
 */

export type PlanKey = 'starter' | 'pro';

export interface PlanPriceConfig {
  basePriceId: string;
  meteredPriceId?: string;
}

export const getPlanPrices = (): Record<PlanKey, PlanPriceConfig> => ({
  starter: {
    basePriceId: process.env.STRIPE_PRICE_STARTER!,
  },
  pro: {
    basePriceId: process.env.STRIPE_PRICE_PRO_BASE!,
    meteredPriceId: process.env.STRIPE_PRICE_PRO_METERED!,
  },
});

export const isAllowedBasePriceId = (priceId: string): boolean => {
  const config = getPlanPrices();
  return priceId === config.starter.basePriceId || priceId === config.pro.basePriceId;
};

export const getPlanFromPriceId = (priceId: string): PlanKey | null => {
  const config = getPlanPrices();
  if (priceId === config.starter.basePriceId) return 'starter';
  if (priceId === config.pro.basePriceId) return 'pro';
  return null;
};
```

- [ ] **Step 2: TypeScript ビルド**

```bash
npm run build
```

期待: 成功。

- [ ] **Step 3: コミット**

```bash
git add src/lib/billing/prices.ts
git commit -m "feat(billing): add Price ID mapping + allow-list helpers"
```

---

## Task 9: checkout.ts（createCheckoutSession ヘルパー）

**Files:**
- 作成: `src/lib/billing/checkout.ts`

- [ ] **Step 1: checkout.ts 作成**

`src/lib/billing/checkout.ts`:

```typescript
import type Stripe from 'stripe';
import { getStripeClient } from './stripe-client';
import { getPlanPrices, getPlanFromPriceId } from './prices';
import { prisma } from '@/lib/prisma'; // 既存推定。なければ src/lib/db.ts や @/lib/db に合わせる

interface CreateCheckoutInput {
  userId: string;
  email: string;
  basePriceId: string;
  promotionCodeId?: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Phase A.12: Stripe Checkout Session を作成し URL を返す
 *
 * - User.stripeCustomerId 未取得なら Stripe Customer を新規作成して DB に保存
 * - Pro の場合は base + metered の 2-item subscription を作る
 * - Starter は base 単独
 * - promotionCodeId 渡せば discounts に乗せる（FRIENDS 等）
 */
export const createCheckoutSession = async (input: CreateCheckoutInput): Promise<string> => {
  const stripe = getStripeClient();
  const plan = getPlanFromPriceId(input.basePriceId);
  if (!plan) {
    throw new Error(`Invalid basePriceId: ${input.basePriceId}`);
  }

  // 1. Customer 取得 or 作成
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error('User not found');

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.email,
      metadata: { userId: input.userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: input.userId },
      data: { stripeCustomerId: customerId },
    });
  }

  // 2. line_items 構築
  const prices = getPlanPrices();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: input.basePriceId, quantity: 1 },
  ];
  if (plan === 'pro' && prices.pro.meteredPriceId) {
    lineItems.push({ price: prices.pro.meteredPriceId });
    // metered は quantity 指定不可（usage_records で送る）
  }

  // 3. Checkout Session 作成
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    customer: customerId,
    line_items: lineItems,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: !input.promotionCodeId, // 自動適用なし時のみ標準入力欄を出す
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
    subscription_data: {
      metadata: { userId: input.userId, plan },
    },
  };
  if (input.promotionCodeId) {
    params.discounts = [{ promotion_code: input.promotionCodeId }];
  }

  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error('Stripe did not return checkout URL');
  return session.url;
};
```

- [ ] **Step 2: prisma import パスを既存に合わせる**

`src/lib/db.ts` `src/lib/prisma.ts` のいずれが既存パスか確認:

```bash
ls src/lib/db.ts src/lib/prisma.ts 2>/dev/null
grep -rn "PrismaClient" src/lib/ --include="*.ts" | head -3
```

import 文を実際のパスに合わせて修正。

- [ ] **Step 3: TypeScript ビルド**

```bash
npm run build
```

期待: 成功。失敗したら stripe SDK の型エラーまたは prisma path 不整合 → 修正。

- [ ] **Step 4: コミット**

```bash
git add src/lib/billing/checkout.ts
git commit -m "feat(billing): add createCheckoutSession helper"
```

---

## Task 10: POST /api/billing/checkout-session

**Files:**
- 作成: `src/app/api/billing/checkout-session/route.ts`

- [ ] **Step 1: route.ts 作成**

`src/app/api/billing/checkout-session/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/auth'; // 既存推定（Phase A.10 NextAuth.js v5）
import { isStripeEnabled } from '@/lib/billing/stripe-client';
import { isAllowedBasePriceId } from '@/lib/billing/prices';
import { createCheckoutSession } from '@/lib/billing/checkout';

export const runtime = 'nodejs';

interface RequestBody {
  basePriceId: string;
  promo?: string; // 'FRIENDS' 等
}

export const POST = async (req: Request): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.basePriceId) {
    return NextResponse.json({ error: 'basePriceId required' }, { status: 400 });
  }
  if (!isAllowedBasePriceId(body.basePriceId)) {
    return NextResponse.json({ error: 'Invalid basePriceId' }, { status: 400 });
  }

  const promotionCodeId =
    body.promo === 'FRIENDS' ? process.env.STRIPE_PROMO_FRIENDS : undefined;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const url = await createCheckoutSession({
      userId: session.user.id,
      email: session.user.email,
      basePriceId: body.basePriceId,
      promotionCodeId,
      successUrl: `${appUrl}/account?stripe=success`,
      cancelUrl: `${appUrl}/account?stripe=canceled`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error('[checkout-session] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
```

- [ ] **Step 2: auth import パスを既存に合わせる**

```bash
grep -rn "export.*auth" src/auth.ts src/lib/auth/ 2>/dev/null | head -3
```

実際のパスに合わせて修正。

- [ ] **Step 3: TypeScript ビルド**

```bash
npm run build
```

期待: 成功。

- [ ] **Step 4: コミット**

```bash
git add src/app/api/billing/checkout-session/
git commit -m "feat(api): add POST /api/billing/checkout-session"
```

---

## Task 11: CheckoutButton.tsx

**Files:**
- 作成: `src/components/billing/CheckoutButton.tsx`

- [ ] **Step 1: CheckoutButton.tsx 作成**

`src/components/billing/CheckoutButton.tsx`:

```typescript
'use client';

import { useState } from 'react';

interface Props {
  basePriceId: string;
  label: string;
  promo?: string; // URL ?promo= から拾った値を渡せる
  className?: string;
}

export const CheckoutButton = ({ basePriceId, label, promo, className }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basePriceId, promo }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={className ?? 'w-full bg-black text-white px-4 py-3 rounded font-bold disabled:opacity-50'}
      >
        {loading ? '読み込み中...' : label}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};
```

- [ ] **Step 2: TypeScript ビルド**

```bash
npm run build
```

期待: 成功。

- [ ] **Step 3: コミット**

```bash
git add src/components/billing/CheckoutButton.tsx
git commit -m "feat(billing): add CheckoutButton component"
```

---

## Task 12: 既存 3 つの mailto モーダルを CheckoutButton に置換

**Files:**
- 変更: `src/app/account/UpgradeModal.tsx`
- 変更: `src/components/layout/UsageLimitModal.tsx`
- 変更: `src/app/history/UpgradeLockModal.tsx`

- [ ] **Step 1: UpgradeModal.tsx を読む**

```bash
cat src/app/account/UpgradeModal.tsx
```

mailto onClick の場所と、ファイル全体構造を把握。

- [ ] **Step 2: UpgradeModal.tsx を CheckoutButton 化**

mailto を起動する部分を 2 つの CheckoutButton（Starter/Pro）に置換。Pro 側の説明文に「100回/月・全17サイズ・勝ちバナー無制限」、Starter 側に「30回/月・5サイズ」を併記。

サンプル変更の主要部分（既存ファイルの構造に合わせて適用）:

```typescript
'use client';

import { CheckoutButton } from '@/components/billing/CheckoutButton';

// ... 既存 modal wrapper ...

const STARTER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER!;
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE!;
```

**注意:** Price ID をクライアントから参照するため、`NEXT_PUBLIC_STRIPE_PRICE_STARTER` と `NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE` を `.env.local` と Vercel env に追加する必要がある（Step 5 で対応）。

具体的な JSX 内：
```tsx
<div className="space-y-4">
  <div className="border rounded p-4">
    <h3 className="font-bold">Starter ¥3,980/月</h3>
    <p className="text-sm text-gray-600">30回/月・5サイズ・お気に入り 5 枚保持</p>
    <CheckoutButton basePriceId={STARTER_PRICE_ID} label="Starter にする" />
  </div>
  <div className="border-2 border-black rounded p-4">
    <h3 className="font-bold">Pro ¥14,800/月</h3>
    <p className="text-sm text-gray-600">100回/月・全17サイズ・勝ちバナー無制限・履歴無制限・ZIP DL</p>
    <CheckoutButton basePriceId={PRO_PRICE_ID} label="Pro にする" />
  </div>
</div>
```

既存の mailto 関連 import / state / handler は削除。

- [ ] **Step 3: UsageLimitModal.tsx を同様に書き換え**

```bash
cat src/components/layout/UsageLimitModal.tsx
```

を読み、mailto 部分を Step 2 と同じく CheckoutButton × 2 に置換。

- [ ] **Step 4: UpgradeLockModal.tsx を同様に書き換え**

```bash
cat src/app/history/UpgradeLockModal.tsx
```

を読み、mailto 部分を CheckoutButton × 2 に置換。ロック文脈なので Pro を強調するコピーで OK。

- [ ] **Step 5: NEXT_PUBLIC_STRIPE_PRICE_* env を追加**

`.env.local` に追記:
```
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE=price_xxxxxxxxxxxxx
```

値は Task 4 でメモした test mode の Price ID と同じ。Vercel env にも同じく `NEXT_PUBLIC_*` で追加（Production / Preview / Development 全て）。

- [ ] **Step 6: TypeScript ビルド**

```bash
npm run build
```

期待: 成功。失敗したら CheckoutButton import パス、process.env の型などを確認。

- [ ] **Step 7: コミット**

```bash
git add src/app/account/UpgradeModal.tsx src/components/layout/UsageLimitModal.tsx src/app/history/UpgradeLockModal.tsx .env.local
git commit -m "feat(billing): replace 3 mailto modals with CheckoutButton"
```

注: `.env.local` は通常 gitignore 対象。実プロジェクトでは含めず、env の追加情報は `.env.example` 等に記載するのが正しい。チームで運用しているなら適切に対応。

---

## Task 13: success_url / cancel_url の Toast 表示

**Files:**
- 変更: `src/app/account/page.tsx`（または関連 client component）

- [ ] **Step 1: account/page.tsx の構造確認**

```bash
cat src/app/account/page.tsx
ls src/app/account/
```

Server / Client component の分離パターンを確認。Toast を出すには Client component が必要。

- [ ] **Step 2: AccountStripeToast.tsx 作成（新規）**

`src/app/account/AccountStripeToast.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Phase A.12: Stripe Checkout の success_url / cancel_url から戻った時のトースト表示
 *
 * - ?stripe=success → 「アップグレードしました」
 * - ?stripe=canceled → 「キャンセルしました」
 *
 * 表示後はクエリを消すために router.replace で URL を /account に戻す
 */
export const AccountStripeToast = () => {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const stripe = params.get('stripe');
    if (!stripe) return;
    if (stripe === 'success') {
      window.alert('プランをアップグレードしました 🎉\n反映に数秒かかる場合があります。');
    } else if (stripe === 'canceled') {
      window.alert('キャンセルしました');
    }
    router.replace('/account');
  }, [params, router]);

  return null;
};
```

注: 既存に `Toast` コンポーネント（Phase A.11.5 で追加済 `src/components/ui/Toast.tsx`）があれば `window.alert` の代わりに使う。

- [ ] **Step 3: account/page.tsx に統合**

`src/app/account/page.tsx` に `<AccountStripeToast />` を追加（Suspense でラップ）:

```tsx
import { Suspense } from 'react';
import { AccountStripeToast } from './AccountStripeToast';

export default async function AccountPage() {
  // ... 既存 ...
  return (
    <>
      <Suspense fallback={null}>
        <AccountStripeToast />
      </Suspense>
      {/* 既存の Sections */}
    </>
  );
}
```

- [ ] **Step 4: TypeScript ビルド**

```bash
npm run build
```

期待: 成功。

- [ ] **Step 5: ローカル動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/account?stripe=success` を開く → アラート表示 → URL が `/account` に書き換わる。
`http://localhost:3000/account?stripe=canceled` も同様に確認。

- [ ] **Step 6: コミット**

```bash
git add src/app/account/AccountStripeToast.tsx src/app/account/page.tsx
git commit -m "feat(account): show Stripe success/cancel toast on return"
```

---

## CP2 中間検証（コミット前テスト）

- [ ] **Step 1: ローカルで Free → Pro Checkout 起動**

```bash
npm run dev
```

1. http://localhost:3000 にログイン（既存 Google SSO）
2. アップグレードモーダルを開く（ヘッダーまたは /account から）
3. 「Pro にする」をクリック
4. Stripe Checkout 画面に遷移すること
5. test カード `4242 4242 4242 4242` / 任意名/任意郵便番号で決済
6. success_url（`/account?stripe=success`）に戻ってアラート表示

期待: ここまで動く。**ただし DB の plan は更新されていない**（Webhook 未実装のため CP3 で対応）。

- [ ] **Step 2: ?promo=FRIENDS 動作確認**

http://localhost:3000/account?promo=FRIENDS （アップグレードモーダルが promo を読む実装にしているなら）または、`UpgradeModal` の CheckoutButton に `promo="FRIENDS"` を一時的に渡して動作確認。

期待: Stripe Checkout 画面で「割引: ¥14,800 OFF」が適用済表示。

CP2 中間検証 OK なら CP3 へ進む。

---

# CP3: Webhook 基盤

## Task 14: Stripe CLI で Webhook listen 起動 + WEBHOOK_SECRET 取得

**Files:**
- 変更: `.env.local`

- [ ] **Step 1: Stripe CLI ログイン（初回のみ）**

```bash
stripe login
```

ブラウザで pairing 完了 → CLI 側に「Done!」表示。

- [ ] **Step 2: Webhook listen 起動**

別ターミナルで:
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

期待出力:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxx (^C to quit)
```

この `whsec_xxx` が **STRIPE_WEBHOOK_SECRET**。

- [ ] **Step 3: .env.local に STRIPE_WEBHOOK_SECRET をセット**

`.env.local` の `STRIPE_WEBHOOK_SECRET=` の行を上記の値で更新。

`npm run dev` を再起動（env 変更を反映）。

---

## Task 15: idempotency.ts

**Files:**
- 作成: `src/lib/billing/idempotency.ts`

- [ ] **Step 1: idempotency.ts 作成**

`src/lib/billing/idempotency.ts`:

```typescript
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

/**
 * Phase A.12: Webhook idempotency
 *
 * - Stripe は同じ event を複数回送ってくる可能性がある（リトライ）
 * - WebhookEvent テーブルの id（= Stripe event.id）で「処理済みか」を判定
 * - 未処理なら upsert で receivedAt 記録、handler 完了後に processedAt セット
 */

export const isAlreadyProcessed = async (eventId: string): Promise<boolean> => {
  const existing = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  return existing !== null && existing.processedAt !== null;
};

export const recordEventReceived = async (event: Stripe.Event): Promise<void> => {
  await prisma.webhookEvent.upsert({
    where: { id: event.id },
    create: {
      id: event.id,
      type: event.type,
      payload: event as unknown as object,
    },
    update: {}, // 既存があってもフィールドは触らない（receivedAt は初回のまま残す）
  });
};

export const markEventProcessed = async (eventId: string): Promise<void> => {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date() },
  });
};
```

- [ ] **Step 2: TypeScript ビルド**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/billing/idempotency.ts
git commit -m "feat(billing): add webhook idempotency helpers"
```

---

## Task 16: plan-sync.ts（中核ロジック）

**Files:**
- 作成: `src/lib/billing/plan-sync.ts`

- [ ] **Step 1: plan-sync.ts 作成**

`src/lib/billing/plan-sync.ts`:

```typescript
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getPlanFromPriceId } from './prices';

/**
 * Phase A.12: Stripe Subscription → User.plan 同期の中核ロジック
 *
 * Webhook 系イベントの DB 反映は全てこの関数に集約。
 * 仕様変更時の修正点が 1 ファイルで済む。
 *
 * Subscription 側の状態:
 * - active + cancel_at_period_end=false → 通常 (plan=base price のプラン)
 * - active + cancel_at_period_end=true → 解約予約 (plan=current の維持、planExpiresAt セット)
 * - active + schedule.id がある → プラン切替予約 (plan=current の維持、planExpiresAt セット)
 * - canceled → free 化 (plan='free', stripeSubscriptionId=NULL)
 */

interface SyncOptions {
  resetUsage?: boolean; // payment_succeeded 時のみ true
}

export const syncUserPlanFromSubscription = async (
  userId: string,
  subscription: Stripe.Subscription,
  options: SyncOptions = {}
): Promise<void> => {
  const status = subscription.status;
  const baseItem = subscription.items.data.find((item) => {
    const recurring = item.price.recurring;
    return recurring && recurring.usage_type === 'licensed';
  });
  if (!baseItem) {
    console.warn(`[plan-sync] no licensed base item for subscription ${subscription.id}`);
    return;
  }

  const planFromPrice = getPlanFromPriceId(baseItem.price.id);
  if (!planFromPrice) {
    console.warn(`[plan-sync] unknown priceId ${baseItem.price.id}`);
    return;
  }

  const periodEnd = new Date(subscription.current_period_end * 1000);

  if (status === 'canceled' || status === 'incomplete_expired') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'free',
        stripeSubscriptionId: null,
        planExpiresAt: null,
        paymentFailedAt: null,
      },
    });
    return;
  }

  // schedule (future plan change) または cancel_at_period_end → plan は維持、planExpiresAt セット
  const isPendingChange = !!subscription.schedule || subscription.cancel_at_period_end;

  if (isPendingChange) {
    // 現状の plan は維持。User.plan は触らない。
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        planExpiresAt: periodEnd,
        ...(options.resetUsage
          ? { usageCount: 0, usageResetAt: periodEnd }
          : {}),
      },
    });
    return;
  }

  // 通常の active 状態 → plan を base price から決定して同期
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: planFromPrice,
      stripeSubscriptionId: subscription.id,
      planStartedAt: new Date(subscription.current_period_start * 1000),
      planExpiresAt: null, // 期限なし（解約予約解除時の再設定にも使える）
      ...(options.resetUsage
        ? { usageCount: 0, usageResetAt: periodEnd }
        : {}),
    },
  });
};

/**
 * Stripe Customer ID から DB User を引く
 */
export const findUserByStripeCustomerId = async (customerId: string) => {
  return prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
};
```

- [ ] **Step 2: TypeScript ビルド**

```bash
npm run build
```

期待: 成功。Stripe SDK の型と Prisma 型が整合。

- [ ] **Step 3: コミット**

```bash
git add src/lib/billing/plan-sync.ts
git commit -m "feat(billing): add plan-sync core (Stripe Subscription -> User.plan)"
```

---

## Task 17: webhook-handlers/checkout-completed.ts

**Files:**
- 作成: `src/lib/billing/webhook-handlers/checkout-completed.ts`

- [ ] **Step 1: handler 作成**

`src/lib/billing/webhook-handlers/checkout-completed.ts`:

```typescript
import type Stripe from 'stripe';
import { getStripeClient } from '../stripe-client';
import { syncUserPlanFromSubscription } from '../plan-sync';
import { prisma } from '@/lib/prisma';

/**
 * Phase A.12: checkout.session.completed
 *
 * - Subscription mode の Checkout 完了を契機に、ユーザーと subscription を紐付け、
 *   subscription を取り直して plan-sync 経由で DB 反映
 */
export const handleCheckoutCompleted = async (event: Stripe.CheckoutSessionCompletedEvent): Promise<void> => {
  const session = event.data.object;
  if (session.mode !== 'subscription' || !session.subscription || !session.customer) return;

  const userId = session.metadata?.userId
    ?? (await prisma.user.findUnique({ where: { stripeCustomerId: session.customer as string } }))?.id;
  if (!userId) {
    console.error('[checkout-completed] cannot resolve userId for customer', session.customer);
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  await syncUserPlanFromSubscription(userId, subscription, { resetUsage: true });
};
```

注: `metadata.userId` は subscription_data 経由でセットしたものは subscription.metadata に入る。session.metadata には入らない。 上記コードは customer ID 経由のフォールバックを優先する形に整理:

```typescript
import type Stripe from 'stripe';
import { getStripeClient } from '../stripe-client';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';

export const handleCheckoutCompleted = async (event: Stripe.CheckoutSessionCompletedEvent): Promise<void> => {
  const session = event.data.object;
  if (session.mode !== 'subscription' || !session.subscription || !session.customer) return;

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    console.error('[checkout-completed] user not found for customer', customerId);
    return;
  }

  const stripe = getStripeClient();
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subId);
  await syncUserPlanFromSubscription(user.id, subscription, { resetUsage: true });
};
```

こちらを採用。

- [ ] **Step 2: TypeScript ビルド**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/billing/webhook-handlers/checkout-completed.ts
git commit -m "feat(billing): add checkout-completed webhook handler"
```

---

## Task 18: webhook-handlers/subscription-updated.ts

**Files:**
- 作成: `src/lib/billing/webhook-handlers/subscription-updated.ts`

- [ ] **Step 1: handler 作成**

`src/lib/billing/webhook-handlers/subscription-updated.ts`:

```typescript
import type Stripe from 'stripe';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';

/**
 * Phase A.12: customer.subscription.updated
 *
 * - プラン変更（即時 upgrade）→ plan を新 price から反映
 * - 解約予約（cancel_at_period_end=true）→ plan 維持、planExpiresAt セット
 * - schedule 経由のプラン変更予約（downgrade）→ plan 維持、planExpiresAt セット
 * - schedule apply 後（期末で plan が切り替わる）→ plan を新 price から反映
 *
 * 全て plan-sync 内のロジックで分岐済み。ここでは User を引いて渡すだけ。
 */
export const handleSubscriptionUpdated = async (event: Stripe.CustomerSubscriptionUpdatedEvent): Promise<void> => {
  const subscription = event.data.object;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    console.error('[subscription-updated] user not found for customer', customerId);
    return;
  }
  await syncUserPlanFromSubscription(user.id, subscription);
};
```

- [ ] **Step 2: TypeScript ビルド + コミット**

```bash
npm run build
git add src/lib/billing/webhook-handlers/subscription-updated.ts
git commit -m "feat(billing): add subscription-updated webhook handler"
```

---

## Task 19: webhook-handlers/subscription-deleted.ts

**Files:**
- 作成: `src/lib/billing/webhook-handlers/subscription-deleted.ts`

- [ ] **Step 1: handler 作成**

`src/lib/billing/webhook-handlers/subscription-deleted.ts`:

```typescript
import type Stripe from 'stripe';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';

/**
 * Phase A.12: customer.subscription.deleted
 *
 * - 期末解約完了 / 支払い失敗で全リトライ尽きた / 手動キャンセル
 * - subscription.status が 'canceled' になっている → plan-sync が free に戻す
 */
export const handleSubscriptionDeleted = async (event: Stripe.CustomerSubscriptionDeletedEvent): Promise<void> => {
  const subscription = event.data.object;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return;
  await syncUserPlanFromSubscription(user.id, subscription);
};
```

- [ ] **Step 2: ビルド + コミット**

```bash
npm run build
git add src/lib/billing/webhook-handlers/subscription-deleted.ts
git commit -m "feat(billing): add subscription-deleted webhook handler"
```

---

## Task 20: webhook-handlers/payment-succeeded.ts

**Files:**
- 作成: `src/lib/billing/webhook-handlers/payment-succeeded.ts`

- [ ] **Step 1: handler 作成**

`src/lib/billing/webhook-handlers/payment-succeeded.ts`:

```typescript
import type Stripe from 'stripe';
import { getStripeClient } from '../stripe-client';
import { syncUserPlanFromSubscription, findUserByStripeCustomerId } from '../plan-sync';
import { prisma } from '@/lib/prisma';

/**
 * Phase A.12: invoice.payment_succeeded
 *
 * - 月次請求成功 → usageCount=0 / usageResetAt=次の current_period_end
 * - paymentFailedAt = NULL（直前に失敗があれば回復）
 * - subscription を取り直して plan-sync 経由で同期（resetUsage: true）
 */
export const handlePaymentSucceeded = async (event: Stripe.InvoicePaymentSucceededEvent): Promise<void> => {
  const invoice = event.data.object;
  if (!invoice.subscription || !invoice.customer) return;

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return;

  // paymentFailedAt クリア
  if (user.paymentFailedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { paymentFailedAt: null },
    });
  }

  const stripe = getStripeClient();
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subId);
  await syncUserPlanFromSubscription(user.id, subscription, { resetUsage: true });
};
```

- [ ] **Step 2: ビルド + コミット**

```bash
npm run build
git add src/lib/billing/webhook-handlers/payment-succeeded.ts
git commit -m "feat(billing): add payment-succeeded webhook handler"
```

---

## Task 21: webhook-handlers/payment-failed.ts

**Files:**
- 作成: `src/lib/billing/webhook-handlers/payment-failed.ts`

- [ ] **Step 1: handler 作成**

`src/lib/billing/webhook-handlers/payment-failed.ts`:

```typescript
import type Stripe from 'stripe';
import { findUserByStripeCustomerId } from '../plan-sync';
import { prisma } from '@/lib/prisma';

/**
 * Phase A.12: invoice.payment_failed
 *
 * - paymentFailedAt = now() を立てる
 * - plan は変更しない（Stripe Smart Retries が走る間は Pro のまま）
 * - 全リトライ失敗 → subscription.deleted で別途 free に戻る
 */
export const handlePaymentFailed = async (event: Stripe.InvoicePaymentFailedEvent): Promise<void> => {
  const invoice = event.data.object;
  if (!invoice.customer) return;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { paymentFailedAt: new Date() },
  });
};
```

- [ ] **Step 2: ビルド + コミット**

```bash
npm run build
git add src/lib/billing/webhook-handlers/payment-failed.ts
git commit -m "feat(billing): add payment-failed webhook handler"
```

---

## Task 22: webhook-handlers/index.ts（dispatcher）

**Files:**
- 作成: `src/lib/billing/webhook-handlers/index.ts`

- [ ] **Step 1: dispatcher 作成**

`src/lib/billing/webhook-handlers/index.ts`:

```typescript
import type Stripe from 'stripe';
import { handleCheckoutCompleted } from './checkout-completed';
import { handleSubscriptionUpdated } from './subscription-updated';
import { handleSubscriptionDeleted } from './subscription-deleted';
import { handlePaymentSucceeded } from './payment-succeeded';
import { handlePaymentFailed } from './payment-failed';

/**
 * Phase A.12: Webhook dispatcher
 *
 * 5 events 以外は no-op（ログのみ）。
 */
export const dispatchWebhookEvent = async (event: Stripe.Event): Promise<void> => {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event);
      return;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event);
      return;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event);
      return;
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event);
      return;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event);
      return;
    default:
      console.log(`[webhook] ignored event type: ${event.type}`);
  }
};
```

- [ ] **Step 2: ビルド + コミット**

```bash
npm run build
git add src/lib/billing/webhook-handlers/index.ts
git commit -m "feat(billing): add webhook event dispatcher"
```

---

## Task 23: POST /api/billing/webhook（受信エンドポイント）

**Files:**
- 作成: `src/app/api/billing/webhook/route.ts`

- [ ] **Step 1: route.ts 作成**

`src/app/api/billing/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient, isStripeEnabled } from '@/lib/billing/stripe-client';
import { isAlreadyProcessed, recordEventReceived, markEventProcessed } from '@/lib/billing/idempotency';
import { dispatchWebhookEvent } from '@/lib/billing/webhook-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase A.12: Stripe Webhook 受信エンドポイント
 *
 * フロー:
 * 1. raw body 取得（req.text()）
 * 2. signature 検証（constructEvent）
 * 3. idempotency check（既に processed なら 200 で skip）
 * 4. recordEventReceived（受信記録）
 * 5. dispatch
 * 6. markEventProcessed
 * 7. 200 OK
 *
 * handler 内で例外 → 500 を返し Stripe に再送させる（idempotency でも安全）
 */
export const POST = async (req: Request): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error('[webhook] signature verification failed:', e);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (await isAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  await recordEventReceived(event);

  try {
    await dispatchWebhookEvent(event);
    await markEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[webhook] handler error:', e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
};
```

- [ ] **Step 2: ビルド**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/app/api/billing/webhook/
git commit -m "feat(api): add POST /api/billing/webhook with signature verification + idempotency"
```

---

## CP3 中間検証

- [ ] **Step 1: stripe listen 起動 + dev 起動**

ターミナル A:
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

ターミナル B:
```bash
npm run dev
```

- [ ] **Step 2: Free → Pro Checkout 実行**

ブラウザで /account → Pro Checkout → 4242 カードで決済完了 → success_url に戻る

- [ ] **Step 3: ログ確認**

ターミナル A の `stripe listen` 出力に以下が並ぶ:
```
checkout.session.completed → 200
customer.subscription.created → 200
invoice.created → 200
invoice.finalized → 200
invoice.paid → 200
invoice.payment_succeeded → 200
customer.subscription.updated → 200
```

ターミナル B の `npm run dev` 出力にエラーなし。

- [ ] **Step 4: DB 反映確認**

```bash
npx prisma studio
```

該当 User の row を開き:
- `plan`: `pro` になっている
- `stripeCustomerId`: 値が入っている
- `stripeSubscriptionId`: 値が入っている
- `usageCount`: 0
- `usageResetAt`: 約 1ヶ月後の日時

- [ ] **Step 5: WebhookEvent テーブル確認**

prisma studio で WebhookEvent を開く → 受信した event が並んでいる、`processedAt` が全て埋まっている。

- [ ] **Step 6: idempotency 動作確認**

```bash
stripe trigger checkout.session.completed
```

を 2 回実行 → DB の WebhookEvent に同じ ID は 1 行のみ。2 回目は 200 idempotent skip。

CP3 中間検証 OK なら CP4 へ。

---

# CP4: Customer Portal + 警告バナー + Downgrade

## Task 24: portal.ts + Customer Portal Configuration（手動）

**Files:**
- 作成: `src/lib/billing/portal.ts`
- なし: Stripe Dashboard 設定

- [ ] **Step 1: Stripe Dashboard で Customer Portal Configuration を作成**

Settings → Billing → Customer portal
- Functionality:
  - Subscription update: **OFF**（プラン切替はアプリ内で）
  - Subscription cancellation: ON, At period end, with cancellation reasons
  - Customer details update: ON
  - Payment methods: ON
  - Billing history (invoices): ON
  - Promotion codes: OFF
- Business information:
  - Headline: `勝ちバナー作る君のお支払い情報`
- Save

- [ ] **Step 2: portal.ts 作成**

`src/lib/billing/portal.ts`:

```typescript
import { getStripeClient } from './stripe-client';

interface CreatePortalInput {
  customerId: string;
  returnUrl: string;
}

export const createPortalSession = async (input: CreatePortalInput): Promise<string> => {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
  return session.url;
};
```

- [ ] **Step 3: ビルド + コミット**

```bash
npm run build
git add src/lib/billing/portal.ts
git commit -m "feat(billing): add createPortalSession helper"
```

---

## Task 25: POST /api/billing/portal-session

**Files:**
- 作成: `src/app/api/billing/portal-session/route.ts`

- [ ] **Step 1: route.ts 作成**

`src/app/api/billing/portal-session/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStripeEnabled } from '@/lib/billing/stripe-client';
import { createPortalSession } from '@/lib/billing/portal';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const POST = async (): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No subscription. Please upgrade first.' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const url = await createPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${appUrl}/account`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error('[portal-session] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
```

- [ ] **Step 2: ビルド + コミット**

```bash
npm run build
git add src/app/api/billing/portal-session/
git commit -m "feat(api): add POST /api/billing/portal-session"
```

---

## Task 26: PortalButton.tsx + /account 統合

**Files:**
- 作成: `src/components/billing/PortalButton.tsx`
- 変更: `src/app/account/page.tsx` または `BillingSection.tsx`

- [ ] **Step 1: PortalButton.tsx 作成**

`src/components/billing/PortalButton.tsx`:

```typescript
'use client';

import { useState } from 'react';

export const PortalButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal-session', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="border border-black px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {loading ? '読み込み中...' : 'お支払い情報を管理 ▶'}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};
```

- [ ] **Step 2: /account の Plan セクションに PortalButton を統合**

`src/app/account/page.tsx`（または分離されている `PlanSection.tsx`）の有料プラン表示部分に追加:

```tsx
import { PortalButton } from '@/components/billing/PortalButton';

// session.user.plan が 'starter' | 'pro' の時のみ表示
{(plan === 'starter' || plan === 'pro') && (
  <div className="mt-4">
    <PortalButton />
  </div>
)}
```

- [ ] **Step 3: ビルド + ローカル動作確認**

```bash
npm run build
npm run dev
```

http://localhost:3000/account → 「お支払い情報を管理」ボタン表示 → クリック → Stripe Customer Portal に遷移する。

- [ ] **Step 4: コミット**

```bash
git add src/components/billing/PortalButton.tsx src/app/account/
git commit -m "feat(account): integrate Customer Portal button"
```

---

## Task 27: PaymentFailedBanner.tsx + layout.tsx 常駐

**Files:**
- 作成: `src/components/billing/PaymentFailedBanner.tsx`
- 変更: `src/app/layout.tsx`

- [ ] **Step 1: PaymentFailedBanner.tsx 作成**

`src/components/billing/PaymentFailedBanner.tsx`:

```typescript
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PortalButton } from './PortalButton';

/**
 * Phase A.12: 支払い失敗の警告バナー
 *
 * - User.paymentFailedAt が立っているユーザーに表示
 * - layout.tsx 直下に置いて全ページ常駐
 * - Server Component（ログイン状態を auth() で取得）
 */
export const PaymentFailedBanner = async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { paymentFailedAt: true },
  });
  if (!user?.paymentFailedAt) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-4">
      <p className="text-sm">
        ⚠️ お支払いが失敗しました。Customer Portal で支払い方法を更新してください。
      </p>
      <PortalButton />
    </div>
  );
};
```

- [ ] **Step 2: layout.tsx に組み込み**

`src/app/layout.tsx`:

```tsx
import { PaymentFailedBanner } from '@/components/billing/PaymentFailedBanner';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <PaymentFailedBanner />
        {children}
      </body>
    </html>
  );
}
```

PortalButton は client component だが、PaymentFailedBanner は server component で OK（client component を子に持てる）。

- [ ] **Step 3: ビルド + 動作確認**

```bash
npm run build
npm run dev
```

prisma studio で自分の User を編集 → `paymentFailedAt` に手動で日時を入れる → ブラウザリロード → 全ページ上部に赤バナー表示。

- [ ] **Step 4: コミット**

```bash
git add src/components/billing/PaymentFailedBanner.tsx src/app/layout.tsx
git commit -m "feat(billing): add PaymentFailedBanner persistent in layout"
```

---

## Task 28: UpgradeCTAHeader.tsx + Header 統合

**Files:**
- 作成: `src/components/billing/UpgradeCTAHeader.tsx`
- 変更: `src/components/layout/Header.tsx`（既存推定）

- [ ] **Step 1: 既存 Header の構造確認**

```bash
ls src/components/layout/
cat src/components/layout/Header.tsx 2>/dev/null || echo "no Header"
```

Header コンポーネントが存在するか、UserMenu 周辺の配置を確認。なければ UserMenu 隣に直接配置。

- [ ] **Step 2: UpgradeCTAHeader.tsx 作成**

`src/components/billing/UpgradeCTAHeader.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { UpgradeModal } from '@/app/account/UpgradeModal'; // 既存推定

/**
 * Phase A.12: ヘッダー右上「⬆️ アップグレード」リンク
 *
 * - free / starter のみ表示
 * - pro / admin は非表示
 */
export const UpgradeCTAHeader = () => {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const plan = session?.user?.plan;
  if (!plan || plan === 'pro' || plan === 'admin') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-bold text-black hover:underline"
      >
        ⬆️ アップグレード
      </button>
      {open && <UpgradeModal onClose={() => setOpen(false)} />}
    </>
  );
};
```

注: `UpgradeModal` の export 名・props は既存に合わせる。閉じハンドラの prop 名（`onClose` / `onDismiss` 等）も既存に合わせる。

- [ ] **Step 3: Header に統合**

Header.tsx 内、UserMenu の左隣に `<UpgradeCTAHeader />` を配置:

```tsx
<div className="flex items-center gap-4">
  <UpgradeCTAHeader />
  <UserMenu />
</div>
```

- [ ] **Step 4: ビルド + 動作確認**

```bash
npm run build
npm run dev
```

ログイン状態（free）で http://localhost:3000 → ヘッダー右上に「⬆️ アップグレード」表示。クリック → UpgradeModal が開く。Pro に変更（DB を一時的に編集）してリロード → CTA が消える。

- [ ] **Step 5: コミット**

```bash
git add src/components/billing/UpgradeCTAHeader.tsx src/components/layout/Header.tsx
git commit -m "feat(layout): add UpgradeCTAHeader for free/starter users"
```

---

## Task 29: POST /api/billing/downgrade（Subscription Schedule で期末切替）

**Files:**
- 作成: `src/app/api/billing/downgrade/route.ts`

- [ ] **Step 1: downgrade route 作成**

`src/app/api/billing/downgrade/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStripeEnabled, getStripeClient } from '@/lib/billing/stripe-client';
import { getPlanPrices } from '@/lib/billing/prices';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Phase A.12: Pro → Starter ダウングレード（期末切替）
 *
 * - Subscription Schedule API で「現期間は Pro / 次期間から Starter」を予約
 * - Webhook (subscription.updated with schedule) を受けて planExpiresAt を反映
 * - 期末を迎えた時に schedule が apply され、自動的に subscription.updated が発火
 */
export const POST = async (): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeSubscriptionId || user.plan !== 'pro') {
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 400 });
  }

  const stripe = getStripeClient();
  const prices = getPlanPrices();

  try {
    // 現 subscription を schedule に変換 → 次期間で Starter に切替
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: user.stripeSubscriptionId,
    });

    // 取得した schedule に「次期間 = Starter」を追加
    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const periodEnd = sub.current_period_end;
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        {
          // 現フェーズ（Pro 維持、現 subscription の items をそのままコピー）
          items: sub.items.data.map((item) => ({
            price: item.price.id,
            quantity: item.price.recurring?.usage_type === 'metered' ? undefined : (item.quantity ?? 1),
          })),
          start_date: sub.current_period_start,
          end_date: periodEnd,
        },
        {
          // 次フェーズ: Starter 単独
          items: [{ price: prices.starter.basePriceId, quantity: 1 }],
        },
      ],
    });

    return NextResponse.json({ ok: true, scheduledFor: new Date(periodEnd * 1000) });
  } catch (e) {
    console.error('[downgrade] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
```

- [ ] **Step 2: ビルド**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/app/api/billing/downgrade/
git commit -m "feat(api): add POST /api/billing/downgrade with Subscription Schedule"
```

---

## Task 30: DowngradeButton.tsx + /account 統合

**Files:**
- 作成: `src/components/billing/DowngradeButton.tsx`
- 変更: `src/app/account/page.tsx` または PlanSection

- [ ] **Step 1: DowngradeButton.tsx 作成**

`src/components/billing/DowngradeButton.tsx`:

```typescript
'use client';

import { useState } from 'react';

export const DowngradeButton = () => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ scheduledFor: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!confirm('Pro → Starter へダウングレードします。次の請求日からの切替となり、それまでは Pro 機能を使えます。よろしいですか？')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/downgrade', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { scheduledFor: string };
      setDone(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <p className="text-sm text-gray-600">
        ✓ {new Date(done.scheduledFor).toLocaleDateString('ja-JP')} から Starter に切り替わります
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="text-sm text-gray-600 underline disabled:opacity-50"
      >
        {loading ? '処理中...' : 'Starter にダウングレードする'}
      </button>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};
```

- [ ] **Step 2: /account の Plan セクションに統合**

Pro プラン表示時のみボタンを表示:
```tsx
import { DowngradeButton } from '@/components/billing/DowngradeButton';

{plan === 'pro' && (
  <div className="mt-2">
    <DowngradeButton />
  </div>
)}
```

- [ ] **Step 3: ビルド + コミット**

```bash
npm run build
git add src/components/billing/DowngradeButton.tsx src/app/account/
git commit -m "feat(account): add DowngradeButton for Pro -> Starter"
```

---

## CP4 中間検証（Stripe Test Clock 活用）

- [ ] **Step 1: Stripe Test Clock 作成**

ターミナルで:
```bash
stripe test_helpers test_clocks create --frozen-time $(date +%s)
```

返ってきた `clock_xxx` ID をメモ。

- [ ] **Step 2: Test Clock 配下に Customer + Subscription を作る**

実際に手動で進める場合は Stripe Dashboard → Customers から新規 Customer を作成し、test_clock 配下に配置。Stripe CLI でも可:
```bash
# (Test Clock 経由のテストは複雑なので、本検証は通常の test mode + リアルタイム経過で行うのも可)
```

- [ ] **Step 3: ローカル E2E 検証**

stripe listen + npm run dev 起動後:
1. Free で Checkout → Pro 化（DB 反映確認）
2. /account の「お支払い情報を管理」→ Customer Portal で「解約」→ DB の planExpiresAt が current_period_end にセット、plan は 'pro' のまま
3. Customer Portal で「カード変更」→ Stripe 内で完結
4. /account の「Starter にダウングレード」→ 200 OK + アラート → DB の planExpiresAt セット
5. `stripe trigger invoice.payment_failed` → DB の paymentFailedAt セット → 全ページ赤バナー表示
6. `stripe trigger invoice.payment_succeeded` → paymentFailedAt クリア → バナー消える

OK なら CP5 へ。

---

# CP5: 月次サイクル統一

## Task 31: usage-counter.ts に Stripe 起点 reset 関数追加

**Files:**
- 変更: `src/lib/plans/usage-counter.ts`（既存推定）

- [ ] **Step 1: 既存 usage-counter.ts 確認**

```bash
ls src/lib/plans/
cat src/lib/plans/usage-counter.ts 2>/dev/null
```

既存の月初 lazy reset ロジックを把握。

- [ ] **Step 2: 月初 reset を「subscription なしのユーザーのみ」に分岐**

既存ロジックを以下のように変更（疑似コード、既存実装に合わせて適用）:

```typescript
// Phase A.12: subscription 持ち（Stripe 起点リセット）と無し（月初 lazy reset）で分岐
export const ensureUsageReset = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // subscription 持ち → Stripe 起点なので何もしない
  // （payment_succeeded webhook で usageCount=0, usageResetAt=次の current_period_end が設定される）
  if (user.stripeSubscriptionId && (user.plan === 'starter' || user.plan === 'pro')) {
    return;
  }

  // subscription なし（free / admin / 移行ユーザー）→ 既存の月初 lazy reset
  const now = new Date();
  if (!user.usageResetAt || now >= user.usageResetAt) {
    const nextResetAt = computeNextMonthFirstDay(now); // 既存ヘルパー想定
    await prisma.user.update({
      where: { id: userId },
      data: { usageCount: 0, usageResetAt: nextResetAt },
    });
  }
};
```

- [ ] **Step 3: ビルド + 動作確認**

```bash
npm run build
npm run dev
```

prisma studio で自分の User の `stripeSubscriptionId` を一時 NULL に → ブラウザでリロード → 月初 reset ロジックが動く。
`stripeSubscriptionId` を戻す → リロード → 月初 reset がスキップされる（Stripe 起点に任せる）。

- [ ] **Step 4: コミット**

```bash
git add src/lib/plans/usage-counter.ts
git commit -m "feat(plans): split usage reset by subscription presence (Stripe vs month-start)"
```

---

## Task 32: planExpiresAt 表示（解約予約 UI）

**Files:**
- 変更: `src/app/account/page.tsx` または PlanSection

- [ ] **Step 1: PlanSection に planExpiresAt 表示を追加**

該当の Plan セクション内（`plan` と `paymentFailedAt` を表示している既存箇所の近く）:

```tsx
{user.planExpiresAt && (
  <p className="text-sm text-gray-600 mt-2">
    {new Date(user.planExpiresAt).toLocaleDateString('ja-JP')} まで {plan.toUpperCase()}
    {/* 期限後の plan が分かるなら以下も追加可 */}
    {/* {nextPlan && ` → 以降 ${nextPlan.toUpperCase()}`} */}
  </p>
)}
```

注: `nextPlan`（次期 plan）は Stripe Subscription Schedule から推測する必要があるが、UI 上は「YYYY/MM/DD まで Pro」とだけ表示で十分（明示が必要なら別タスクで詳細化）。

- [ ] **Step 2: ビルド + コミット**

```bash
npm run build
git add src/app/account/
git commit -m "feat(account): show planExpiresAt for canceled/scheduled subscriptions"
```

---

## CP5 中間検証

- [ ] **Step 1: 月次サイクルの整合確認**

prisma studio:
- subscription 持ちユーザー: `usageResetAt` が `current_period_end` と一致
- 月初 reset 対象（free/admin）: `usageResetAt` が来月 1 日

OK なら CP6 へ。

---

# CP6: 本番モード移行 + 実購入検証

## Task 33: 本番 Stripe Dashboard セットアップ

**Files:**
- なし（Stripe ダッシュボード操作）

- [ ] **Step 1: Stripe ダッシュボードを「Live mode」に切替**

ダッシュボード上部のトグルを Live モードに切替。アカウント本人確認（KYC）が完了している必要あり。未完了なら必要書類を提出して完了させる。

- [ ] **Step 2: 本番でも Task 3〜5 と同じ設定を適用**

- 事業者情報（株式会社4th Avenue Lab）
- インボイス登録番号 T8010901045333
- Stripe Tax 有効化
- Products + Prices（Starter / Pro base / Pro metered）→ **新しい Price ID をメモ**（test mode と別）
- Promotion Code「FRIENDS」発行

- [ ] **Step 3: 本番 Webhook エンドポイント登録**

Developers → Webhooks → Add endpoint
- Endpoint URL: `https://autobanner.jp/api/billing/webhook`
- Events to send: 5 events
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Save

→ 「Signing secret」を表示してメモ（`whsec_xxx`）。これが本番用 STRIPE_WEBHOOK_SECRET。

- [ ] **Step 4: Customer Portal Configuration を Live mode で再設定**

Settings → Billing → Customer portal で Task 24 と同じ設定を適用。

---

## Task 34: Vercel env を live mode に切替

**Files:**
- なし（Vercel ダッシュボード操作）

- [ ] **Step 1: Production 環境の env を Live mode 用に上書き**

Vercel Settings → Environment Variables で以下を **Production のみ** Live mode の値に変更:
- STRIPE_SECRET_KEY: `sk_live_xxx`
- STRIPE_WEBHOOK_SECRET: 本番 webhook の `whsec_xxx`
- STRIPE_PRICE_STARTER: 本番 Price ID
- STRIPE_PRICE_PRO_BASE: 本番 Price ID
- STRIPE_PRICE_PRO_METERED: 本番 Price ID
- STRIPE_PROMO_FRIENDS: 本番 Promotion Code ID
- NEXT_PUBLIC_STRIPE_PRICE_STARTER: 本番 Price ID
- NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE: 本番 Price ID
- NEXT_PUBLIC_APP_URL: `https://autobanner.jp`

Preview / Development は test mode の値のまま。

- [ ] **Step 2: 本番デプロイ**

Vercel ダッシュボード → Deployments → Redeploy（または main ブランチへの merge を待つ）。

- [ ] **Step 3: 本番動作の事前ヘルスチェック**

```bash
curl -i https://autobanner.jp/api/billing/checkout-session -X POST
```

期待: 401 Unauthorized（auth 未通過、これが正しい）。500 が返る場合は env 不備の可能性大。

---

## Task 35: 自分のカードで Pro 購入検証

**Files:**
- なし

**注意:** 実費 ¥14,800 が発生します（後日 Customer Portal で解約予定）。

- [ ] **Step 1: 自分の Google アカウントでログイン**

https://autobanner.jp で str.kk.co@gmail.com でログイン。

- [ ] **Step 2: Pro Checkout 実行**

ヘッダー「⬆️ アップグレード」→ UpgradeModal → Pro Checkout → 自分の実カード入力 → 決済完了

- [ ] **Step 3: success_url に戻り、DB 反映確認**

prisma studio（本番 DB）で User を開き:
- plan: pro
- stripeCustomerId: 値あり
- stripeSubscriptionId: 値あり
- usageCount: 0
- usageResetAt: 約 1ヶ月後

- [ ] **Step 4: Stripe Invoice の確認**

Stripe ダッシュボード（Live mode）→ Invoices → 該当 Invoice を開く
- 顧客名・住所
- 適格請求書 番号 T8010901045333 が記載されている
- 税表示が「税込 ¥14,800（うち消費税 ¥1,345）」

PDF DL → 確認 OK ならスクリーンショットを保存。

- [ ] **Step 5: Customer Portal で解約予約**

/account → 「お支払い情報を管理」→ Stripe Portal → 解約 → 期末まで Pro 維持確認。

- [ ] **Step 6: prisma studio で planExpiresAt 確認**

planExpiresAt に current_period_end が入っていれば OK。

---

## Task 36: main マージ + タグ

**Files:**
- なし（git 操作のみ）

- [ ] **Step 1: 最終ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: 本番ビルド成功。

- [ ] **Step 2: main マージ**

```bash
git checkout main
git pull origin main
git merge --no-ff feat/phase-a12-billing -m "$(cat <<'EOF'
Merge: Phase A.12 Stripe Checkout + Webhook + Customer Portal

A.13 を併合した完全版を実装。
Stripe Tax + インボイス番号 T8010901045333 で適格請求書対応。

主な追加:
- DB: paymentFailedAt + WebhookEvent
- ライブラリ: stripe-client / prices / checkout / portal / plan-sync / idempotency
- Webhook handlers: checkout-completed / subscription-updated/deleted / payment-succeeded/failed
- API: checkout-session / portal-session / downgrade / webhook
- UI: CheckoutButton / PortalButton / DowngradeButton / PaymentFailedBanner / UpgradeCTAHeader
- 月次サイクルを Stripe current_period_end 起点に統一

実購入検証 OK（自分のカードで Pro 購入 → Invoice にインボイス番号記載確認）。

EOF
)"
```

- [ ] **Step 3: push + タグ**

```bash
git push origin main
git tag -a phase-a12-complete -m "Phase A.12 Stripe Checkout + Webhook + Customer Portal complete"
git push origin phase-a12-complete
```

- [ ] **Step 4: メモリ更新**

`C:\Users\strkk\.claude\projects\C--Users-strkk--claude\memory\project_banner_tsukurukun.md` に Phase A.12 完了の記述を追加（Phase A.11.5 と同じパターン）。

`MEMORY.md` の banner-tsukurukun エントリも「A.12 完了」を反映。

- [ ] **Step 5: Vercel デプロイ完了確認**

Vercel ダッシュボードで main へのマージに紐づく本番デプロイが成功していることを確認。

---

# 検証チェックリスト（実装完了時）

各項目に [x] を付ける。1 つでも漏れたら main マージしない。

- [ ] test mode で Free → Pro Checkout 完了 → DB plan=pro 反映 → Plan badge 即時更新
- [ ] URL `?promo=FRIENDS` で Pro 初月無料が Checkout 画面に適用済表示
- [ ] Customer Portal で支払い方法変更 → 動作
- [ ] Customer Portal で解約予約 → planExpiresAt セット → UI 表示
- [ ] /account で Pro→Starter ダウングレード → 期末切替予約 → UI 表示
- [ ] 期末到達で Starter に切替 OR free に戻る（Test Clock）
- [ ] `stripe trigger invoice.payment_failed` → 警告バナー表示
- [ ] `stripe trigger invoice.payment_succeeded` → バナー消える
- [ ] 同一 webhook event 2 回送信で 1 回だけ DB 更新（idempotency）
- [ ] 不正 signature の webhook 拒否（400）
- [ ] Stripe Invoice にインボイス番号 T8010901045333 記載
- [ ] 本番 Live mode で自分のカードで Pro 購入成功
- [ ] 本番で Customer Portal の解約予約完了

---

# Self-Review チェック

実装完了後、以下を確認:

1. **spec カバー漏れ**: spec 各セクションが対応するタスクで実装されているか
2. **placeholder スキャン**: 「TBD」「TODO」「後で」が残っていないか
3. **type 整合性**: 関数シグネチャ・プロパティ名が前後タスクで一致しているか
4. **未使用コード**: import / 関数 / フィールドで使われていないものがないか

## 実装プランは以上。

総タスク数: 36（Task 0 + Task 1〜36）。
予定工数: 8.5〜12 営業日。
