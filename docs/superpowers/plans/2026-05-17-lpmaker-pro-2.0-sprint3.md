# LP Maker Pro 2.0 — Sprint 3 Implementation Plan (D11〜D15)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Sprint 2 で完成した「Brief → 編集 → 公開 → SSR 閲覧」フローに対し、**Stripe 課金 / plan-based gate (admin only 解除) / 透かし / autobanner.jp 連携 / Slack 通知 / 法務監査** を実装し、Phase 1 真の Production-Ready に到達する。

**Architecture:**
- Stripe Live Meter `lp_generation_overage` 作成 + Pro Subscription 3-item 化（既存 base + バナー meter + 新規 LP meter）
- admin only gate を Free/Starter/Pro 区分に置換（Free=1本ハードキャップ・Starter=5本+超過¥980・Pro=20本+メータード¥980/超過）
- Free 公開 LP に「Powered by LP Maker Pro」透かしを SSR 段階で固定 HTML 強制挿入
- LP 「広告も作る」ボタン → `/api/lp/[id]/banner-handoff` → autobanner.jp `/ironclad?prefill=<lpId>` プリフィル遷移、`Generation.sourceLpId` で紐付け
- Slack 通知 5 種（新規 LP 公開 / Free→Starter 転換 / 日次 WAU / 週次サマリ / 赤信号）+ legal agent 監査

**Tech Stack:** Next.js 16 / Prisma 7 / Stripe SDK v22 / Vercel Cron / `@vercel/blob` / 既存 Slack webhook 統合

**Spec:** [docs/superpowers/specs/2026-05-16-lpmaker-pro-2.0-design.md](../specs/2026-05-16-lpmaker-pro-2.0-design.md)

**Test方針:** `npm run build` + ローカル `npm run dev` + Stripe Test Clock + 実アカウント (admin) + 段階的本番検証。

**前提:**
- Sprint 2 完了（HEAD: `dacba38`、本番 lpmaker-pro.com 稼働中・admin only）
- Stripe Live KYC 完了済（autobanner.jp Phase A.12）
- `~/.claude/secrets/stripe-live-token` 保存済
- 本番 DB に LP Maker schema 適用済（既に Sprint 1 で migrate 完了）
- 残 punch list: I-2 publish 非 atomic、Minor 8 件

---

## ファイル構成マップ

### Sprint 3 で作成（新規 11 ファイル）

| ファイル | 役割 |
|---|---|
| `scripts/stripe-live-setup-lp.mjs` | Stripe Live Meter + Pro Metered LP Price + LPMAKER_EARLY Promo 作成 |
| `src/lib/billing/lp-usage-records.ts` | sendLpMeteredUsage()（Stripe meterEvents.create idempotent） |
| `src/lib/lp/limits.ts` | LP_USAGE_LIMIT_FREE=1 / STARTER=5 / PRO=20 + ハードキャップ + 月初リセット |
| `src/lib/lp/watermark.ts` | injectFreePlanWatermark() — SSR 段階で透かし HTML 挿入 |
| `src/components/lp-maker/UsageHeader.tsx` | dashboard 上部「今月 N/M 本」表示 + plan badge |
| `src/components/lp-maker/UpgradeLpModal.tsx` | Free/Starter 上限到達時の Stripe Checkout 訴求 |
| `src/components/lp-maker/PreviewWatermarkBanner.tsx` | Free プラン編集画面の「公開で透かし入り」訴求 |
| `src/app/api/lp/[id]/banner-handoff/route.ts` | LP → autobanner.jp プリフィル URL 返却 + LP-Banner 紐付け |
| `src/components/lp-maker/BannerHandoffButton.tsx` | 公開完了後 / edit 画面の「広告も作る」CTA |
| `src/app/api/cron/lp-kpi-daily/route.ts` | 北極星指標 WAU 日次 Slack 通知 |
| `src/app/api/cron/lp-kpi-weekly/route.ts` | 週次サマリ + 赤信号通知 |

### Sprint 3 で変更

| ファイル | 変更内容 |
|---|---|
| `src/app/api/lp/generate/route.ts` | admin gate を plan-based gate に置換 + usage incrementorIntegration |
| `src/app/api/lp/[id]/route.ts` | admin gate を plan-based gate に置換 |
| `src/app/api/lp/[id]/section/[type]/regenerate/route.ts` | admin gate を plan-based gate に置換 + Pro メータード課金 |
| `src/app/api/lp/[id]/publish/route.ts` | admin gate を plan-based gate に置換 + usage check + メータード課金 + I-2 atomic fix |
| `src/lib/lp/publish.ts` | I-2 atomic 化（UPDATE 先 → OGP は後 + try/catch） |
| `src/lib/lp/orchestrator.ts` | usage 加算 + 透かしフラグ伝搬 |
| `src/lib/billing/webhook-handlers/payment-succeeded.ts` | LP usage 月初リセット追加 |
| `src/app/lp-maker/page.tsx` | UsageHeader 統合 |
| `src/app/lp-maker/[id]/edit/EditClient.tsx` | BannerHandoffButton + PreviewWatermarkBanner 追加 |
| `src/app/site/[user]/[slug]/page.tsx` | 透かし injection（Free プランのみ） |
| `vercel.json` | cron 2 件追加 (lp-kpi-daily / lp-kpi-weekly) |
| `src/lib/slack/notify-new-lp.ts` (NEW or 拡張) | 新規 LP 公開通知 |
| `src/lib/billing/webhook-handlers/customer-subscription-updated.ts` | Free → Starter 転換通知 |

---

## Task 0: 前提確認

**Files:** なし

