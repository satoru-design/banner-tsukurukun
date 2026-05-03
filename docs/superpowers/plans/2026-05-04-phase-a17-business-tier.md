# Phase A.17.0 Business Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro と Plan C の中間に Business プラン（¥39,800 / 1,000枠 / ¥40 メータード / ハードキャップ 3,000）を追加し、Pro maxed (¥46,800) からの自然なアップグレード経路を提供する。

**Architecture:** Phase A.12 の `plan-sync` 中核ロジックに Business plan を 1 enum 値追加 + Stripe Price 1 セット追加で吸収。Phase A.14 のメータード送信パターンを Business にも拡張（共通 meter `banner_generation_overage`、Subscription Item の Price で単価判定）。アップグレード導線は W（/account 常設カード）+ Y（生成画面リアルタイム通知）+ X（月次 Cron バナー）の 3 経路並行。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Prisma 6 / Neon Postgres / Stripe SDK ^22.1.0 / NextAuth.js v5 / Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-05-04-phase-a17-business-tier-design.md`

---

## 前提（既に完了している作業）

以下は本プラン着手前にすでに実施済み。タスクとして含めない:

- Stripe Business Product 作成（live + test）
- Business Base Price ¥39,800 / Metered Price ¥40 作成（live + test）
- FRIENDS coupon を amount_off=14800 へ rebuild（live + test）
- `scripts/stripe-live-ids.json` への ID 追記
- `.env` への test mode Price ID 追加
- Vercel production/preview env への live mode Business Price ID 反映

確認方法:
```bash
cat scripts/stripe-live-ids.json | jq 'keys' | grep -E "BUSINESS|FRIENDS"
grep STRIPE_PRICE_BUSINESS .env
```

---

## ファイル構造

### 新規作成（10 ファイル）

| パス | 役割 |
|---|---|
| `src/lib/billing/upgrade-detection.ts` | Business アップグレード推奨ロジック（Stripe Invoice からメータード超過抽出） |
| `src/lib/plans/overage-rates.ts` | plan → overage rate マッピング（pro: ¥80, business: ¥40） |
| `src/components/billing/BusinessPlanCard.tsx` | /account 常設の Business 切替カード（W） |
| `src/components/ironclad/UpgradeToBusinessBanner.tsx` | 生成画面 inline 通知（Y） |
| `src/components/account/BusinessUpgradeAccountBanner.tsx` | /account 動的バナー（X） |
| `scripts/check-business-upgrade-candidates.mjs` | 月初 Cron / Pro maxed 検知 / UpgradeNotice insert |
| `vercel.json` | Vercel Cron 設定（新規ファイル） |
| `prisma/migrations/20260504_phase_a17_business_tier/migration.sql` | DB マイグレーション |
| `tests/manual/phase-a17-business-tier.md` | 手動テスト手順書（test mode） |
| `docs/superpowers/plans/2026-05-04-phase-a17-business-tier.md` | このプラン |

### 変更（10 ファイル）

| パス | 変更内容 |
|---|---|
| `prisma/schema.prisma` | User に `upgradeNoticeShownAt` カラム / UpgradeNotice モデル追加 |
| `src/lib/plans/limits.ts` | USAGE_LIMIT_BUSINESS / USAGE_HARDCAP_BUSINESS / 各 record 拡張 |
| `src/lib/billing/prices.ts` | PlanKey に 'business' / Business priceId 取得 / 判定関数拡張 |
| `src/lib/billing/checkout.ts` | Business の 2-item subscription 構築 |
| `src/app/api/billing/checkout-session/route.ts` | （変更不要だが allow リスト拡張は prices.ts で吸収） |
| `src/app/api/billing/downgrade/route.ts` | Pro→Starter 専用 → 任意プラン降格対応 + Business→Pro 追加 |
| `src/app/api/ironclad-generate/route.ts` | Business の usageCount > 1000 時に meterEvents 送信 |
| `src/app/account/PlanSection.tsx` | BusinessPlanCard / BusinessUpgradeAccountBanner 統合 |
| `src/components/ironclad/IroncladGenerateScreen.tsx` | UpgradeToBusinessBanner 統合 / proLimit セッション内検知 |
| LP 料金表コンポーネント（場所は Task 14 で確定） | 3 列 → 4 列に拡張 |

---

## Task 1: DB スキーマ拡張

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260504_phase_a17_business_tier/migration.sql`

`User.plan` は String 型のため enum 変更不要。`upgradeNoticeShownAt` カラムと `UpgradeNotice` モデルのみ追加。

- [ ] **Step 1: schema.prisma に User.upgradeNoticeShownAt を追加**

`prisma/schema.prisma` の `model User` ブロック内、`paymentFailedAt` の次に追記:

```prisma
  /// Phase A.17.0: Business アップグレード推奨バナーの最終表示時刻
  /// /account の BusinessUpgradeAccountBanner の再表示制御に使用
  upgradeNoticeShownAt  DateTime?
```

- [ ] **Step 2: schema.prisma に UpgradeNotice モデルを追加**

`User` モデルの直後に新モデル追加:

```prisma
/// Phase A.17.0: アップグレード推奨履歴
/// 月次 Cron がメータード超過 Pro ユーザーを抽出して insert する
model UpgradeNotice {
  id              String    @id @default(cuid())
  userId          String
  type            String    // 'business_upgrade_recommendation'
  recommendedPlan String    // 'business'
  metricSnapshot  Json      // { avgOveragePerMonth: 12000, last3MonthsAvgUsage: 380, ... }
  createdAt       DateTime  @default(now())
  shownAt         DateTime?
  dismissedAt     DateTime?

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([type])
}
```

- [ ] **Step 3: User モデルに UpgradeNotice リレーション追加**

`model User` 内の他の relations と同じ場所に追記:

```prisma
  upgradeNotices  UpgradeNotice[]
```

- [ ] **Step 4: マイグレーション生成**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate dev --name phase_a17_business_tier --create-only
```

期待: `prisma/migrations/20260504_phase_a17_business_tier/migration.sql` が生成される。

- [ ] **Step 5: 生成された migration.sql を確認**

```bash
cat prisma/migrations/$(ls -1 prisma/migrations | tail -1)/migration.sql
```

期待: `ALTER TABLE "User" ADD COLUMN "upgradeNoticeShownAt"` と `CREATE TABLE "UpgradeNotice"` が含まれる。

- [ ] **Step 6: dev DB に適用**

```bash
npx prisma migrate dev
```

期待: dev branch に migration 適用、Prisma Client 自動再生成。

- [ ] **Step 7: 本番マイグレーション（既存 scripts/migrate-prod.mjs 利用）**

```bash
node scripts/migrate-prod.mjs
```

期待: production branch にも同 migration 適用。

- [ ] **Step 8: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功（Prisma Client が再生成されて新 model が型に乗る）。

- [ ] **Step 9: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): Phase A.17.0 add UpgradeNotice + User.upgradeNoticeShownAt"
```

---

## Task 2: plan limits 拡張

**Files:**
- Modify: `src/lib/plans/limits.ts`
- Create: `src/lib/plans/overage-rates.ts`

- [ ] **Step 1: limits.ts に Business 定数を追加**

`src/lib/plans/limits.ts` の既存定数の下に追記:

```typescript
/**
 * Phase A.17.0: Business plan 上限
 * - Business: 1,000 回/月（1,001 回目以降は ¥40/枠 でメータード課金）
 * - Hardcap: 3,000 回（コスト爆発防止 / 超過は Plan C 案内）
 */
export const USAGE_LIMIT_BUSINESS = 1000;
export const USAGE_HARDCAP_BUSINESS = 3000;
```

- [ ] **Step 2: PLAN_USAGE_LIMITS に business 行を追加**

既存の Record 定義を更新:

```typescript
export const PLAN_USAGE_LIMITS: Record<string, number> = {
  free: USAGE_LIMIT_FREE,
  starter: 30,
  pro: USAGE_LIMIT_PRO,
  business: USAGE_LIMIT_BUSINESS,
  admin: Number.POSITIVE_INFINITY,
};
```

- [ ] **Step 3: PLAN_HARDCAP に business 行を追加**

```typescript
export const PLAN_HARDCAP: Record<string, number> = {
  free: USAGE_HARDCAP_FREE,
  starter: 30,
  pro: USAGE_HARDCAP_PRO,
  business: USAGE_HARDCAP_BUSINESS,
  admin: Number.POSITIVE_INFINITY,
};
```

- [ ] **Step 4: overage-rates.ts を新規作成**

ファイルパス: `src/lib/plans/overage-rates.ts`

```typescript
/**
 * Phase A.17.0: plan → メータード超過単価（円）
 *
 * 表示用定数（Stripe 側の Price で実際の課金単価が決まるため、
 * このマッピングはあくまで UI 表示用）。
 */
export const PLAN_OVERAGE_RATE_JPY: Record<string, number> = {
  pro: 80,
  business: 40,
};

export function getOverageRate(plan: string): number {
  return PLAN_OVERAGE_RATE_JPY[plan] ?? 0;
}
```

- [ ] **Step 5: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 6: コミット**

```bash
git add src/lib/plans/limits.ts src/lib/plans/overage-rates.ts
git commit -m "feat(plans): add Business plan limits + overage rate constants"
```

---

## Task 3: prices.ts 拡張

**Files:**
- Modify: `src/lib/billing/prices.ts`

`PlanKey` 型に 'business' を追加。`getPlanPrices` で Business 用 env 読み取り。`isAllowedBasePriceId` / `getPlanFromPriceId` を Business 対応化。

- [ ] **Step 1: PlanKey 型拡張**

`src/lib/billing/prices.ts` を全面置き換え:

```typescript
/**
 * Phase A.12 / A.17.0: Stripe Price ID マッピング
 *
 * - 本ファイルは Price ID を「許可リスト」として明示することで、
 *   Checkout API で任意 priceId を受け取って成立しないように防衛する
 */

export type PlanKey = 'starter' | 'pro' | 'business';

export interface PlanPriceConfig {
  basePriceId: string;
  meteredPriceId?: string;
}

export const getPlanPrices = (): Record<PlanKey, PlanPriceConfig> => {
  const starter = process.env.STRIPE_PRICE_STARTER;
  const proBase = process.env.STRIPE_PRICE_PRO_BASE;
  const proMetered = process.env.STRIPE_PRICE_PRO_METERED;
  const businessBase = process.env.STRIPE_PRICE_BUSINESS_BASE;
  const businessMetered = process.env.STRIPE_PRICE_BUSINESS_METERED;
  if (!starter || !proBase) {
    throw new Error(
      'Missing Stripe Price ID env vars (STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO_BASE)'
    );
  }
  if (!businessBase) {
    throw new Error('Missing STRIPE_PRICE_BUSINESS_BASE env var');
  }
  return {
    starter: { basePriceId: starter },
    pro: { basePriceId: proBase, meteredPriceId: proMetered || undefined },
    business: { basePriceId: businessBase, meteredPriceId: businessMetered || undefined },
  };
};

export const isAllowedBasePriceId = (priceId: string): boolean => {
  const config = getPlanPrices();
  return (
    priceId === config.starter.basePriceId ||
    priceId === config.pro.basePriceId ||
    priceId === config.business.basePriceId
  );
};

export const getPlanFromPriceId = (priceId: string): PlanKey | null => {
  const config = getPlanPrices();
  if (priceId === config.starter.basePriceId) return 'starter';
  if (priceId === config.pro.basePriceId) return 'pro';
  if (priceId === config.business.basePriceId) return 'business';
  return null;
};
```

- [ ] **Step 2: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。Business env が `.env` と Vercel に既にあるため、ランタイム throw も発生しないはず。

- [ ] **Step 3: コミット**

```bash
git add src/lib/billing/prices.ts
git commit -m "feat(billing): extend PlanKey to include business + Stripe Business price config"
```

---

## Task 4: checkout.ts で Business の 2-item subscription を構築

**Files:**
- Modify: `src/lib/billing/checkout.ts`

既存は `plan === 'pro'` 時のみ metered を追加。Business も同じパターンで対応。

- [ ] **Step 1: plan-specific metered 追加ロジックを汎用化**

`src/lib/billing/checkout.ts` の line 52-59 を以下に置き換え:

```typescript
  // Stripe v22 では SessionCreateParams が type alias のため .LineItem サブ型に直接アクセス不可。
  // SessionCreateParams['line_items'] の要素型として推論させる。
  type LineItem = NonNullable<Stripe.Checkout.SessionCreateParams['line_items']>[number];
  const lineItems: LineItem[] = [
    { price: input.basePriceId, quantity: 1 },
  ];
  // Pro / Business は base + metered の 2-item subscription（A.12 / A.17.0）
  if (plan === 'pro' && prices.pro.meteredPriceId) {
    lineItems.push({ price: prices.pro.meteredPriceId });
    // metered は quantity 指定不可（usage_records で送る）
  }
  if (plan === 'business' && prices.business.meteredPriceId) {
    lineItems.push({ price: prices.business.meteredPriceId });
  }
```

- [ ] **Step 2: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 3: コミット**

```bash
git add src/lib/billing/checkout.ts
git commit -m "feat(billing): support Business plan in createCheckoutSession (base + metered)"
```

---

## Task 5: downgrade route を任意プラン対応化

**Files:**
- Modify: `src/app/api/billing/downgrade/route.ts`

既存は Pro → Starter 専用ハードコード。Business → Pro / Pro → Starter / Business → Starter を扱えるように拡張。

- [ ] **Step 1: route.ts を全面置き換え**

`src/app/api/billing/downgrade/route.ts` を以下に置き換え:

```typescript
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { isStripeEnabled, getStripeClient } from '@/lib/billing/stripe-client';
import { getPlanPrices, type PlanKey } from '@/lib/billing/prices';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface RequestBody {
  /** ターゲットプラン。指定しない場合は legacy 挙動（Pro→Starter） */
  targetPlan?: 'starter' | 'pro';
}

/**
 * Phase A.12 / A.17.0: 任意プラン降格（期末切替予約）
 *
 * 許可される遷移:
 *   pro      → starter
 *   business → pro
 *   business → starter
 *
 * Subscription Schedule API で「現期間は現プラン / 次期間からターゲットプラン」を予約。
 * Webhook (subscription.updated with schedule) を受けて planExpiresAt 反映。
 */
export const POST = async (req: Request): Promise<Response> => {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;

  try {
    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Active subscription required' },
        { status: 400 }
      );
    }

    const currentPlan = dbUser.plan as PlanKey | 'free' | 'admin';
    // legacy fallback: targetPlan 未指定で plan=pro のときだけ pro→starter
    const targetPlan: PlanKey =
      body.targetPlan ?? (currentPlan === 'pro' ? 'starter' : (currentPlan as PlanKey));

    // 許可される遷移チェック
    const allowedTransitions: Record<string, PlanKey[]> = {
      pro: ['starter'],
      business: ['pro', 'starter'],
    };
    const allowed = allowedTransitions[currentPlan];
    if (!allowed || !allowed.includes(targetPlan)) {
      return NextResponse.json(
        { error: `Downgrade ${currentPlan} → ${targetPlan} is not supported` },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const prices = getPlanPrices();

    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: dbUser.stripeSubscriptionId,
    });

    const sub = await stripe.subscriptions.retrieve(dbUser.stripeSubscriptionId);
    const baseItem = sub.items.data.find(
      (item) => item.price.recurring?.usage_type === 'licensed'
    );
    if (!baseItem) {
      return NextResponse.json({ error: 'Base item not found' }, { status: 500 });
    }
    const periodStart = baseItem.current_period_start;
    const periodEnd = baseItem.current_period_end;

    // 現フェーズ items（今の subscription をそのまま継続）
    const currentPhaseItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] =
      sub.items.data.map((item) => {
        const isMetered = item.price.recurring?.usage_type === 'metered';
        return isMetered
          ? { price: item.price.id }
          : { price: item.price.id, quantity: item.quantity ?? 1 };
      });

    // 次フェーズ items（ターゲットプラン）
    const targetConfig = prices[targetPlan];
    const nextPhaseItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] = [
      { price: targetConfig.basePriceId, quantity: 1 },
    ];
    if (targetConfig.meteredPriceId) {
      nextPhaseItems.push({ price: targetConfig.meteredPriceId });
    }

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        {
          items: currentPhaseItems,
          start_date: periodStart,
          end_date: periodEnd,
        },
        {
          items: nextPhaseItems,
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      targetPlan,
      scheduledFor: new Date(periodEnd * 1000).toISOString(),
    });
  } catch (e) {
    console.error('[downgrade] error:', e);
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'resource_already_exists'
    ) {
      return NextResponse.json(
        { error: 'ダウングレードはすでに予約済みです' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
};
```

- [ ] **Step 2: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 3: コミット**

```bash
git add src/app/api/billing/downgrade/route.ts
git commit -m "feat(billing): generalize downgrade API to support business→pro/starter"
```

---

## Task 6: ironclad-generate に Business メータード送信を追加

**Files:**
- Modify: `src/app/api/ironclad-generate/route.ts`

既存は `plan === 'pro' && newUsageCount > USAGE_LIMIT_PRO` で meterEvents 送信。Business も同条件で送信。

- [ ] **Step 1: route.ts の usage 判定ロジック確認**

```bash
grep -n "USAGE_LIMIT_PRO\|sendMeteredUsage\|newUsageCount" src/app/api/ironclad-generate/route.ts
```

期待: line 238 付近に既存ロジック確認。

- [ ] **Step 2: USAGE_LIMIT_BUSINESS を import に追加**

`src/app/api/ironclad-generate/route.ts` の line 11（既存 import）を以下に置き換え:

```typescript
import { USAGE_LIMIT_FREE, USAGE_LIMIT_PRO, USAGE_LIMIT_BUSINESS, getHardcap } from '@/lib/plans/limits';
```

- [ ] **Step 3: メータード送信条件分岐を追加**

既存の Pro メータード送信ブロック（line 238 付近）を確認:

```bash
grep -n -A 15 "newUsageCount > USAGE_LIMIT_PRO" src/app/api/ironclad-generate/route.ts | head -20
```

- [ ] **Step 4: Pro 条件の直後に Business 条件を追加**

該当ブロックの直後（`}` の次行）に以下を挿入:

```typescript
        // Phase A.17.0: Business plan のメータード送信（同 meter / 単価は Stripe Price で決まる）
        if (
          dbUser.plan === 'business' &&
          dbUser.stripeCustomerId &&
          newUsageCount > USAGE_LIMIT_BUSINESS
        ) {
          try {
            await sendMeteredUsage(dbUser.stripeCustomerId, generation.id);
          } catch (e) {
            console.error('[ironclad-generate] meterEvents failed (business):', e);
          }
        }
```

注意: `sendMeteredUsage` の signature は既存パターン踏襲（Pro と同じ呼出）。Stripe meter は plan 共通だが、Subscription Item の Price で単価が決まるため、Stripe 側で自動的に Business なら ¥40、Pro なら ¥80 として課金される。

- [ ] **Step 5: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 6: コミット**

```bash
git add src/app/api/ironclad-generate/route.ts
git commit -m "feat(billing): send meterEvents for Business overage (>1000/month)"
```

---

## Task 7: BusinessPlanCard コンポーネント（W: ベースライン）

**Files:**
- Create: `src/components/billing/BusinessPlanCard.tsx`

/account の PlanSection に常設で表示するカード。現プランに応じて挙動が変わる:
- free / starter: 「Pro / Business から選んでアップグレード」（Business を強調）
- pro: 「Business にアップグレード」ボタン
- business: 「現在のプラン」表示 + downgrade ボタン
- admin: 表示しない

- [ ] **Step 1: コンポーネント新規作成**

ファイルパス: `src/components/billing/BusinessPlanCard.tsx`