- [ ] **Step 1: branch + status**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git checkout main && git pull origin main
git checkout -b feat/lpmaker-pro-2-sprint3
git log --oneline -3
```

期待: HEAD は `dacba38` (Sprint 2 middleware fix) or それ以降。

- [ ] **Step 2: Stripe Live secret 確認**

```bash
ls ~/.claude/secrets/stripe-live-token && head -c 10 ~/.claude/secrets/stripe-live-token && echo "..."
ls scripts/stripe-live-ids.json 2>&1 | head -3
```

期待: token 存在 + Phase A.12 で作った既存 ID JSON 存在。

---

## D11 Task 15: Stripe Live セットアップ (Meter + Pro Metered LP Price + Promo)

**Files:**
- 作成: `scripts/stripe-live-setup-lp.mjs`

- [ ] **Step 1: 既存 Stripe リソース listing で確認**

```bash
node -e "
import('stripe').then(async ({default: Stripe}) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const key = fs.readFileSync(path.join(process.env.USERPROFILE, '.claude/secrets/stripe-live-token'), 'utf-8').trim();
  const s = new Stripe(key, {apiVersion: '2026-04-22.dahlia'});
  const meters = await s.billing.meters.list({limit: 100});
  console.log('Existing meters:');
  meters.data.forEach(m => console.log(' -', m.id, m.event_name));
  const promos = await s.promotionCodes.list({code: 'LPMAKER_EARLY'});
  console.log('Existing LPMAKER_EARLY:', promos.data.length, '件');
});
"
```

期待: `lp_generation_overage` Meter なし、`LPMAKER_EARLY` Promo なし。

- [ ] **Step 2: stripe-live-setup-lp.mjs 作成**

```javascript
#!/usr/bin/env node
import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokenPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude/secrets/stripe-live-token');
const apiKey = fs.readFileSync(tokenPath, 'utf-8').trim();
const stripe = new Stripe(apiKey, { apiVersion: '2026-04-22.dahlia' });

const existingIds = JSON.parse(fs.readFileSync(path.join(__dirname, 'stripe-live-ids.json'), 'utf-8'));
const proProductId = existingIds.PRO_PRODUCT_ID;
if (!proProductId) {
  console.error('Pro Product ID が stripe-live-ids.json に見つかりません');
  process.exit(1);
}

console.log('=== LP 用 Stripe リソース作成開始 ===');

// 1. Meter
const meter = await stripe.billing.meters.create({
  display_name: 'LP Generation Overage',
  event_name: 'lp_generation_overage',
  default_aggregation: { formula: 'sum' },
  customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
  value_settings: { event_payload_key: 'value' },
});
console.log('Meter:', meter.id);

// 2. Pro Metered LP Price
const priceLpMetered = await stripe.prices.create({
  product: proProductId,
  currency: 'jpy',
  recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
  billing_scheme: 'tiered',
  tiers_mode: 'graduated',
  tiers: [
    { up_to: 20, unit_amount: 0 },
    { up_to: 'inf', unit_amount: 980 },
  ],
  nickname: 'Pro LP Metered',
});
console.log('Pro Metered LP Price:', priceLpMetered.id);

// 3. Coupon + Promo
const coupon = await stripe.coupons.create({
  duration: 'once',
  percent_off: 50,
  max_redemptions: 50,
  name: 'LPMAKER_EARLY 50% OFF',
  redeem_by: Math.floor(Date.now() / 1000) + 60 * 86400,
});
console.log('Coupon:', coupon.id);

const promo = await stripe.promotionCodes.create({
  coupon: coupon.id,
  code: 'LPMAKER_EARLY',
  max_redemptions: 50,
});
console.log('Promo:', promo.id);

const outIds = {
  LP_METER_ID: meter.id,
  LP_METER_EVENT_NAME: 'lp_generation_overage',
  STRIPE_PRICE_PRO_LP_METERED: priceLpMetered.id,
  LP_COUPON_ID: coupon.id,
  STRIPE_PROMO_LPMAKER_EARLY: promo.id,
};
fs.writeFileSync(
  path.join(__dirname, 'stripe-live-ids-lp.json'),
  JSON.stringify(outIds, null, 2)
);
console.log('=== 完了 ===');
console.log(outIds);
```

- [ ] **Step 3: .gitignore 追加**

```bash
echo "scripts/stripe-live-ids-lp.json" >> .gitignore
```

- [ ] **Step 4: 実行**

```bash
node scripts/stripe-live-setup-lp.mjs
```

期待: 3 リソース作成 + JSON 保存。

- [ ] **Step 5: Vercel env 投入**

`stripe-live-ids-lp.json` の中身を見て、`scripts/vercel-set-env.mjs --sensitive STRIPE_LP_METER_ID=... STRIPE_LP_METER_EVENT_NAME=lp_generation_overage STRIPE_PRICE_PRO_LP_METERED=... STRIPE_PROMO_LPMAKER_EARLY=...` を実行。

- [ ] **Step 6: Pro Subscription を 3-item 化** (existing 1-2 customer のみ)

既存 Pro Subscription を listing で確認:

```bash
node -e "
import('stripe').then(async ({default: Stripe}) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const key = fs.readFileSync(path.join(process.env.USERPROFILE, '.claude/secrets/stripe-live-token'), 'utf-8').trim();
  const s = new Stripe(key, {apiVersion: '2026-04-22.dahlia'});
  const subs = await s.subscriptions.list({status: 'active', limit: 10});
  subs.data.forEach(sub => {
    console.log(sub.id, sub.customer);
    sub.items.data.forEach(item => console.log(' -', item.price.id, item.price.nickname));
  });
});
"
```

既存 Pro Subscription があれば `subscriptions.update({items: [{price: <NEW_LP_METERED>}]})` で 3-item に拡張。なければ新規購入時に自動で 3-item になる (next step で実装)。

- [ ] **Step 7: commit**

```bash
git add scripts/stripe-live-setup-lp.mjs .gitignore
git commit -m "feat(D11-T15): add Stripe Live LP meter + Pro metered price + LPMAKER_EARLY promo setup"
```

---

## D11 Task 16: src/lib/billing/lp-usage-records.ts + Webhook 拡張

**Files:**
- 作成: `src/lib/billing/lp-usage-records.ts`
- 変更: `src/lib/billing/webhook-handlers/payment-succeeded.ts`

- [ ] **Step 1: lp-usage-records.ts**

既存 `src/lib/billing/usage-records.ts` を参考に:

```typescript
import { getStripeClient } from './stripe-client';

/**
 * Pro プラン 21 本目以降の LP 生成超過を Stripe Meter に送信。
 * identifier に generation/landingPage id を使って idempotent 化。
 */