```typescript
'use client';

import { useState } from 'react';
import type { CurrentUser } from '@/lib/auth/get-current-user';
import { CheckoutButton } from './CheckoutButton';
import { DowngradeButton } from './DowngradeButton';
import { USAGE_LIMIT_BUSINESS, USAGE_HARDCAP_BUSINESS } from '@/lib/plans/limits';
import { getOverageRate } from '@/lib/plans/overage-rates';

interface Props {
  user: CurrentUser;
}

/**
 * Phase A.17.0 W (baseline): /account 常設の Business プラン切替カード
 *
 * - free/starter/pro: Business アップグレード CTA を表示
 * - business: 「現在のプラン」表示 + Pro へのダウングレードボタン
 * - admin: 表示しない
 */
export function BusinessPlanCard({ user }: Props) {
  if (user.plan === 'admin') return null;

  const businessBasePriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE;
  if (!businessBasePriceId) return null;

  const isBusiness = user.plan === 'business';
  const overageRate = getOverageRate('business');

  return (
    <div className="rounded-lg border border-emerald-700/40 bg-gradient-to-br from-emerald-950/40 to-slate-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-emerald-300">
            🚀 Business プラン
            {isBusiness && (
              <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-emerald-500 text-white">
                現在のプラン
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">広告代理店・中堅 EC 運用部隊向け</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">¥39,800</div>
          <div className="text-xs text-slate-500">/ 月（税込）</div>
        </div>
      </div>

      <ul className="text-sm text-slate-300 space-y-1 mb-4">
        <li>✅ {USAGE_LIMIT_BUSINESS.toLocaleString()} 枠 / 月（Pro の 10 倍）</li>
        <li>✅ 超過分は ¥{overageRate}/枠（Pro の半額）</li>
        <li>✅ 上限 {USAGE_HARDCAP_BUSINESS.toLocaleString()} 枠まで利用可能</li>
        <li>✅ 全 17 サイズ・複数スタイル並列生成</li>
        <li className="text-slate-500 text-xs pt-1">
          🔜 クライアント別フォルダ / 拡張 Brand Kit / 一括 ZIP DL は順次提供
        </li>
      </ul>

      {isBusiness ? (
        <DowngradeButton targetPlan="pro" label="Pro にダウングレード（期末切替）" />
      ) : (
        <CheckoutButton
          basePriceId={businessBasePriceId}
          label={user.plan === 'pro' ? 'Business にアップグレード' : 'Business で始める'}
          variant="primary"
        />
      )}

      <p className="text-xs text-slate-500 mt-3">
        💡 より大規模・年契約・SLA をご希望なら
        <a href="https://autobanner.jp/lp01#contact" className="underline ml-1">
          Plan C のお問い合わせへ
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 既存 DowngradeButton の signature 確認**

```bash
grep -n "props\|interface\|targetPlan\|label" src/components/billing/DowngradeButton.tsx | head -15
```

期待: 既存 DowngradeButton が `targetPlan` / `label` props を受け取れるか確認。受け取れない場合は次の Step で更新。

- [ ] **Step 3: DowngradeButton に targetPlan / label props を追加（必要なら）**

既存の DowngradeButton は Pro→Starter 固定の可能性が高い。汎用化のため `props.targetPlan` / `props.label` を受け取って fetch body に含める形に修正:

`src/components/billing/DowngradeButton.tsx` を全面置き換え:

```typescript
'use client';

import { useState } from 'react';

interface Props {
  targetPlan?: 'starter' | 'pro';
  label?: string;
}