export async function sendLpMeteredUsage(args: {
  stripeCustomerId: string;
  landingPageId: string;
  value?: number;
}): Promise<void> {
  const stripe = getStripeClient();
  const eventName = process.env.STRIPE_LP_METER_EVENT_NAME ?? 'lp_generation_overage';

  await stripe.billing.meterEvents.create({
    event_name: eventName,
    identifier: `lp-${args.landingPageId}`,
    payload: {
      stripe_customer_id: args.stripeCustomerId,
      value: String(args.value ?? 1),
    },
  });
}
```

- [ ] **Step 2: payment-succeeded.ts に LP usage リセット追加**

`src/lib/billing/webhook-handlers/payment-succeeded.ts` の既存リセット箇所に追加:

```diff
   await prisma.user.update({
     where: { id: user.id },
     data: {
       paymentFailedAt: null,
       proOverageNoticeShownAt: null,
+      // LP Maker Pro 2.0
+      currentMonthLpUsageCount: 0,
+      proLpOverageNoticeShownAt: null,
     },
   });
```

- [ ] **Step 3: build + commit**

```bash
npm run build
git add src/lib/billing/lp-usage-records.ts src/lib/billing/webhook-handlers/payment-succeeded.ts
git commit -m "feat(D11-T16): add sendLpMeteredUsage + reset LP usage on payment_succeeded"
```

---

## D11 Task 17: plan-based gate に置換（admin only 解除）

**Files:**
- 作成: `src/lib/lp/limits.ts`
- 変更: `src/app/api/lp/generate/route.ts`
- 変更: `src/app/api/lp/[id]/route.ts`
- 変更: `src/app/api/lp/[id]/section/[type]/regenerate/route.ts`
- 変更: `src/app/api/lp/[id]/publish/route.ts`

- [ ] **Step 1: limits.ts**

```typescript
import { getPrisma } from '@/lib/prisma';

export const LP_USAGE_LIMIT_FREE = 1;
export const LP_USAGE_LIMIT_STARTER = 5;
export const LP_USAGE_LIMIT_PRO = 20;

export const LP_USAGE_HARDCAP_FREE = 1;
export const LP_USAGE_HARDCAP_STARTER = 30;
export const LP_USAGE_HARDCAP_PRO = 100;

export type LpPlan = 'free' | 'starter' | 'pro' | 'admin';

export interface LpUsageStatus {
  plan: LpPlan;
  currentUsage: number;
  softLimit: number;  // 超えると metered or upsell
  hardCap: number;    // 超えるとブロック
  isHardBlocked: boolean;
  isOverSoft: boolean;
  stripeCustomerId: string | null;
}

export async function getLpUsageStatus(userId: string): Promise<LpUsageStatus> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      currentMonthLpUsageCount: true,
      stripeCustomerId: true,
    },
  });
  if (!user) throw new Error('User not found');

  const plan = (user.plan ?? 'free') as LpPlan;
  const usage = user.currentMonthLpUsageCount ?? 0;

  const limits = {
    free: { soft: LP_USAGE_LIMIT_FREE, hard: LP_USAGE_HARDCAP_FREE },
    starter: { soft: LP_USAGE_LIMIT_STARTER, hard: LP_USAGE_HARDCAP_STARTER },
    pro: { soft: LP_USAGE_LIMIT_PRO, hard: LP_USAGE_HARDCAP_PRO },
    admin: { soft: 9999, hard: 9999 },
  };
  const { soft, hard } = limits[plan];

  return {
    plan,
    currentUsage: usage,
    softLimit: soft,
    hardCap: hard,
    isHardBlocked: usage >= hard,
    isOverSoft: usage >= soft,
    stripeCustomerId: user.stripeCustomerId ?? null,
  };
}

export async function incrementLpUsage(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { currentMonthLpUsageCount: { increment: 1 } },
  });
}
```

注: `User.stripeCustomerId` フィールドが既存 schema にあることを確認。なければ Sprint 1 で追加していたはず（A.12 で）。

- [ ] **Step 2: generate/route.ts** — admin gate を plan gate に置換

```diff
-  // C-2 fix: interim admin-only gate
-  const prisma = getPrisma();
-  const user = await prisma.user.findUnique({
-    where: { id: session.user.id },
-    select: { plan: true },
-  });
-  if (user?.plan !== 'admin') {
-    return NextResponse.json(
-      { error: 'LP Maker is in early access. Available to admin users only until Sprint 3 release.', adminOnly: true },
-      { status: 403 }
-    );
-  }
+  // D11: plan-based gate（admin / Pro / Starter / Free に応じて hardcap で 429）
+  const usage = await getLpUsageStatus(session.user.id);
+  if (usage.isHardBlocked) {
+    return NextResponse.json(
+      { error: `今月の LP 生成上限 (${usage.hardCap} 本) に達しました`, plan: usage.plan, currentUsage: usage.currentUsage },
+      { status: 429 }
+    );
+  }
```

その他 (orchestrator 内) で usage 加算 + metered 課金:

`src/lib/lp/orchestrator.ts` の `generateLandingPage` 関数末尾の return 直前に追加:

```typescript
// D11: usage 加算 + Pro 超過時メータード課金
await incrementLpUsage(args.userId);
const usage = await getLpUsageStatus(args.userId);
if (usage.plan === 'pro' && usage.isOverSoft && usage.stripeCustomerId) {
  // 21本目以降は Stripe Meter に送信
  await sendLpMeteredUsage({
    stripeCustomerId: usage.stripeCustomerId,
    landingPageId: lp.id,
  }).catch((err) => {
    console.error('[orchestrator] sendLpMeteredUsage failed', err);
    // 課金送信失敗でも生成は成功させる (fire-and-forget)
  });
}
```

注: `incrementLpUsage` `getLpUsageStatus` `sendLpMeteredUsage` を import。

- [ ] **Step 3: PATCH /api/lp/[id]/route.ts** — admin gate 削除（PATCH 自体は usage に紐づかないので、ownership + plan 確認のみ）

```diff
-  // C-1 fix: admin gate
-  const prisma = getPrisma();
-  const user = await prisma.user.findUnique({
-    where: { id: session.user.id },
-    select: { plan: true },
-  });
-  if (user?.plan !== 'admin') {
-    return NextResponse.json({ error: 'Admin only until Sprint 3', adminOnly: true }, { status: 403 });
-  }
+  // D11: 認証されたユーザーは自分の LP を編集可能（admin only 解除）
+  const prisma = getPrisma();
```

- [ ] **Step 4: regenerate route**

同様に admin gate 削除 + Pro 超過時メータード課金:

```diff
-  // admin gate (C-2 と同じ理由、Sprint 3 で plan-based に置換)
-  const user = await prisma.user.findUnique({
-    where: { id: session.user.id },
-    select: { plan: true },
-  });
-  if (user?.plan !== 'admin') {
-    return NextResponse.json({ error: 'Admin only until Sprint 3', adminOnly: true }, { status: 403 });
-  }
+  // D11: regenerate も usage 加算対象。Pro 超過時 metered 課金。
+  const usage = await getLpUsageStatus(session.user.id);
+  if (usage.isHardBlocked) {
+    return NextResponse.json({ error: '上限到達', plan: usage.plan }, { status: 429 });
+  }
```

API 末尾、`createMany` の後に追加:

```typescript
await incrementLpUsage(session.user.id);
if (usage.plan === 'pro' && usage.isOverSoft && usage.stripeCustomerId) {
  await sendLpMeteredUsage({
    stripeCustomerId: usage.stripeCustomerId,
    landingPageId: id,
  }).catch((err) => console.error('[regenerate] sendLpMeteredUsage failed', err));
}
```

注: regenerate は「LP 1 本」ではなく「セクション 1 回再生成」だが、Phase 1 では同じ単位でカウント (簡素化)。Sprint 4 以降で分離検討。

- [ ] **Step 5: publish route** — admin gate 削除のみ (publish 自体は usage に紐づかない、generate で消費済み)

```diff
-  const prisma = getPrisma();
-  const user = await prisma.user.findUnique({
-    where: { id: session.user.id },
-    select: { plan: true },
-  });
-  if (user?.plan !== 'admin') {
-    return NextResponse.json({ error: 'Admin only until Sprint 3', adminOnly: true }, { status: 403 });
-  }
+  const prisma = getPrisma();
+  // 公開は usage 消費なし。所有権チェックのみ（publishLandingPage 内で実施）。
```

- [ ] **Step 6: build + commit**

```bash
npm run build
git add src/lib/lp/limits.ts 'src/app/api/lp/' src/lib/lp/orchestrator.ts
git commit -m "feat(D11-T17): replace admin gate with plan-based usage gate (Free/Starter/Pro hardcap + Pro metered overage)"
```

---

## D12 Task 18: Free 公開 LP 透かし焼き込み

**Files:**
- 作成: `src/lib/lp/watermark.ts`
- 作成: `src/components/lp-maker/PreviewWatermarkBanner.tsx`
- 変更: `src/app/site/[user]/[slug]/page.tsx`
- 変更: `src/app/lp-maker/[id]/edit/EditClient.tsx`

- [ ] **Step 1: watermark.ts**

```typescript
import type { LandingPage } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

/**
 * 公開 LP の透かしを「LP の所有者の plan」で判定。
 * Free plan → 透かし表示
 * Starter/Pro/admin → 透かしなし
 */
export async function shouldShowWatermark(lp: LandingPage): Promise<boolean> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: lp.userId },
    select: { plan: true },
  });
  const plan = user?.plan ?? 'free';
  return plan === 'free';
}
```

- [ ] **Step 2: site/[user]/[slug]/page.tsx に透かしを統合**

`PublicLpPage` 関数内、return JSX 末尾の `<footer>` を以下に置換:

```diff
-      <footer className="bg-slate-950 text-slate-500 text-xs text-center py-4">
-        Powered by{' '}
-        <a href="https://lpmaker-pro.com" className="text-emerald-400 hover:underline">
-          LP Maker Pro
-        </a>
-      </footer>
+      {await shouldShowWatermark(lp) ? (
+        // Free プラン: 削除不可な透かし (SSR 段階で固定 HTML 強制挿入)
+        <footer className="bg-emerald-950 text-emerald-100 text-sm text-center py-6 border-t-2 border-emerald-500">
+          <p className="font-bold">
+            このLPは{' '}
+            <a href="https://lpmaker-pro.com" className="underline" target="_blank" rel="noopener">
+              LP Maker Pro 2.0
+            </a>{' '}
+            の Free プランで生成されました
+          </p>
+          <p className="text-xs text-emerald-300/80 mt-1">
+            透かしを外すには Starter プラン以上にアップグレード
+          </p>
+        </footer>
+      ) : (
+        <footer className="bg-slate-950 text-slate-500 text-xs text-center py-4">
+          Powered by{' '}
+          <a href="https://lpmaker-pro.com" className="text-emerald-400 hover:underline">
+            LP Maker Pro
+          </a>
+        </footer>
+      )}
```

`PublicLpPage` を `async` 関数として既に定義済（OK）。`import { shouldShowWatermark } from '@/lib/lp/watermark';` を追加。

- [ ] **Step 3: PreviewWatermarkBanner.tsx**

```tsx
'use client';

interface Props {
  plan: 'free' | 'starter' | 'pro' | 'admin';
}

export function PreviewWatermarkBanner({ plan }: Props) {
  if (plan !== 'free') return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/95 text-slate-950 px-4 py-2 rounded-lg shadow-lg text-xs font-bold">
      ⚠ Free プラン: 公開 LP には「Powered by LP Maker Pro」透かしが入ります（Starter で消えます）
    </div>
  );
}
```

- [ ] **Step 4: EditClient.tsx に PreviewWatermarkBanner 統合**

EditClient の Props に `userPlan` を追加 (server component から渡す):

`src/app/lp-maker/[id]/edit/page.tsx` で:

```diff
+  const userRecord = await prisma.user.findUnique({
+    where: { id: session.user.id },
+    select: { plan: true },
+  });

   return (
     <EditClient
       lpId={lp.id}
       initialTitle={lp.title}
       initialSections={lp.sections as unknown as LpSection[]}
       initialStatus={lp.status}
       initialSlug={lp.slug}
+      userPlan={(userRecord?.plan ?? 'free') as 'free' | 'starter' | 'pro' | 'admin'}
     />
   );
```

EditClient.tsx で Props 受け取り + Banner mount:

```diff
+import { PreviewWatermarkBanner } from '@/components/lp-maker/PreviewWatermarkBanner';

 interface Props {
   lpId: string;
   initialTitle: string;
   initialSections: LpSection[];
   initialStatus: string;
   initialSlug: string;
+  userPlan: 'free' | 'starter' | 'pro' | 'admin';
 }