export function DowngradeButton({ targetPlan, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonLabel = label ?? 'Starter にダウングレード（期末切替）';

  const handleClick = async () => {
    if (!confirm(`${buttonLabel}\n期末（次回更新日）から切り替わります。よろしいですか？`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'ダウングレードに失敗しました');
      }
      alert(`ダウングレードを予約しました。${new Date(data.scheduledFor).toLocaleDateString('ja-JP')} から切り替わります。`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleClick}
        className="px-4 py-2 text-sm font-medium rounded border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? '処理中...' : buttonLabel}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 5: コミット**

```bash
git add src/components/billing/BusinessPlanCard.tsx src/components/billing/DowngradeButton.tsx
git commit -m "feat(billing): add BusinessPlanCard component (W baseline) + parametrize DowngradeButton"
```

---

## Task 8: PlanSection に BusinessPlanCard を統合

**Files:**
- Modify: `src/app/account/PlanSection.tsx`

- [ ] **Step 1: import 追加**

`src/app/account/PlanSection.tsx` の既存 import 群に追記:

```typescript
import { BusinessPlanCard } from '@/components/billing/BusinessPlanCard';
```

- [ ] **Step 2: PlanSection の render 末尾（return JSX 内）に BusinessPlanCard を追加**

既存の最後の閉じタグ `</section>` の直前に追記:

```tsx
        {/* Phase A.17.0: Business プラン切替カード（常設） */}
        <BusinessPlanCard user={user} />
```

- [ ] **Step 3: TypeScript ビルド通過確認 + lint**

```bash
npm run build && npm run lint
```

期待: 両方成功。

- [ ] **Step 4: コミット**

```bash
git add src/app/account/PlanSection.tsx
git commit -m "feat(account): integrate BusinessPlanCard in PlanSection"
```

---

## Task 9: UpgradeToBusinessBanner コンポーネント（Y: inline 通知）

**Files:**
- Create: `src/components/ironclad/UpgradeToBusinessBanner.tsx`

1 セッション内で Pro 100 枠を使い切った瞬間に表示する inline バナー。

- [ ] **Step 1: コンポーネント新規作成**

ファイルパス: `src/components/ironclad/UpgradeToBusinessBanner.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { USAGE_LIMIT_PRO } from '@/lib/plans/limits';
import { getOverageRate } from '@/lib/plans/overage-rates';

interface Props {
  /** 現在 Pro plan か（free/starter/admin/business では出さない） */
  isPro: boolean;
  /** このセッションで Pro 100 枠を使い切ったか */
  proLimitReachedInSession: boolean;
  /** このセッションでの生成枚数（バナー文言に使用） */
  sessionGenerationCount?: number;
}

const DISMISS_KEY = 'businessUpgradeBannerDismissedAt';

/**
 * Phase A.17.0 Y: 1 セッション内で Pro 100 枠を使い切った時に出る inline 通知
 *
 * - localStorage で同月内 dismissed なら非表示
 * - クリックで /account#plan へ遷移（BusinessPlanCard へ）
 */
export function UpgradeToBusinessBanner({ isPro, proLimitReachedInSession, sessionGenerationCount = 0 }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const date = new Date(dismissedAt);
      const now = new Date();
      // 同月内なら非表示維持
      if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
        setDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, []);

  if (!isPro || !proLimitReachedInSession || dismissed) return null;

  const proRate = getOverageRate('pro');
  const businessRate = getOverageRate('business');
  // 現セッションの生成数を仮にそのまま月次推定として表示
  const overageInSession = Math.max(0, sessionGenerationCount - USAGE_LIMIT_PRO);
  const proExtraCost = overageInSession * proRate;
  const businessSavings = proExtraCost - overageInSession * businessRate;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setDismissed(true);
  };

  return (
    <div className="rounded-lg border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 to-slate-900 p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🚀</span>
        <div className="flex-1">
          <h4 className="font-semibold text-emerald-300 mb-1">
            このセッションで Pro {USAGE_LIMIT_PRO} 枠を使い切りました
          </h4>
          <p className="text-sm text-slate-300">
            この調子で運用すると、Business プラン（月 ¥39,800 / 1,000 枠）の方が
            <strong className="text-emerald-300">最大 ¥{businessSavings.toLocaleString()} お得</strong>
            になります。
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href="/account#plan"
              className="inline-block px-4 py-2 text-sm font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Business を見る
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              今月は表示しない
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 3: コミット**

```bash
git add src/components/ironclad/UpgradeToBusinessBanner.tsx
git commit -m "feat(ironclad): add UpgradeToBusinessBanner component (Y inline)"
```

---

## Task 10: IroncladGenerateScreen に UpgradeToBusinessBanner を統合

**Files:**
- Modify: `src/components/ironclad/IroncladGenerateScreen.tsx`

- [ ] **Step 1: 現状の usageCount 関連 state を確認**

```bash
grep -n "usageCount\|USAGE_LIMIT_PRO\|sessionGenerated" src/components/ironclad/IroncladGenerateScreen.tsx | head -15
```

- [ ] **Step 2: import 追加**

```typescript
import { UpgradeToBusinessBanner } from './UpgradeToBusinessBanner';
import { USAGE_LIMIT_PRO } from '@/lib/plans/limits';
```

- [ ] **Step 3: セッション内生成数を track する state を追加**

`IroncladGenerateScreen` のコンポーネント関数内、既存 useState 群の最後に追記:

```typescript
  // Phase A.17.0 Y: セッション内累計生成数（マウント時 0、生成成功ごとに +1）
  const [sessionGeneratedCount, setSessionGeneratedCount] = useState(0);
  // Phase A.17.0 Y: セッション内で Pro 上限到達したか（一度 true になったら維持）
  const [proLimitReachedInSession, setProLimitReachedInSession] = useState(false);
```

- [ ] **Step 4: 生成成功時のハンドラを更新**

既存の生成成功処理（results に push する箇所）の直後に追記:

```typescript
        // Phase A.17.0 Y: セッション内カウント + Pro 上限検知
        setSessionGeneratedCount((c) => {
          const next = c + 1;
          if (user.plan === 'pro' && next + user.usageCount > USAGE_LIMIT_PRO) {
            setProLimitReachedInSession(true);
          }
          return next;
        });
```

注: 既存コードで `user.usageCount` がどう取得されているかに依存。`user` prop か session から取れているはず。取得方法が違う場合は CurrentUser 経由で受け取り直す。

- [ ] **Step 5: render JSX に Banner を追加**

`IroncladGenerateScreen` の return JSX 内、マトリクス（results 表示）の直前に追記:

```tsx
      <UpgradeToBusinessBanner
        isPro={user.plan === 'pro'}
        proLimitReachedInSession={proLimitReachedInSession}
        sessionGenerationCount={sessionGeneratedCount + user.usageCount}
      />
```

- [ ] **Step 6: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 7: コミット**

```bash
git add src/components/ironclad/IroncladGenerateScreen.tsx
git commit -m "feat(ironclad): integrate UpgradeToBusinessBanner with proLimitReachedInSession detection"
```

---

## Task 11: 月次 Cron スクリプト（X 検知ロジック）

**Files:**
- Create: `scripts/check-business-upgrade-candidates.mjs`
- Create: `vercel.json`

過去 3 ヶ月の Pro メータード超過 ¥10,000/月平均ユーザーを抽出し、UpgradeNotice に insert。

- [ ] **Step 1: Cron スクリプト新規作成**

ファイルパス: `scripts/check-business-upgrade-candidates.mjs`

```javascript
#!/usr/bin/env node
/**
 * Phase A.17.0 X: 月初 Cron - Business プラン推奨候補を検知
 *
 * 対象: plan='pro' で過去 3 ヶ月の Stripe メータード超過合計が
 *       平均 ¥10,000/月 以上のユーザー
 *
 * 出力: UpgradeNotice テーブルに type='business_upgrade_recommendation' を insert
 *
 * Usage:
 *   node scripts/check-business-upgrade-candidates.mjs --dry-run
 *   node scripts/check-business-upgrade-candidates.mjs
 *
 * Vercel Cron で月初 1 日 00:00 JST に実行（vercel.json で設定）
 */
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const dryRun = !!args['dry-run'];
const THRESHOLD_JPY = 10000; // 月平均 ¥10,000 超のメータードがあれば推奨

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();
const PRO_METERED_PRICE_ID = process.env.STRIPE_PRICE_PRO_METERED;

async function main() {
  console.log(`[check-business-upgrade] ${dryRun ? 'DRY-RUN' : 'EXECUTE'} mode`);

  if (!PRO_METERED_PRICE_ID) {
    console.error('STRIPE_PRICE_PRO_METERED env required');
    process.exit(1);
  }

  // 1. Pro ユーザー取得
  const proUsers = await prisma.user.findMany({
    where: { plan: 'pro', stripeCustomerId: { not: null } },
    select: { id: true, email: true, stripeCustomerId: true, upgradeNoticeShownAt: true },
  });
  console.log(`[1/3] Found ${proUsers.length} Pro users`);

  // 2. 各ユーザーの過去 3 ヶ月 invoice line items から PRO_METERED の合計を集計
  const candidates = [];
  const threeMonthsAgoTs = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

  for (const u of proUsers) {
    let totalMeteredJpy = 0;
    let invoiceCount = 0;
    const invoices = stripe.invoices.list({
      customer: u.stripeCustomerId,
      created: { gte: threeMonthsAgoTs },
      status: 'paid',
      limit: 12,
    });
    for await (const inv of invoices) {
      invoiceCount++;
      for (const line of inv.lines?.data ?? []) {
        if (line.price?.id === PRO_METERED_PRICE_ID) {
          totalMeteredJpy += line.amount; // JPY は最小単位 = 1円
        }
      }
    }
    if (invoiceCount === 0) continue;
    const avgMonthly = Math.round(totalMeteredJpy / Math.max(1, invoiceCount));
    if (avgMonthly >= THRESHOLD_JPY) {
      candidates.push({
        userId: u.id,
        email: u.email,
        avgOveragePerMonth: avgMonthly,
        invoiceCount,
        totalMeteredJpy,
      });
    }
  }
  console.log(`[2/3] Found ${candidates.length} candidates exceeding ¥${THRESHOLD_JPY}/month avg`);

  if (dryRun) {
    console.log('--- DRY-RUN candidates ---');
    for (const c of candidates) {
      console.log(`  ${c.email}: avg ¥${c.avgOveragePerMonth}/月 (over ${c.invoiceCount} invoices)`);
    }
    return;
  }

  // 3. 各候補に対して UpgradeNotice insert（直近 30 日以内に同種 notice あればスキップ）
  let inserted = 0;
  let skipped = 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (const c of candidates) {
    const recent = await prisma.upgradeNotice.findFirst({
      where: {
        userId: c.userId,
        type: 'business_upgrade_recommendation',
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    if (recent) {
      skipped++;
      continue;
    }
    await prisma.upgradeNotice.create({
      data: {
        userId: c.userId,
        type: 'business_upgrade_recommendation',
        recommendedPlan: 'business',
        metricSnapshot: {
          avgOveragePerMonth: c.avgOveragePerMonth,
          invoiceCount: c.invoiceCount,
          totalMeteredJpy: c.totalMeteredJpy,
          threshold: THRESHOLD_JPY,
          generatedAt: new Date().toISOString(),
        },
      },
    });
    // upgradeNoticeShownAt は表示時にユーザー操作で更新される（ここでは触らない）
    inserted++;
  }

  console.log(`[3/3] Inserted ${inserted} notices, skipped ${skipped} (recent)`);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: dry-run でローカル検証**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
node scripts/check-business-upgrade-candidates.mjs --dry-run
```

期待: 「Found N Pro users」「Found 0 candidates」程度の出力（live mode で実際の課金履歴があれば対象が出る）。エラーが出ないこと。

- [ ] **Step 3: vercel.json を新規作成（Cron 登録）**

ファイルパス: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/check-business-upgrade",
      "schedule": "0 15 1 * *"
    }
  ]
}
```

注: Vercel Cron は cron スクリプトを直接実行できないため、API route 経由で呼び出す。`0 15 1 * *` = UTC 15:00 = JST 00:00 毎月 1 日。

- [ ] **Step 4: スクリプトロジックを再利用可能な TS lib 関数に切り出し**

Vercel Serverless ではスクリプトを子プロセスとして起動できないため、ロジックを TS lib として切り出して HTTP route と CLI 両方から呼び出せるようにする。

ファイルパス: `src/lib/billing/upgrade-detection.ts`

```typescript
import { getStripeClient } from './stripe-client';
import { getPrisma } from '@/lib/prisma';

const THRESHOLD_JPY = 10000;

export async function detectBusinessUpgradeCandidates(opts: { dryRun?: boolean } = {}) {
  const { dryRun = false } = opts;
  const stripe = getStripeClient();
  const prisma = getPrisma();
  const proMeteredPriceId = process.env.STRIPE_PRICE_PRO_METERED;
  if (!proMeteredPriceId) throw new Error('STRIPE_PRICE_PRO_METERED required');

  const proUsers = await prisma.user.findMany({
    where: { plan: 'pro', stripeCustomerId: { not: null } },
    select: { id: true, email: true, stripeCustomerId: true },
  });

  const candidates: Array<{
    userId: string;
    email: string | null;
    avgOveragePerMonth: number;
    invoiceCount: number;
    totalMeteredJpy: number;
  }> = [];
  const threeMonthsAgoTs = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

  for (const u of proUsers) {
    if (!u.stripeCustomerId) continue;
    let totalMeteredJpy = 0;
    let invoiceCount = 0;
    const invoices = stripe.invoices.list({
      customer: u.stripeCustomerId,
      created: { gte: threeMonthsAgoTs },
      status: 'paid',
      limit: 12,
    });
    for await (const inv of invoices) {
      invoiceCount++;
      for (const line of inv.lines?.data ?? []) {
        if (line.price?.id === proMeteredPriceId) {
          totalMeteredJpy += line.amount;
        }
      }
    }
    if (invoiceCount === 0) continue;
    const avgMonthly = Math.round(totalMeteredJpy / Math.max(1, invoiceCount));
    if (avgMonthly >= THRESHOLD_JPY) {
      candidates.push({
        userId: u.id,
        email: u.email,
        avgOveragePerMonth: avgMonthly,
        invoiceCount,
        totalMeteredJpy,
      });
    }
  }

  if (dryRun) return { candidates, inserted: 0, skipped: 0, dryRun: true };

  let inserted = 0,
    skipped = 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (const c of candidates) {
    const recent = await prisma.upgradeNotice.findFirst({
      where: {
        userId: c.userId,
        type: 'business_upgrade_recommendation',
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    if (recent) {
      skipped++;
      continue;
    }
    await prisma.upgradeNotice.create({
      data: {
        userId: c.userId,
        type: 'business_upgrade_recommendation',
        recommendedPlan: 'business',
        metricSnapshot: {
          avgOveragePerMonth: c.avgOveragePerMonth,
          invoiceCount: c.invoiceCount,
          totalMeteredJpy: c.totalMeteredJpy,
          threshold: THRESHOLD_JPY,
          generatedAt: new Date().toISOString(),
        },
      },
    });
    inserted++;
  }
  return { candidates, inserted, skipped, dryRun: false };
}
```

- [ ] **Step 6: route.ts を更新して lib 関数を使用**

`src/app/api/cron/check-business-upgrade/route.ts` を以下に置き換え:

```typescript
import { NextResponse } from 'next/server';
import { detectBusinessUpgradeCandidates } from '@/lib/billing/upgrade-detection';

export const maxDuration = 300;
export const runtime = 'nodejs';

export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await detectBusinessUpgradeCandidates();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron/check-business-upgrade] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
```

- [ ] **Step 7: CRON_SECRET を Vercel env に設定**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
node scripts/vercel-set-env.mjs CRON_SECRET $(openssl rand -hex 32) production preview --sensitive
```

期待: ✅ POST CRON_SECRET = ... が表示される。

- [ ] **Step 8: 二重メンテ承知（CLI script + TS lib）**

`scripts/check-business-upgrade-candidates.mjs`（CLI、純 JS）と `src/lib/billing/upgrade-detection.ts`（HTTP route 経由、TS）はロジックが重複している。Cron 動作の Single Source of Truth は HTTP route 側、CLI は手動 dry-run 用の補助。今後ロジック変更時は両方更新が必要。

- [ ] **Step 9: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 10: コミット**

```bash
git add scripts/check-business-upgrade-candidates.mjs vercel.json src/app/api/cron/check-business-upgrade/route.ts src/lib/billing/upgrade-detection.ts
git commit -m "feat(billing): Business upgrade detection cron + lib + Vercel cron config"
```

---

## Task 12: BusinessUpgradeAccountBanner コンポーネント（X: 月次バナー）

**Files:**
- Create: `src/components/account/BusinessUpgradeAccountBanner.tsx`

サーバーコンポーネントで `UpgradeNotice` を読み取って表示。dismiss 時にクライアントから `User.upgradeNoticeShownAt` 更新 API を叩く。

- [ ] **Step 1: dismiss API を作成**

ファイルパス: `src/app/api/account/dismiss-upgrade-notice/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const POST = async () => {
  const user = await getCurrentUser();
  if (!user.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: user.userId },
    data: { upgradeNoticeShownAt: new Date() },
  });
  // 直近 notice を dismiss マーク
  await prisma.upgradeNotice.updateMany({
    where: { userId: user.userId, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
};
```

- [ ] **Step 2: BusinessUpgradeAccountBanner コンポーネント作成**

ファイルパス: `src/components/account/BusinessUpgradeAccountBanner.tsx`

```typescript
'use client';

import { useState } from 'react';
import { getOverageRate } from '@/lib/plans/overage-rates';
import { USAGE_LIMIT_BUSINESS } from '@/lib/plans/limits';

interface MetricSnapshot {
  avgOveragePerMonth?: number;
  invoiceCount?: number;
  totalMeteredJpy?: number;
}

interface Props {
  /** UpgradeNotice の最新 1 件（なければ表示しない） */
  notice: {
    id: string;
    metricSnapshot: MetricSnapshot;
    createdAt: Date;
  } | null;
  /** User.upgradeNoticeShownAt（最後に dismiss した時刻） */
  upgradeNoticeShownAt: Date | null;
}

const SUPPRESSION_DAYS = 60;

/**
 * Phase A.17.0 X: 月次 Cron 検知に基づく Business 推奨バナー
 *
 * 表示条件:
 *   - notice が存在
 *   - upgradeNoticeShownAt が null OR 60日以上前
 */
export function BusinessUpgradeAccountBanner({ notice, upgradeNoticeShownAt }: Props) {
  const [hidden, setHidden] = useState(false);

  if (!notice) return null;
  if (hidden) return null;
  if (upgradeNoticeShownAt) {
    const daysSince = (Date.now() - upgradeNoticeShownAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < SUPPRESSION_DAYS) return null;
  }

  const avgOverage = notice.metricSnapshot.avgOveragePerMonth ?? 0;
  const invoiceCount = notice.metricSnapshot.invoiceCount ?? 0;
  const businessRate = getOverageRate('business');
  // Business なら ¥40/枠 で同じ枠数、加えて月額 ¥39,800 の base
  // 概算: Pro maxed (base ¥14,800 + overage ¥avg) vs Business (base ¥39,800 + overage ¥avg/2)
  const proExtra = avgOverage; // 既存超過コスト
  const businessExtra = Math.round((avgOverage * businessRate) / 80); // ¥80→¥40 換算で半額
  const monthlyDiff = 14800 + proExtra - (39800 + businessExtra);

  const handleDismiss = async () => {
    setHidden(true);
    await fetch('/api/account/dismiss-upgrade-notice', { method: 'POST' });
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📊</span>
        <div className="flex-1">
          <h4 className="font-semibold text-amber-300 mb-1">
            あなたは Business プラン向きかもしれません
          </h4>
          <p className="text-sm text-slate-300 mb-2">
            過去 {invoiceCount} ヶ月の Pro メータード超過: 平均
            <strong className="text-amber-300 mx-1">¥{avgOverage.toLocaleString()}/月</strong>
            。Business（{USAGE_LIMIT_BUSINESS.toLocaleString()} 枠 + ¥{businessRate}/枠）に変更すると
            {monthlyDiff > 0 ? (
              <span> 月 <strong className="text-emerald-400">¥{monthlyDiff.toLocaleString()} お得</strong> になる試算です。</span>
            ) : (
              <span> 同程度のコストで上限が大幅に拡張されます。</span>
            )}
          </p>
          <div className="flex gap-2">
            <a
              href="#plan"
              className="inline-block px-3 py-1.5 text-sm font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
            >
              Business を確認
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 4: コミット**

```bash
git add src/components/account/BusinessUpgradeAccountBanner.tsx src/app/api/account/dismiss-upgrade-notice/route.ts
git commit -m "feat(account): add BusinessUpgradeAccountBanner (X) + dismiss API"
```

---

## Task 13: PlanSection に BusinessUpgradeAccountBanner を統合

**Files:**
- Modify: `src/app/account/page.tsx`（または PlanSection の親）
- Modify: `src/app/account/PlanSection.tsx`

サーバーで notice を fetch して PlanSection に prop として渡す。

- [ ] **Step 1: account/page.tsx で notice を fetch**

`src/app/account/page.tsx` を確認:

```bash
cat src/app/account/page.tsx | head -60
```

PlanSection を render している箇所を見つけ、その手前で以下のロジックを追加:

```typescript
import { getPrisma } from '@/lib/prisma';
// ... 既存 imports ...

// PlanSection を render する関数内（または page コンポーネント内）で:
const prisma = getPrisma();
const latestNotice = user.userId
  ? await prisma.upgradeNotice.findFirst({
      where: { userId: user.userId, type: 'business_upgrade_recommendation' },
      orderBy: { createdAt: 'desc' },
    })
  : null;
const upgradeNoticeShownAt = (await prisma.user.findUnique({
  where: { id: user.userId },
  select: { upgradeNoticeShownAt: true },
}))?.upgradeNoticeShownAt ?? null;
```

そして PlanSection に新しい prop を渡す:

```tsx
<PlanSection
  user={user}
  upgradeNotice={latestNotice}
  upgradeNoticeShownAt={upgradeNoticeShownAt}
/>
```

- [ ] **Step 2: PlanSection の props 型を拡張**

`src/app/account/PlanSection.tsx` の `interface PlanSectionProps` を更新:

```typescript
interface PlanSectionProps {
  user: CurrentUser;
  upgradeNotice?: {
    id: string;
    metricSnapshot: unknown;
    createdAt: Date;
  } | null;
  upgradeNoticeShownAt?: Date | null;
}
```

- [ ] **Step 3: PlanSection 内で BusinessUpgradeAccountBanner を render**

import 追加:

```typescript
import { BusinessUpgradeAccountBanner } from '@/components/account/BusinessUpgradeAccountBanner';
```

return JSX 内、`<BusinessPlanCard />` の直前に追記:

```tsx
        {/* Phase A.17.0 X: 月次 Cron 検知のバナー */}
        {user.plan === 'pro' && (
          <BusinessUpgradeAccountBanner
            notice={
              upgradeNotice
                ? {
                    id: upgradeNotice.id,
                    metricSnapshot: upgradeNotice.metricSnapshot as Record<string, unknown>,
                    createdAt: upgradeNotice.createdAt,
                  }
                : null
            }
            upgradeNoticeShownAt={upgradeNoticeShownAt ?? null}
          />
        )}
```

- [ ] **Step 4: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 5: コミット**

```bash
git add src/app/account/PlanSection.tsx src/app/account/page.tsx
git commit -m "feat(account): wire BusinessUpgradeAccountBanner with server-side notice fetch"
```

---

## Task 14: LP 料金表を 4 列に拡張

**Files:**
- Modify: LP 料金表コンポーネント（探索後に確定）

- [ ] **Step 1: LP 料金表コンポーネントを特定**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
grep -rln "¥3,980\|¥14,800\|プロ\|Starter\|Pricing" src/app/lp01/ src/components/lp/ 2>&1 | head -5
```

- [ ] **Step 2: 該当ファイル（仮: `src/components/lp/PricingSection.tsx`）を読み**

```bash
cat <該当ファイルパス>
```

3 列構成（Free / Starter / Pro）と「個別商談」CTA があるはず。

- [ ] **Step 3: 4 列目（Business）を追加**

既存の Pro 列の隣に Business 列を追加（grid-cols-3 → grid-cols-4 に変更、mobile では縦積み）。

挿入する Business 列の中身（具体的 JSX は既存の Pro 列の構造を踏襲）:

```tsx
{/* Business plan column - Phase A.17.0 */}
<div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/30 to-slate-900 p-6 relative">
  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
    NEW
  </div>
  <h3 className="text-xl font-bold text-emerald-300 mb-1">Business</h3>
  <p className="text-xs text-slate-400 mb-4">広告代理店・中堅 EC 運用部隊向け</p>
  <div className="mb-4">
    <span className="text-3xl font-bold text-white">¥39,800</span>
    <span className="text-sm text-slate-400">/ 月（税込）</span>
  </div>
  <ul className="space-y-2 text-sm text-slate-300 mb-6">
    <li>✅ 1,000 枠 / 月（Pro の 10 倍）</li>
    <li>✅ 超過 ¥40/枠（Pro の半額）</li>
    <li>✅ ハードキャップ 3,000 枠</li>
    <li>✅ 全 17 サイズ・複数スタイル並列</li>
    <li className="text-slate-500 text-xs">
      🔜 クライアント別フォルダ・拡張 Brand Kit・一括 ZIP DL
    </li>
  </ul>
  <a
    href="/account#plan"
    className="block w-full text-center py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg"
  >
    Business で始める
  </a>
  <p className="text-xs text-slate-500 mt-2 text-center">
    より大規模・SLA は <a href="#contact" className="underline">Plan C</a>
  </p>
</div>
```

- [ ] **Step 4: grid 列数を 3 → 4 に変更**

該当の grid 親要素を:

```tsx
// Before
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">

// After
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
```

- [ ] **Step 5: 「より大規模なご利用は▶」コピーを更新**

LP 下部の Plan C 動線部分を:

```
（旧）より大規模なご利用は▶
（新）年契約・SLA・専任サポートをご希望の方は▶
```

- [ ] **Step 6: ローカルで dev server 起動して 4 列表示確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run dev
```

ブラウザで http://localhost:3000/lp01 を開き、料金表が 4 列で表示されること、mobile（DevTools で 375px に設定）で縦積みになることを確認。

- [ ] **Step 7: TypeScript ビルド通過確認**

```bash
npm run build
```

期待: ビルド成功。

- [ ] **Step 8: コミット**

```bash
git add <該当ファイル>
git commit -m "feat(lp): add Business plan as 4th column in pricing table"
```

---

## Task 15: 手動テスト + 本番デプロイ

**Files:**
- Create: `tests/manual/phase-a17-business-tier.md`

- [ ] **Step 1: 手動テスト手順書を作成**

ファイルパス: `tests/manual/phase-a17-business-tier.md`

```markdown
# Phase A.17.0 Business Tier 手動テスト

## 前提
- Stripe test mode key 設定済（`.env`）
- ローカル dev server: `npm run dev`
- Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhook`

## ケース 1: Free → Business 直接 Checkout
1. Free アカウントでログイン
2. /account の Business カードで「Business で始める」クリック
3. Stripe Checkout で `4242 4242 4242 4242` で決済
4. /account?stripe=success に戻る
5. Plan badge が "business" になる
6. usageLimit が 1,000 になる

## ケース 2: Pro → Business アップグレード（即時 prorate）
1. 既に Pro plan のアカウントでログイン
2. /account の Business カードで「Business にアップグレード」クリック
3. Stripe Checkout で支払（既存カード使用）
4. /account に戻り Plan badge が "business"
5. Stripe Dashboard で prorate Invoice が発行されている

## ケース 3: Business → Pro ダウングレード（期末切替）
1. Business plan のアカウント
2. /account の Business カードで「Pro にダウングレード」クリック
3. confirm dialog で OK
4. planExpiresAt が表示される（次回更新日まで Business）
5. Stripe Test Clock で 1 ヶ月進める → plan が pro に切り替わる

## ケース 4: Business メータード送信
1. Business plan のアカウント
2. `.env` で USAGE_LIMIT_BUSINESS を一時的に 5 に変更
3. dev server 再起動
4. 6 枚目の生成を実行
5. Stripe Dashboard の Meter Events で `banner_generation_overage` が記録される
6. `.env` を元に戻す

## ケース 5: Y inline banner
1. Pro plan のアカウントで usageCount を 95 に DB 直接更新
2. /ironclad で 6 pattern × 1 size = 6 枚 を生成
3. 6 枚目（usageCount = 101）の時点で UpgradeToBusinessBanner が表示される
4. 「今月は表示しない」クリック → 非表示
5. ページリロード後も非表示（localStorage 効いている）

## ケース 6: X 月次バナー
1. Pro plan のアカウントの Stripe customer に擬似メータード超過 invoice を作成
   （または直接 UpgradeNotice テーブルに insert）
2. /account を開く
3. BusinessUpgradeAccountBanner が表示される
4. 「閉じる」クリック → 非表示 + DB の upgradeNoticeShownAt 更新

## ケース 7: LP 4 列表示
1. http://localhost:3000/lp01 を開く
2. Desktop: Free / Starter / Pro / Business の 4 列で表示
3. Mobile (375px): 縦積みで 4 カード
4. Business カードに「NEW」ラベル

## ケース 8: FRIENDS coupon が base のみ割引
1. test mode の新規 Free アカウントでログイン
2. /account → Pro Checkout に遷移時、URL に `?promo=FRIENDS` 付与
3. Stripe Checkout 画面で「FRIENDS」適用済表示、初月 ¥14,800 引き
4. usageCount を一時的に >100 にして metered 送信を発生させる
5. 月末 invoice で base ¥14,800 → ¥0、metered は通常課金（割引なし）
```

- [ ] **Step 2: ローカルで主要ケース（1, 2, 3, 7）を実機テスト**

少なくともケース 1, 2, 3, 7 をローカルで通すこと。

- [ ] **Step 3: 全変更をまとめて push**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git push origin main
```

- [ ] **Step 4: Vercel rebuild 待機**

Vercel Dashboard で deploy 完了を確認。

- [ ] **Step 5: 本番 smoke test**

1. https://autobanner.jp/lp01 で 4 列料金表表示確認
2. https://autobanner.jp/account で Business カード表示確認
3. （オプション）自分のカードで実際に Business を購入 → 後日ダウングレード予約 → 動作確認

- [ ] **Step 6: タグ作成**

```bash
git tag phase-a17-business-tier-complete
git push origin phase-a17-business-tier-complete
```

- [ ] **Step 7: 完了コミット（手動テスト手順書）**

```bash
git add tests/manual/phase-a17-business-tier.md
git commit -m "docs(test): add Phase A.17.0 manual test guide"
git push origin main
```

---

## ロールバック手順（緊急時）

### L1（即座 / Vercel env で機能無効化）

```bash
node scripts/vercel-set-env.mjs STRIPE_PRICE_BUSINESS_BASE "" production --empty
node scripts/vercel-set-env.mjs STRIPE_PRICE_BUSINESS_METERED "" production --empty
node scripts/vercel-set-env.mjs NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_BASE "" production --empty
```

→ BusinessPlanCard が prices.ts の throw を捕まえて非表示化、checkout 拒否。

### L2（数分 / git revert）

```bash
git revert <merge-commit-of-a17> --no-edit
git push origin main
```

### L3（数時間 / タグ巻き戻し）

A.17.0 着手前のタグ（例: A.16.1 完了直後の commit）に巻き戻し。

---

## 完了条件

すべての Task の checkbox がチェックされ、Task 15 ステップ 6 で `phase-a17-business-tier-complete` タグが push された状態。