-export function EditClient({ lpId, initialTitle, initialSections, ..., initialSlug }: Props) {
+export function EditClient({ lpId, initialTitle, initialSections, ..., initialSlug, userPlan }: Props) {
   ...
   return (
     <div ...>
+      <PreviewWatermarkBanner plan={userPlan} />
       <aside ...>
```

- [ ] **Step 5: build + commit**

```bash
npm run build
git add src/lib/lp/watermark.ts src/components/lp-maker/PreviewWatermarkBanner.tsx 'src/app/site/' 'src/app/lp-maker/[id]/edit/'
git commit -m "feat(D12-T18): add Free plan watermark on public LP + edit screen preview banner"
```

---

## D12 Task 19: dashboard UsageHeader + UpgradeLpModal

**Files:**
- 作成: `src/components/lp-maker/UsageHeader.tsx`
- 作成: `src/components/lp-maker/UpgradeLpModal.tsx`
- 変更: `src/app/lp-maker/page.tsx`

- [ ] **Step 1: UsageHeader**

```tsx
'use client';
import { useState } from 'react';
import { UpgradeLpModal } from './UpgradeLpModal';

interface Props {
  plan: 'free' | 'starter' | 'pro' | 'admin';
  currentUsage: number;
  softLimit: number;
  hardCap: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  admin: 'Admin',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-slate-700 text-slate-300',
  starter: 'bg-blue-500 text-slate-950',
  pro: 'bg-emerald-500 text-slate-950',
  admin: 'bg-purple-500 text-slate-50',
};

export function UsageHeader({ plan, currentUsage, softLimit, hardCap }: Props) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const isOverSoft = currentUsage >= softLimit;
  const isNearHard = currentUsage >= hardCap * 0.8;

  return (
    <>
      <div className="flex items-center justify-between bg-slate-900 rounded-lg p-4 mb-6 border border-slate-800">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-1 rounded ${PLAN_COLORS[plan]}`}>
            {PLAN_LABELS[plan]}
          </span>
          <span className="text-sm text-slate-300">
            今月 <strong className={isOverSoft ? 'text-amber-400' : 'text-emerald-400'}>{currentUsage}</strong>
            <span className="text-slate-500"> / {softLimit} 本</span>
            {isOverSoft && plan === 'pro' && (
              <span className="text-xs text-amber-400 ml-2">（超過分は ¥980/本 メータード）</span>
            )}
          </span>
        </div>
        {(plan === 'free' || plan === 'starter') && isOverSoft && (
          <button
            type="button"
            onClick={() => setShowUpgrade(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded text-sm"
          >
            アップグレード
          </button>
        )}
        {isNearHard && plan !== 'admin' && (
          <span className="text-xs text-red-400">⚠ 上限 {hardCap} 本に近づいています</span>
        )}
      </div>
      {showUpgrade && (
        <UpgradeLpModal currentPlan={plan} onClose={() => setShowUpgrade(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 2: UpgradeLpModal**

既存 `CheckoutButton` 利用パターン (autobanner.jp Phase A.12) を踏襲。

```tsx
'use client';
import { CheckoutButton } from '@/components/billing/CheckoutButton';

interface Props {
  currentPlan: 'free' | 'starter' | 'pro' | 'admin';
  onClose: () => void;
}

export function UpgradeLpModal({ currentPlan, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">LP 上限を解除</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        <p className="text-sm text-slate-300">
          {currentPlan === 'free' && '月 1 本までの Free プランです。Starter で月 5 本、Pro で月 20 本まで作成できます。'}
          {currentPlan === 'starter' && '月 5 本までの Starter プランです。Pro で月 20 本 + 超過 ¥980/本のメータード課金で無制限利用が可能です。'}
        </p>

        <div className="space-y-2">
          {currentPlan === 'free' && (
            <CheckoutButton priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER!} className="w-full bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold py-3 rounded">
              Starter ¥3,980/月 にする
            </CheckoutButton>
          )}
          <CheckoutButton priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE!} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded">
            Pro ¥14,800/月 にする
          </CheckoutButton>
        </div>

        <p className="text-xs text-slate-500">早割コード LPMAKER_EARLY で 50% OFF（先着 50・60 日有効）</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: dashboard 統合**

`src/app/lp-maker/page.tsx` の `header` の下、`landingPages` 表示の上に UsageHeader を追加:

```diff
+import { UsageHeader } from '@/components/lp-maker/UsageHeader';
+import { getLpUsageStatus } from '@/lib/lp/limits';

 ...
 const session = await auth();
 ...
 const landingPages = await prisma.landingPage.findMany({ ... });
+const usage = await getLpUsageStatus(session.user.id);

 return (
   <main ...>
     <div ...>
       <header ...>...</header>
+      <UsageHeader
+        plan={usage.plan}
+        currentUsage={usage.currentUsage}
+        softLimit={usage.softLimit}
+        hardCap={usage.hardCap}
+      />
       {landingPages.length === 0 ? ...}
     </div>
   </main>
 );
```

- [ ] **Step 4: build + commit**

```bash
npm run build
git add src/components/lp-maker/UsageHeader.tsx src/components/lp-maker/UpgradeLpModal.tsx src/app/lp-maker/page.tsx
git commit -m "feat(D12-T19): add dashboard UsageHeader + UpgradeLpModal (Free→Starter/Pro CTA)"
```

---

## D13 Task 20: 「広告も作る」autobanner.jp 連携

**Files:**
- 作成: `src/app/api/lp/[id]/banner-handoff/route.ts`
- 作成: `src/components/lp-maker/BannerHandoffButton.tsx`
- 変更: `src/app/lp-maker/[id]/edit/EditClient.tsx`

- [ ] **Step 1: banner-handoff API**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import type { LpSection } from '@/lib/lp/types';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const prisma = getPrisma();

  const lp = await prisma.landingPage.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!lp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // LP の brief / hero copy から autobanner.jp プリフィル URL を構築
  const sections = lp.sections as unknown as LpSection[];
  const hero = sections.find((s) => s.type === 'hero')?.props as { headline?: string; subheadline?: string } | undefined;
  const brief = lp.brief as unknown as { productName?: string; target?: string; offer?: string; lpUrl?: string };

  // /ironclad?prefill=<lpId> で渡す。autobanner.jp 側で LP を fetch して prefill
  // 公開 URL も渡す（autobanner.jp が分析できるように）
  const userSlug = lp.userId.slice(-8);
  const lpPublicUrl = lp.status === 'published'
    ? `https://lpmaker-pro.com/site/${userSlug}/${lp.slug}`
    : null;

  return NextResponse.json({
    handoffUrl: `https://autobanner.jp/ironclad?prefill=${lp.id}&lp=${encodeURIComponent(lpPublicUrl ?? '')}`,
    brief: {
      productName: brief.productName,
      target: brief.target,
      offer: brief.offer,
      lpUrl: lpPublicUrl ?? brief.lpUrl,
    },
    hero: {
      headline: hero?.headline,
      subheadline: hero?.subheadline,
    },
  });
}
```

注: autobanner.jp 側で `?prefill=<lpId>` を受けて prefill する実装は、autobanner.jp 既存の `?prefill=<generationId>` パターン (Phase A.11.5) と同じ。Phase 1 では LP からのフィールドを Brief 入力時に URL クエリで受け取るシンプル実装。

autobanner.jp の `/ironclad` ページに以下の処理を追加 (existing `/ironclad/page.tsx` を修正):

```typescript
// useSearchParams() で prefill / lp を読む
const searchParams = useSearchParams();
const prefillLpId = searchParams.get('prefill');
const lpUrl = searchParams.get('lp');

useEffect(() => {
  if (!prefillLpId) return;
  // 内部 API 呼び出しで LP データを取得して Brief にプリフィル
  fetch(`/api/lp/${prefillLpId}`).then(async (res) => {
    if (!res.ok) return;
    const lp = await res.json();
    // setForm({ productName: lp.brief.productName, target: lp.brief.target, ... })
  });
}, [prefillLpId]);
```

これは autobanner.jp 既存 `/ironclad` の改修なので、別 task として扱う方が安全。本 task では LP 側 banner-handoff API のみ実装。autobanner.jp 側修正は Step 4 で。

- [ ] **Step 2: BannerHandoffButton**

```tsx
'use client';
import { useState } from 'react';

interface Props {
  lpId: string;
  isPublished: boolean;
}

export function BannerHandoffButton({ lpId, isPublished }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/lp/${lpId}/banner-handoff`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { handoffUrl } = await res.json();
      window.open(handoffUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      alert('連携に失敗しました');
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded text-sm disabled:opacity-50"
      title={isPublished ? '同じブリーフから広告バナー 17 サイズを生成' : '公開後に広告連携できます（公開 URL が必要）'}
    >
      {loading ? '連携中…' : '+ 広告も作る (autobanner.jp)'}
    </button>
  );
}
```

- [ ] **Step 3: EditClient に BannerHandoffButton 統合**

左ペイン header の「公開」ボタンの隣に追加:

```diff
+import { BannerHandoffButton } from '@/components/lp-maker/BannerHandoffButton';

 ...
 <div className="flex items-center gap-2">
   <h2 className="text-sm font-bold ...">{title}</h2>
   <button onClick={() => setShowPublish(true)} ...>公開</button>
+  <BannerHandoffButton lpId={lpId} isPublished={initialStatus === 'published'} />
 </div>
```

- [ ] **Step 4: autobanner.jp /ironclad で prefill 対応 (オプション・Phase 2 へ延期可)**

`src/app/ironclad/page.tsx` (or 該当 client component) に prefill 処理追加。Phase 1 では SKIP し、ユーザーが手動で Brief を再入力する UX で OK (banner-handoff URL は遷移するだけ、prefill は best-effort)。

- [ ] **Step 5: build + commit**

```bash
npm run build
git add 'src/app/api/lp/[id]/banner-handoff/' src/components/lp-maker/BannerHandoffButton.tsx 'src/app/lp-maker/[id]/edit/EditClient.tsx'
git commit -m "feat(D13-T20): add LP → autobanner.jp banner-handoff (prefill URL + edit screen CTA)"
```

---

## D14 Task 21: Slack 通知 5 種 + 法務監査

**Files:**
- 作成: `src/lib/slack/notify-new-lp.ts`
- 作成: `src/app/api/cron/lp-kpi-daily/route.ts`
- 作成: `src/app/api/cron/lp-kpi-weekly/route.ts`
- 変更: `src/lib/lp/publish.ts` (Slack 通知統合)
- 変更: `src/lib/billing/webhook-handlers/customer-subscription-updated.ts` (Free→Starter 転換通知)
- 変更: `vercel.json` (cron 2 件追加)

- [ ] **Step 1: notify-new-lp.ts**

既存 `src/lib/slack/notify-new-user.ts` 参考:

```typescript
import type { LandingPage, User } from '@prisma/client';

export async function notifyNewLpPublished(args: {
  lp: LandingPage;
  user: Pick<User, 'email' | 'name' | 'plan'>;
}): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER; // 既存 webhook 再利用
  if (!webhook) return; // graceful no-op

  const userSlug = args.lp.userId.slice(-8);
  const publicUrl = `https://lpmaker-pro.com/site/${userSlug}/${args.lp.slug}`;

  const adminBadge = args.user.email === 'str.kk.co@gmail.com' ? ':crown: ' : '';

  await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: `🎉 LP Maker Pro 2.0: 新規 LP 公開 ${adminBadge}\n*${args.lp.title}*\nby ${args.user.name ?? args.user.email} (${args.user.plan})\n${publicUrl}`,
    }),
  }).catch((e) => console.error('[slack] notify-new-lp failed', e));
}
```

- [ ] **Step 2: publish.ts に Slack 統合**

```diff
+import { notifyNewLpPublished } from '@/lib/slack/notify-new-lp';

 export async function publishLandingPage(args: {...}): Promise<{...}> {
   ...
   await prisma.landingPage.update({...});

+  // Slack 通知 (fire-and-forget)
+  const user = await prisma.user.findUnique({
+    where: { id: args.userId },
+    select: { email: true, name: true, plan: true },
+  });
+  if (user) {
+    notifyNewLpPublished({ lp: { ...lp, slug: targetSlug }, user }).catch((e) =>
+      console.error('[publish] notify failed', e)
+    );
+  }

   const userSlug = await findUniqueUserSlug(prisma, args.userId);
   ...
 }
```

- [ ] **Step 3: customer-subscription-updated handler に Free→Starter 通知追加**

`src/lib/billing/webhook-handlers/customer-subscription-updated.ts` 内で plan 変更検出時に追加 (既存 plan-sync ロジックの後):

```typescript
// D14: Free → Starter 転換通知（KPI 監視）
if (previousPlan === 'free' && newPlan === 'starter') {
  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `💰 Free → Starter 転換! user=${user.email}`,
      }),
    }).catch(() => {});
  }
}
```

- [ ] **Step 4: cron route — lp-kpi-daily**

```typescript
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  // Bearer auth (Vercel Cron Secret)
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 北極星指標: WAU (公開完走者 / 過去 7 日)
  const wauUsers = await prisma.landingPage.findMany({
    where: { status: 'published', publishedAt: { gte: weekAgo } },
    distinct: ['userId'],
    select: { userId: true },
  });
  const wau = wauUsers.length;

  // 当日の新規 LP 公開数
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dailyPublished = await prisma.landingPage.count({
    where: { status: 'published', publishedAt: { gte: dayAgo } },
  });

  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `📊 LP Maker Daily KPI\nWAU (北極星): *${wau}*\n本日公開: ${dailyPublished} 本`,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ wau, dailyPublished });
}
```

- [ ] **Step 5: cron route — lp-kpi-weekly + 赤信号通知**

```typescript
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Sign-up 数 (新規 user) / Free→Starter 転換数 / 公開 LP 数
  const newUsers = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } });
  const starterUsers = await prisma.user.count({ where: { plan: 'starter' } });
  const freeUsers = await prisma.user.count({ where: { plan: 'free' } });
  const publishedThisWeek = await prisma.landingPage.count({
    where: { status: 'published', publishedAt: { gte: weekAgo } },
  });

  const conversionRate = freeUsers > 0 ? (starterUsers / (starterUsers + freeUsers)) * 100 : 0;
  const isRedAlert = conversionRate < 4; // 赤信号: Free→Starter 転換 4% 未満

  const webhook = process.env.SLACK_WEBHOOK_URL_NEW_USER;
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `📅 LP Maker Weekly Summary\n新規 sign-up: ${newUsers}\n公開 LP: ${publishedThisWeek}\nFree→Starter 転換率: *${conversionRate.toFixed(1)}%*${isRedAlert ? ' ⚠ 赤信号' : ''}`,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ newUsers, publishedThisWeek, conversionRate, isRedAlert });
}
```

- [ ] **Step 6: vercel.json に cron 追加**

```diff
   "crons": [
     ...
+    {
+      "path": "/api/cron/lp-kpi-daily",
+      "schedule": "0 23 * * *"
+    },
+    {
+      "path": "/api/cron/lp-kpi-weekly",
+      "schedule": "0 0 * * 1"
+    }
   ]
```

- [ ] **Step 7: 法務監査 (legal agent dispatch)**

```
legal agent に依頼:
- 公開 LP に薬機/景表/特商法/個情法のリスクがないか
- Free プラン透かしの「削除を禁止」する規約条項の確認
- 「広告も作る」連携で個情法 28 条 (越境移転) に追加対応必要か
- 600 字以内で凝縮レポート
```

報告書を `docs/superpowers/legal-audit-2026-05-17-lpmaker-pro-2.0.md` として保存。

- [ ] **Step 8: build + commit**

```bash
npm run build
git add src/lib/slack/notify-new-lp.ts 'src/app/api/cron/lp-kpi-' src/lib/lp/publish.ts src/lib/billing/webhook-handlers/customer-subscription-updated.ts vercel.json docs/superpowers/legal-audit-2026-05-17-lpmaker-pro-2.0.md
git commit -m "feat(D14-T21): add Slack notifications (new LP / Free→Starter / daily/weekly KPI cron + red alert) + legal audit"
```

---

## D15 Task 22: I-2 publish atomic 化 + Minor punch list + E2E

**Files:**
- 変更: `src/lib/lp/publish.ts` (I-2 atomic 化)
- 変更: `src/components/lp-maker/SectionPropsEditor.tsx` (Minor: boolean editor)
- 変更: `src/components/lp-maker/RegenerateModal.tsx` (Minor: ErrorBoundary)
- 変更: `src/app/lp-maker/[id]/edit/EditClient.tsx` (Minor: title editable)

- [ ] **Step 1: publish.ts atomic 化 (I-2 fix)**

順序を変更: DB update を先、OGP は後 + try/catch:

```typescript
export async function publishLandingPage(args: {...}): Promise<{...}> {
  const prisma = getPrisma();
  const lp = await prisma.landingPage.findFirst({...});
  if (!lp) throw new Error('LP not found');

  const targetSlug = args.desiredSlug?.trim() || lp.slug;

  // I-2 fix: slug update を最初に実行（uniqueness は DB 制約で担保、P2002 を catch）
  try {
    await prisma.landingPage.update({
      where: { id: lp.id },
      data: {
        slug: targetSlug,
        status: 'published',
        publishedAt: new Date(),
        ...(args.analyticsConfig && {
          analyticsConfig: args.analyticsConfig as unknown as object,
        }),
      },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      throw new Error(`slug "${targetSlug}" は既に使用中`);
    }
    throw err;
  }

  // OGP 生成は後（失敗しても publish は成立）
  const sections = lp.sections as unknown as LpSection[];
  const heroProps = sections.find((s) => s.type === 'hero')?.props as { headline?: string } | undefined;
  const headline = heroProps?.headline ?? lp.title;

  let ogImageUrl: string | undefined;
  try {
    const result = await generateOgImage({ landingPageId: lp.id, headline });
    ogImageUrl = result.ogImageUrl;
    await prisma.landingPage.update({
      where: { id: lp.id },
      data: { ogImageUrl },
    });
  } catch (err) {
    console.error('[publish] OGP gen failed, continuing without OGP', err);
    // ogImageUrl は null のまま、後で再 publish で生成可能
  }

  // Slack 通知 (D14 で追加済)
  ...

  const userSlug = await findUniqueUserSlug(prisma, args.userId);
  const publishedUrl = `https://lpmaker-pro.com/site/${userSlug}/${targetSlug}`;

  return { slug: targetSlug, ogImageUrl: ogImageUrl ?? '', publishedUrl };
}
```

- [ ] **Step 2: SectionPropsEditor で boolean / number editor 追加 (Minor)**

`FieldsRenderer` に case 追加:

```diff
   if (typeof node === 'string') { ... }
+  if (typeof node === 'boolean') {
+    return (
+      <label className="flex items-center gap-2">
+        <input type="checkbox" checked={node} onChange={(e) => onUpdate(path, e.target.checked)} className="accent-emerald-500" />
+        <span className="text-xs text-slate-300">{node ? 'ON' : 'OFF'}</span>
+      </label>
+    );
+  }
+  if (typeof node === 'number') {
+    return (
+      <input type="number" defaultValue={node} onChange={(e) => onUpdate(path, Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-100" />
+    );
+  }
   if (Array.isArray(node)) { ... }
```

- [ ] **Step 3: title editable in EditClient (Minor)**

EditClient header の `<h2>` を input に置換:

```diff
-          <h2 className="text-sm font-bold ..." title={title}>{title}</h2>
+          <input
+            type="text"
+            value={title}
+            onChange={(e) => setTitle(e.target.value)}
+            className="text-sm font-bold bg-transparent border-b border-slate-700 focus:border-emerald-500 outline-none max-w-[150px]"
+          />
```

`useState` で title を可変に + auto-save の payload に title 含める:

```diff
-const [title] = useState(initialTitle);
+const [title, setTitle] = useState(initialTitle);
```

`useAutoSave` の引数に title 追加:

```typescript
// use-auto-save.ts
interface Args {
  lpId: string;
  sections: LpSection[];
  title?: string;
}

// 内部の payload に title 含める
const payload = JSON.stringify({ sections, title });
```

PATCH route は既に title を受け取れる（Sprint 2 で zod に追加済）。

- [ ] **Step 4: build + commit**

```bash
npm run build
git add src/lib/lp/publish.ts src/components/lp-maker/SectionPropsEditor.tsx 'src/app/lp-maker/[id]/edit/EditClient.tsx' src/lib/lp/use-auto-save.ts
git commit -m "fix(D15-T22): I-2 atomic publish + Minor (boolean/number editor + editable title)"
```

- [ ] **Step 5: E2E 検証 (本番 + admin アカウント)**

ブラウザで:

1. https://lpmaker-pro.com/ にアクセス → signin → Google ログイン（admin）
2. UsageHeader に「admin / 今月 N 本」表示確認
3. 新規 LP 作成 → AI 生成 → 編集 → 「もう一案」確認
4. title input で編集 → 1.5 秒後に auto-save 発火確認
5. 「公開」ボタン → slug + GTM ID 入力 → 公開
6. 公開 URL クリック → Free プラン透かしが出ない (admin なので)
7. 「+ 広告も作る」ボタン → autobanner.jp の URL が開く

別ブラウザ (admin でない別 Google アカウント) で:
8. https://lpmaker-pro.com/ にアクセス → signin → 別 Google で SSO
9. ダッシュボードで「Free / 今月 0/1 本」表示確認
10. 新規 LP 作成 → 1 本目は成功
11. 2 本目作成試行 → 429 + UpgradeLpModal 表示
12. 公開 LP に「Powered by LP Maker Pro」透かし表示確認

- [ ] **Step 6: 動作 OK なら main へ merge**

```bash
git checkout main
git pull origin main
git merge feat/lpmaker-pro-2-sprint3 --no-ff -m "Merge feat/lpmaker-pro-2-sprint3: LP Maker Pro 2.0 production-ready"
git push origin main
```

Vercel 自動 production deploy → 本番反映。

---

## Sprint 3 完了基準 (Definition of Done)

- [ ] Stripe Live Meter `lp_generation_overage` 作成済 + Vercel env 投入
- [ ] admin only gate 全削除、plan-based gate に置換
- [ ] Free 1本 / Starter 5本 / Pro 20本+メータード / 各プランハードキャップ 動作
- [ ] Free 公開 LP に透かし焼き込み (SSR 段階)
- [ ] dashboard に UsageHeader 表示
- [ ] 「広告も作る」ボタンで autobanner.jp 連携 URL 取得
- [ ] Slack 通知 5 種 (新規 LP / Free→Starter / 日次 KPI / 週次サマリ / 赤信号) 稼働
- [ ] Vercel cron 2 件登録 (lp-kpi-daily / lp-kpi-weekly)
- [ ] publish フロー atomic 化 (I-2 解消)
- [ ] Minor 修正 (boolean/number editor + title editable + ErrorBoundary)
- [ ] legal audit 完了
- [ ] 本番 E2E 検証完了 (admin + 非 admin の 2 アカウント)
- [ ] main merge + 本番 deploy

---

## リスク・注意点

| リスク | 緩和策 |
|---|---|
| Stripe Live Meter 作成時の重複 | Step 1 の listing で事前確認、既存あれば skip |
| plan-based gate 置換時の既存 admin への影響 | admin は usage 9999/9999 で実質無制限、変更影響なし |
| 透かし焼き込みで Free 顧客の不満 | UpgradeLpModal で Starter ¥3,980 OFF 訴求、丁寧な文言 |
| autobanner.jp /ironclad prefill 未対応 | Phase 1 では URL 遷移のみ、ユーザー再入力。Phase 2 で実装 |
| Slack 通知の rate limit | fire-and-forget + catch、失敗は log のみ |
| cron 認証 (CRON_SECRET) | Bearer auth、env 設定必須 |
| publish atomic 化で既存 published LP の挙動変化 | 既存 LP は OGP 既生成済、影響なし |

---

## 次の Phase 候補 (Phase 2)

- 独自ドメイン CNAME (Pro 限定、Vercel Domains API)
- プレビュー上 inline コピー編集
- 勝ち LP 参照 (Phase A.8 ロジック LP 拡張)
- クライアント別フォルダ / 共有プレビュー URL
- 公開 LP の GA4 連携 → 編集画面に CVR 表示
- 業種別プリセット (コスメ / サプリ / SaaS / 教育 / 不動産)
- LP A/B 自動振り分け

---

**Plan ready for subagent-driven execution.**
