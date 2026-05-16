# LP Maker Pro 2.0 — Sprint 1 Implementation Plan (Pre-Sprint + D1〜D5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** banner-tsukurukun(autobanner.jp) リポジトリ内に LP Maker Pro 2.0 の DB 層・Brief 入力 UI・LP 生成 API（コピー / セクション選定 / KV 画像生成）を実装し、「Brief 入力 → DB 保存 → API 経由でフル LP データ（コピー + 画像URL）が返る」状態を達成する。

**Architecture:** ① autobanner.jp バックエンドに完全統合。② `prisma/schema.prisma` に LandingPage / LandingPageGeneration / LandingPageDomain + User 拡張を追加。③ `src/app/lp-maker/` に UI、`src/app/api/lp/` に API、`src/lib/lp/` にビジネスロジックを集約。④ Gemini 2.5 Pro `responseSchema` でコピー生成（既存 ironclad-suggest パターン継承）、gpt-image-2 で KV 画像生成（既存 image-providers/openai.ts 流用）。⑤ Pre-Sprint で lpmaker-pro.com を Vercel 同一 project に接続 + `vercel.json` rewrites + Stripe Dashboard リソース作成。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Prisma 7 (Neon Postgres) / `@google/genai` (Gemini 2.5 Pro) / `openai` (gpt-image-2) / Vercel Blob / Stripe SDK v22

**Spec:** [docs/superpowers/specs/2026-05-16-lpmaker-pro-2.0-design.md](../specs/2026-05-16-lpmaker-pro-2.0-design.md)

**Test方針:** banner-tsukurukun はテストフレーム未導入。各 Task は「TypeScript ビルド (`npm run build`) + Prisma migration 検証 + ローカル `npm run dev` + 手動 smoke test」で検証。

**前提:**
- 開発時は dev DATABASE_URL 失効中の可能性あり（メモリ参照）。失効時は `.env` の DATABASE_URL を PROD_DATABASE_URL で上書きすること。
- `~/.claude/secrets/` 配下の Vercel / Stripe / Slack トークンを利用。
- 既存 autobanner.jp の git working tree が clean な状態から開始。

---

## ファイル構成マップ

### Pre-Sprint で作成

| ファイル | 役割 |
|---|---|
| `scripts/stripe-live-setup-lp.mjs` | Stripe Live Mode の LP 用 Meter + Price + Promo Code 作成スクリプト |
| `vercel.json`（既存修正） | `lpmaker-pro.com` からの rewrite ルール追加 |

### Sprint 1 で作成

| ファイル | 役割 |
|---|---|
| `prisma/migrations/<ts>_add_lp_maker_tables/migration.sql` | LandingPage / LandingPageGeneration / LandingPageDomain + User 拡張 |
| `src/lib/lp/types.ts` | LP 関連 TypeScript 型（LpBrief / LpSection / LpGenerationResult） |
| `src/lib/lp/schemas.ts` | zod スキーマ（API バリデーション用） |
| `src/lib/lp/copy-prompts.ts` | セクション別 Gemini プロンプト |
| `src/lib/lp/copy-generator.ts` | Gemini 2.5 Pro 呼び出し（responseSchema 構造化出力） |
| `src/lib/lp/section-selector.ts` | Brief → 8 セクション組合せ判定 |
| `src/lib/lp/image-generator.ts` | gpt-image-2 KV / セクション画像生成 + Vercel Blob 保存 |
| `src/lib/lp/orchestrator.ts` | generate API のメインオーケストレータ |
| `src/app/api/lp/generate/route.ts` | POST `/api/lp/generate` ルート |
| `src/app/lp-maker/page.tsx` | ダッシュボード（LP 一覧 + 新規ボタン） |
| `src/app/lp-maker/new/page.tsx` | Brief 入力ウィザード（STEP1-3） |
| `src/components/lp-maker/BriefWizardStep1.tsx` | STEP1 商材入力 |
| `src/components/lp-maker/BriefWizardStep2.tsx` | STEP2 素材アップロード |
| `src/components/lp-maker/BriefWizardStep3.tsx` | STEP3 確認画面（AI 自動セクション選定の説明） |
| `src/components/lp-maker/LpCard.tsx` | ダッシュボードの LP カード |

### Sprint 1 で変更

| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | LandingPage / LandingPageGeneration / LandingPageDomain モデル追加 + User に LP usage カラム追加 + Generation に LpToBanner relation 追加 |
| `src/middleware.ts` | PUBLIC_PATH_PREFIXES または同等の許可リストに `/lp-maker` 系の認証要件を追加（admin/user のみアクセス可） |
| `vercel.json` | `lpmaker-pro.com` 用の rewrite ルール追加 |

---

## Task 0: 前提確認とブランチ作成

**Files:** なし（環境確認のみ）

- [ ] **Step 1: 作業ディレクトリ移動と git status 確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git status
git branch --show-current
```

期待: working tree clean、main ブランチ。

- [ ] **Step 2: Phase A.16 完了確認**

```bash
git log --oneline -5
```

期待: 直近の commit に "Phase A.16" 関連 squash merge が含まれる（メモリ: `602a4ad`）。

- [ ] **Step 3: feature ブランチ作成**

```bash
git checkout -b feat/lpmaker-pro-2-sprint1
```

- [ ] **Step 4: .env の DATABASE_URL 確認**

```bash
grep -E "^DATABASE_URL=" .env
grep -E "^PROD_DATABASE_URL=" .env
```

期待: 両方存在。dev branch 失効の場合は `.env` の `DATABASE_URL=` を `PROD_DATABASE_URL=` の値で一時的に上書き（メモリ参照: 2026-05-01 ローテート後の対処）。

---

## Pre-Sprint Task P-1: lpmaker-pro.com を Vercel 同一 project に接続

**Files:** Vercel Dashboard のみ（コード変更なし）

- [ ] **Step 1: Vercel CLI で現在の domains 確認**

```bash
npx vercel domains ls
```

期待: 既存ドメイン `autobanner.jp`, `banner-tsukurukun.vercel.app` 等が表示される。`lpmaker-pro.com` がリストに無いことを確認。

- [ ] **Step 2: lpmaker-pro.com の現状確認（手動）**

ブラウザで `https://lpmaker-pro.com` にアクセスし、現在の hosting 元（旧 LP ジェネレーター）を確認。今後 Vercel に切り替えるため、DNS 元（恐らくお名前.com or 別レジストラ）を把握しておく。

- [ ] **Step 3: Vercel project に lpmaker-pro.com を追加**

```bash
npx vercel domains add lpmaker-pro.com banner-tsukurukun
```

期待: 「Domain added」+ DNS レコード設定の指示が出る（A or CNAME）。

- [ ] **Step 4: DNS レコード切替（手動）**

レジストラ（お名前.com 等）のコントロールパネルで、`lpmaker-pro.com` の A / CNAME を Vercel が示した値に変更。TTL は 300 推奨。

- [ ] **Step 5: SSL 証明書発行待ち（自動）**

```bash
npx vercel domains inspect lpmaker-pro.com
```

期待: 5〜10 分で Verified + SSL 発行完了。

- [ ] **Step 6: 暫定リダイレクト確認**

ブラウザで `https://lpmaker-pro.com` にアクセス → autobanner.jp の現状コンテンツが表示されるかを確認（rewrites 設定前なので、トップに飛ぶはず）。

**注意:** この時点では DNS 切替が走るため、旧 lpmaker-pro.com の旧コンテンツは閲覧不能になります。Phase 1 リリース前に切るかどうかは要判断。**先にお名前.com の DNS 設定の現状値を screenshot で記録**しておくこと（rollback 用）。

- [ ] **Step 7: commit（コード変更なしだが作業記録）**

```bash
git commit --allow-empty -m "chore(P-1): connect lpmaker-pro.com to Vercel project"
```

---

## Pre-Sprint Task P-2: vercel.json rewrites 設定

**Files:**
- 変更: `vercel.json`

- [ ] **Step 1: 既存 vercel.json の現状確認**

```bash
cat vercel.json
```

期待: 既存の cron 設定や rewrites がある。これらは保持。

- [ ] **Step 2: rewrites 追加**

`vercel.json` に以下の rewrites を追加（既存配列にマージ）。`lpmaker-pro.com` 経由のリクエストを autobanner.jp 内部ルートに変換:

```json
{
  "rewrites": [
    {
      "source": "/app/:path*",
      "has": [
        { "type": "host", "value": "lpmaker-pro.com" }
      ],
      "destination": "/lp-maker/:path*"
    },
    {
      "source": "/site/:path*",
      "has": [
        { "type": "host", "value": "lpmaker-pro.com" }
      ],
      "destination": "/site/:path*"
    },
    {
      "source": "/api/lp/:path*",
      "has": [
        { "type": "host", "value": "lpmaker-pro.com" }
      ],
      "destination": "/api/lp/:path*"
    },
    {
      "source": "/api/auth/:path*",
      "has": [
        { "type": "host", "value": "lpmaker-pro.com" }
      ],
      "destination": "/api/auth/:path*"
    },
    {
      "source": "/",
      "has": [
        { "type": "host", "value": "lpmaker-pro.com" }
      ],
      "destination": "/lp-maker-home"
    }
  ]
}
```

- [ ] **Step 3: `/lp-maker-home` のスタブ作成**

`src/app/lp-maker-home/page.tsx` を作成（暫定 placeholder）:

```tsx
export const dynamic = 'force-static';

export default function LpMakerHomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">LP Maker Pro 2.0</h1>
      <p className="text-slate-400">準備中。まもなく公開します。</p>
      <a href="/app" className="mt-6 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded">
        β 版を試す
      </a>
    </main>
  );
}
```

- [ ] **Step 4: build 検証**

```bash
npm run build
```

期待: TypeScript / Next.js build 通過。エラーがあれば修正。

- [ ] **Step 5: commit**

```bash
git add vercel.json src/app/lp-maker-home/page.tsx
git commit -m "feat(P-2): add vercel rewrites for lpmaker-pro.com + placeholder home"
```

- [ ] **Step 6: preview deploy で疎通確認**

```bash
npx vercel
```

期待: deploy URL が表示される。`https://<deploy>.vercel.app/lp-maker-home` でスタブが表示される。

---

## Pre-Sprint Task P-3: Stripe Live Mode に LP 用 Meter + Price + Promo Code 作成

**Files:**
- 作成: `scripts/stripe-live-setup-lp.mjs`

- [ ] **Step 1: 既存 stripe-live-setup スクリプト構造の確認**

```bash
ls scripts/ | grep stripe
head -50 scripts/stripe-live-setup.mjs
```

期待: 既存 Phase A.12 のセットアップスクリプトが存在。同じパターンを踏襲。

- [ ] **Step 2: scripts/stripe-live-setup-lp.mjs 作成**

```javascript
#!/usr/bin/env node
/**
 * LP Maker Pro 2.0: Stripe Live Mode の LP 用リソース作成
 *
 * - Meter: lp_generation_overage
 * - Price: Pro Metered LP (¥980/本 graduated metered)
 * - Promotion Code: LPMAKER_EARLY (50% OFF, max 50, 60日有効)
 *
 * 実行前に scripts/stripe-live-ids.json が既存（A.12 で生成済み）であること。
 * 生成した ID は scripts/stripe-live-ids-lp.json に保存。
 */
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

// 1. Meter: lp_generation_overage
const meter = await stripe.billing.meters.create({
  display_name: 'LP Generation Overage',
  event_name: 'lp_generation_overage',
  default_aggregation: { formula: 'sum' },
  customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
  value_settings: { event_payload_key: 'value' },
});
console.log('Meter created:', meter.id);

// 2. Pro Metered LP Price (¥980/本 graduated metered)
const priceLpMetered = await stripe.prices.create({
  product: proProductId,
  currency: 'jpy',
  recurring: {
    interval: 'month',
    usage_type: 'metered',
    meter: meter.id,
  },
  billing_scheme: 'tiered',
  tiers_mode: 'graduated',
  tiers: [
    { up_to: 20, unit_amount: 0 },           // 最初の 20 本は無料（base 料金内）
    { up_to: 'inf', unit_amount: 980 },       // 21 本目以降は ¥980/本
  ],
  nickname: 'Pro LP Metered',
});
console.log('Pro Metered LP Price created:', priceLpMetered.id);

// 3. Promotion Code: LPMAKER_EARLY
const coupon = await stripe.coupons.create({
  duration: 'once',
  percent_off: 50,
  max_redemptions: 50,
  name: 'LPMAKER_EARLY 50% OFF',
  redeem_by: Math.floor(Date.now() / 1000) + 60 * 86400, // 60 日後
});
console.log('Coupon created:', coupon.id);

const promo = await stripe.promotionCodes.create({
  coupon: coupon.id,
  code: 'LPMAKER_EARLY',
  max_redemptions: 50,
});
console.log('Promotion Code created:', promo.id, '/ code:', promo.code);

// 結果保存
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
console.log('=== 完了。stripe-live-ids-lp.json に保存しました ===');
console.log(outIds);
```

- [ ] **Step 3: .gitignore に追加**

```bash
echo "scripts/stripe-live-ids-lp.json" >> .gitignore
```

- [ ] **Step 4: dry-run（事前 listing 確認）**

```bash
node -e "
import('stripe').then(async ({default: Stripe}) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const key = fs.readFileSync(path.join(process.env.USERPROFILE, '.claude/secrets/stripe-live-token'), 'utf-8').trim();
  const s = new Stripe(key, {apiVersion: '2026-04-22.dahlia'});
  const meters = await s.billing.meters.list({limit: 100});
  const lpMeter = meters.data.find(m => m.event_name === 'lp_generation_overage');
  console.log('既存 LP Meter:', lpMeter ? lpMeter.id : 'なし');
  const promos = await s.promotionCodes.list({code: 'LPMAKER_EARLY'});
  console.log('既存 LPMAKER_EARLY:', promos.data.length, '件');
});
"
```

期待: 両方「なし / 0 件」。既にあれば既存を尊重し、重複作成を回避。

- [ ] **Step 5: スクリプト実行**

```bash
node scripts/stripe-live-setup-lp.mjs
```

期待: 3 リソース作成完了 + `scripts/stripe-live-ids-lp.json` 生成。

- [ ] **Step 6: Vercel env に LP 関連 Stripe ID を投入**

```bash
node scripts/vercel-set-env.mjs \
  --sensitive STRIPE_LP_METER_ID=<meter.id> \
  STRIPE_LP_METER_EVENT_NAME=lp_generation_overage \
  STRIPE_PRICE_PRO_LP_METERED=<priceLpMetered.id> \
  STRIPE_PROMO_LPMAKER_EARLY=<promo.id>
```

期待: production / preview env に 4 変数が投入される。

- [ ] **Step 7: commit**

```bash
git add scripts/stripe-live-setup-lp.mjs .gitignore
git commit -m "feat(P-3): add Stripe live mode LP meter + metered price + LPMAKER_EARLY promo"
```

---

## CP1 完了基準（Pre-Sprint）

- `lpmaker-pro.com` が Vercel project にぶら下がり、SSL 発行済
- `vercel.json` rewrites で `lpmaker-pro.com/app/*` が `/lp-maker/*` にルートされる
- `/lp-maker-home` placeholder が `lpmaker-pro.com` のトップで表示される
- Stripe Live に `lp_generation_overage` Meter + Pro Metered LP Price + LPMAKER_EARLY Promo が存在
- Vercel production env に 4 つの STRIPE_LP_* 変数が投入済

---

## Sprint 1 / D1 — Task 1: Prisma schema 拡張 + migration

**Files:**
- 変更: `prisma/schema.prisma`
- 作成: `prisma/migrations/<ts>_add_lp_maker_tables/migration.sql`（Prisma が自動生成）

- [ ] **Step 1: User モデル末尾を確認**

```bash
grep -n "model User" prisma/schema.prisma
```

期待: User モデルの位置を把握。

- [ ] **Step 2: schema.prisma に LandingPage モデル追加**

`prisma/schema.prisma` の末尾、または他モデル群の近くに追加:

```prisma
/// LP Maker Pro 2.0 (2026-05-16): Brief → セクション組合せ型 LP のメインテーブル
/// sections は [{ type: string, order: number, enabled: boolean, props: Json }] 配列
model LandingPage {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// URL 用 slug（user 内ユニーク）
  slug            String
  /// "draft" | "published" | "archived"
  status          String   @default("draft")
  title           String

  /// IroncladMaterials 互換 + LP 固有フィールド（productName, lpUrl, target, offer, etc）
  brief           Json
  /// セクション配列（後述）
  sections        Json
  /// 公開時刻（status が published になった時に set）
  publishedAt     DateTime?
  /// Phase 2 用：独自ドメイン CNAME
  customDomain    String?  @unique
  /// 自動生成された OGP 画像 URL
  ogImageUrl      String?
  /// GTM / GA4 / Clarity / Pixel ID 設定（JSON）
  analyticsConfig Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  generations     LandingPageGeneration[]
  linkedBanners   Generation[]            @relation("LpToBanner")

  @@unique([userId, slug])
  @@index([status, publishedAt])
}

/// LP Maker Pro 2.0: ブロック単位の生成履歴（"もう一案" 履歴 + 巻き戻し用）
model LandingPageGeneration {
  id              String      @id @default(cuid())
  landingPageId   String
  landingPage     LandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)

  /// "hero" | "problem" | "solution" | "features" | "comparison" | "voice" | "pricing" | "faq" | "final_cta" | "numeric_proof" | "inline_cta"
  sectionType     String
  /// Gemini に渡したプロンプト全文（デバッグ用）
  prompt          String      @db.Text
  /// 生成結果 JSON
  output          Json
  /// Free プラン透かし用（透かし入り版か）
  isPreview       Boolean     @default(false)

  createdAt       DateTime    @default(now())

  @@index([landingPageId, sectionType])
}

/// LP Maker Pro 2.0 / Phase 2: 独自ドメイン CNAME 連携テーブル
model LandingPageDomain {
  id              String   @id @default(cuid())
  landingPageId   String   @unique
  domain          String   @unique
  verifiedAt      DateTime?
  vercelDomainId  String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 3: User モデル拡張**

`prisma/schema.prisma` の User モデル内の適切な位置（既存 usageCount の近く）に追加:

```prisma
  /// LP Maker Pro 2.0: LP 生成数の月次カウンタ（autobanner.jp の usageCount と独立）
  currentMonthLpUsageCount  Int       @default(0)
  /// LP Maker Pro 2.0: Pro 超過アラート（21 本目で 1 度のみ表示）の last shown
  /// payment_succeeded webhook で NULL リセット
  proLpOverageNoticeShownAt DateTime?

  /// LandingPage との一対多リレーション
  landingPages              LandingPage[]
```

- [ ] **Step 4: Generation モデルに LpToBanner relation 追加**

既存 `Generation` モデル内に追加:

```prisma
  /// LP Maker Pro 2.0: この Generation がどの LP の「広告も作る」連携から生成されたか
  sourceLpId String?
  sourceLp   LandingPage? @relation("LpToBanner", fields: [sourceLpId], references: [id], onDelete: SetNull)

  @@index([sourceLpId])
```

注: 既存 Generation モデル内に `@@index` 行があれば、その後ろに追加。

- [ ] **Step 5: Prisma validate**

```bash
npx prisma validate
```

期待: `The schema at prisma/schema.prisma is valid`。

- [ ] **Step 6: migration 作成（dev DB に適用）**

```bash
npx prisma migrate dev --name add_lp_maker_tables
```

期待:
- `prisma/migrations/<ts>_add_lp_maker_tables/migration.sql` が生成される
- dev DB に migration が適用される（dev branch が失効していれば PROD_DATABASE_URL に切替）

- [ ] **Step 7: 生成された migration.sql を確認**

```bash
ls prisma/migrations/ | tail -3
cat prisma/migrations/*add_lp_maker_tables/migration.sql | head -80
```

期待: 3 テーブル作成 + User / Generation の ALTER TABLE。

- [ ] **Step 8: Prisma Client 再生成**

```bash
npx prisma generate
```

期待: `Generated Prisma Client (...)`. 型に LandingPage / LandingPageGeneration / LandingPageDomain が現れる。

- [ ] **Step 9: TypeScript build 検証**

```bash
npm run build
```

期待: build 通過。Prisma 型エラーなし。

- [ ] **Step 10: 本番 DB への migration（後で D15 にやる、ここはまだ）**

メモのみ:
- D15 (Sprint 3 最終日) で `scripts/migrate-prod.mjs` を実行して本番に適用
- それまでは dev branch (or PROD_DATABASE_URL 上書き) のみで動作確認

- [ ] **Step 11: commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(D1-T1): add LP Maker Pro 2.0 Prisma schema (LandingPage / LandingPageGeneration / LandingPageDomain + User extension)"
```

---

## Sprint 1 / D1 — Task 2: 型定義 + zod schema

**Files:**
- 作成: `src/lib/lp/types.ts`
- 作成: `src/lib/lp/schemas.ts`

- [ ] **Step 1: src/lib/lp/ ディレクトリ作成**

```bash
mkdir -p src/lib/lp
```

- [ ] **Step 2: types.ts 作成**

`src/lib/lp/types.ts`:

```typescript
/**
 * LP Maker Pro 2.0 — 型定義
 *
 * Brief: ユーザー入力（商品情報 + ターゲット + オファー）
 * LpSection: セクション組合せ型 LP の 1 ブロック
 * LpGenerationResult: AI 生成結果（コピー + 画像 URL）
 */

/** LP セクションの種別 */
export const LP_SECTION_TYPES = [
  'hero',           // FV
  'problem',        // 課題提起
  'solution',       // 解決策
  'features',       // 機能紹介
  'numeric_proof',  // 数字訴求
  'comparison',     // 比較表
  'voice',          // お客様の声
  'pricing',        // 料金
  'faq',            // FAQ
  'inline_cta',     // セクション間 CTA
  'final_cta',      // 最終 CTA
] as const;

export type LpSectionType = typeof LP_SECTION_TYPES[number];

/** LP の Brief（ユーザー入力） */
export interface LpBrief {
  /** 商品名 / サービス名 */
  productName: string;
  /** 既存 LP URL（任意。自動分析の入力源） */
  lpUrl?: string;
  /** ターゲット記述 */
  target: string;
  /** オファー（特典 / 価格 / 期間限定など） */
  offer: string;
  /** 業種抽象タグ（winning-banner 流用 / AI 補完） */
  industryTags?: string[];
  /** ユーザー添付素材 ID（Asset テーブル ID） */
  materialAssetIds?: string[];
}

/** セクションごとのプロパティ（生成結果） */
export interface LpSection {
  type: LpSectionType;
  order: number;
  enabled: boolean;
  /** セクション固有のコピー / 画像 URL / その他 */
  props: Record<string, unknown>;
}

/** LP 全体の生成結果 */
export interface LpGenerationResult {
  /** 生成された LandingPage の ID */
  landingPageId: string;
  /** タイトル（OGP / sitemap 用） */
  title: string;
  /** セクション配列 */
  sections: LpSection[];
  /** KV 画像 URL */
  kvImageUrl: string;
  /** OGP 画像 URL */
  ogImageUrl: string;
}

/** 各セクション型に対応する props の最小スキーマ（lib/lp/copy-generator で詳細化） */
export interface HeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  imageUrl?: string;
}

export interface ProblemProps {
  headline: string;
  items: { title: string; description: string }[];
}

export interface SolutionProps {
  headline: string;
  description: string;
  imageUrl?: string;
}

export interface FeatureItem {
  title: string;
  description: string;
  iconHint?: string;
}

export interface FeaturesProps {
  headline: string;
  items: FeatureItem[];
}

export interface NumericProofProps {
  items: { number: string; label: string; note?: string }[];
}

export interface ComparisonProps {
  headline: string;
  columns: { name: string; rows: string[] }[];
  rowLabels: string[];
}

export interface VoiceProps {
  headline: string;
  items: { quote: string; author: string; proofBadge?: string }[];
}

export interface PricingProps {
  headline: string;
  plans: { name: string; price: string; features: string[]; ctaText: string }[];
}

export interface FaqProps {
  headline: string;
  items: { question: string; answer: string }[];
}

export interface CtaProps {
  headline: string;
  buttonText: string;
  note?: string;
}
```

- [ ] **Step 3: schemas.ts 作成（zod スキーマ）**

`src/lib/lp/schemas.ts`:

```typescript
/**
 * LP Maker Pro 2.0 — zod スキーマ（API ルート用）
 *
 * `/api/lp/generate` のリクエストバリデーション、
 * `/api/lp/[id]/section/[type]/regenerate` のリクエストバリデーション等で使用。
 *
 * 注: 既存プロジェクトに zod が入っていない場合は npm install zod を実行。
 */
import { z } from 'zod';
import { LP_SECTION_TYPES } from './types';

/** Brief 入力スキーマ */
export const LpBriefSchema = z.object({
  productName: z.string().min(1).max(200),
  lpUrl: z.string().url().optional(),
  target: z.string().min(1).max(2000),
  offer: z.string().min(1).max(1000),
  industryTags: z.array(z.string()).max(10).optional(),
  materialAssetIds: z.array(z.string().cuid()).max(10).optional(),
});

/** /api/lp/generate リクエストスキーマ */
export const LpGenerateRequestSchema = z.object({
  brief: LpBriefSchema,
  /** false の場合は AI 自動セクション選定。true の場合はクライアントから指定（Phase 2 用） */
  customSectionsOverride: z.array(z.enum(LP_SECTION_TYPES)).optional(),
});

export type LpGenerateRequest = z.infer<typeof LpGenerateRequestSchema>;
```

- [ ] **Step 4: zod 依存確認 + 必要なら install**

```bash
grep -E '"zod"' package.json
```

期待: zod が依存にある。**ない場合**:

```bash
npm install zod
```

- [ ] **Step 5: TypeScript build 検証**

```bash
npm run build
```

期待: build 通過。型エラーなし。

- [ ] **Step 6: commit**

```bash
git add src/lib/lp/types.ts src/lib/lp/schemas.ts package.json package-lock.json
git commit -m "feat(D1-T2): add LP Maker Pro 2.0 types + zod schemas"
```

---

## Sprint 1 / D2 — Task 3: ダッシュボード + Brief 入力ウィザード UI

**Files:**
- 作成: `src/app/lp-maker/page.tsx`（ダッシュボード）
- 作成: `src/app/lp-maker/new/page.tsx`（Brief 入力ウィザードホスト）
- 作成: `src/components/lp-maker/BriefWizardStep1.tsx`
- 作成: `src/components/lp-maker/BriefWizardStep2.tsx`
- 作成: `src/components/lp-maker/BriefWizardStep3.tsx`
- 作成: `src/components/lp-maker/LpCard.tsx`

- [ ] **Step 1: 既存 ironclad UI コンポーネントの構造確認**

```bash
ls src/components/ironclad/
head -30 src/components/ironclad/IroncladGenerateScreen.tsx
```

期待: 既存パターン把握。同じ Tailwind トーン（slate-950 base / emerald accent）を踏襲。

- [ ] **Step 2: ダッシュボード `src/app/lp-maker/page.tsx` 作成**

```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { LpCard } from '@/components/lp-maker/LpCard';

export const dynamic = 'force-dynamic';

export default async function LpMakerDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/api/auth/signin?callbackUrl=/lp-maker');

  const prisma = getPrisma();
  const landingPages = await prisma.landingPage.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">LP Maker Pro 2.0</h1>
            <p className="text-slate-400 mt-1">
              ブリーフから LP と広告 17 サイズを同時生成
            </p>
          </div>
          <Link
            href="/lp-maker/new"
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg"
          >
            ＋ 新規 LP を作る
          </Link>
        </header>

        {landingPages.length === 0 ? (
          <div className="text-center py-16 bg-slate-900 rounded-lg">
            <p className="text-slate-400 mb-4">まだ LP がありません</p>
            <Link
              href="/lp-maker/new"
              className="inline-block px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded"
            >
              最初の LP を作る
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {landingPages.map((lp) => (
              <LpCard key={lp.id} lp={lp} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: LpCard `src/components/lp-maker/LpCard.tsx` 作成**

```tsx
import Link from 'next/link';
import type { LandingPage } from '@prisma/client';

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  published: '公開中',
  archived: 'アーカイブ',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-300',
  published: 'bg-emerald-500 text-slate-950',
  archived: 'bg-slate-800 text-slate-500',
};

export function LpCard({ lp }: { lp: LandingPage }) {
  return (
    <Link
      href={`/lp-maker/${lp.id}/edit`}
      className="block bg-slate-900 hover:bg-slate-800 rounded-lg p-5 border border-slate-800 hover:border-emerald-500/30 transition"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-slate-100 line-clamp-2">{lp.title}</h3>
        <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[lp.status] ?? 'bg-slate-700'}`}>
          {STATUS_LABELS[lp.status] ?? lp.status}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        更新: {new Date(lp.updatedAt).toLocaleString('ja-JP')}
      </p>
      {lp.publishedAt && (
        <p className="text-xs text-emerald-400 mt-1">
          公開: {new Date(lp.publishedAt).toLocaleDateString('ja-JP')}
        </p>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: ウィザードホスト `src/app/lp-maker/new/page.tsx` 作成**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BriefWizardStep1 } from '@/components/lp-maker/BriefWizardStep1';
import { BriefWizardStep2 } from '@/components/lp-maker/BriefWizardStep2';
import { BriefWizardStep3 } from '@/components/lp-maker/BriefWizardStep3';
import type { LpBrief } from '@/lib/lp/types';

export default function NewLpPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [brief, setBrief] = useState<Partial<LpBrief>>({
    productName: '',
    lpUrl: '',
    target: '',
    offer: '',
    materialAssetIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/lp/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { landingPageId } = await res.json();
      router.push(`/lp-maker/${landingPageId}/edit`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成に失敗しました');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">新規 LP を作る</h1>
        <p className="text-slate-400 text-sm mb-6">STEP {step} / 3</p>

        {step === 1 && (
          <BriefWizardStep1
            brief={brief}
            onChange={setBrief}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <BriefWizardStep2
            brief={brief}
            onChange={setBrief}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <BriefWizardStep3
            brief={brief}
            submitting={submitting}
            error={error}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: BriefWizardStep1 作成**

`src/components/lp-maker/BriefWizardStep1.tsx`:

```tsx
'use client';
import type { LpBrief } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  onChange: (b: Partial<LpBrief>) => void;
  onNext: () => void;
}

export function BriefWizardStep1({ brief, onChange, onNext }: Props) {
  const canNext = !!(brief.productName && brief.target && brief.offer);

  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 1: 商材を教えてください</h2>

      <label className="block">
        <span className="text-sm text-slate-300">既存 LP URL（任意）</span>
        <input
          type="url"
          value={brief.lpUrl ?? ''}
          onChange={(e) => onChange({ ...brief, lpUrl: e.target.value })}
          placeholder="https://example.com/product"
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
        <span className="text-xs text-slate-500">入力すると商品情報を自動分析します</span>
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          商品名 / サービス名 <span className="text-red-400">*</span>
        </span>
        <input
          type="text"
          value={brief.productName ?? ''}
          onChange={(e) => onChange({ ...brief, productName: e.target.value })}
          placeholder="例: 5 Point Detox"
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          ターゲット <span className="text-red-400">*</span>
        </span>
        <textarea
          value={brief.target ?? ''}
          onChange={(e) => onChange({ ...brief, target: e.target.value })}
          placeholder="例: 30〜40代の働く女性、ダイエットに何度も挫折経験あり、即効性と続けやすさを両立した方法を探している"
          rows={3}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-300">
          オファー <span className="text-red-400">*</span>
        </span>
        <textarea
          value={brief.offer ?? ''}
          onChange={(e) => onChange({ ...brief, offer: e.target.value })}
          placeholder="例: 初回限定 980 円（70% OFF）+ 14日間返金保証 + 送料無料"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
        />
      </label>

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!canNext}
          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded disabled:opacity-30 disabled:cursor-not-allowed"
        >
          次へ →
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: BriefWizardStep2 作成（素材アップロード Phase 1 は skip 可能な最小版）**

`src/components/lp-maker/BriefWizardStep2.tsx`:

```tsx
'use client';
import type { LpBrief } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  onChange: (b: Partial<LpBrief>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function BriefWizardStep2({ brief, onBack, onNext }: Props) {
  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 2: 素材（任意）</h2>
      <p className="text-sm text-slate-400">
        商品画像 / ロゴ / 認証バッジは autobanner.jp の素材ライブラリと共有します。
        Phase 1 では素材アップロードはスキップ可能です（KV 画像は AI 自動生成）。
      </p>
      <p className="text-sm text-emerald-400">
        ※ Phase 1 では素材選択 UI は最小実装。autobanner.jp /ironclad の Asset 選択画面を
        Phase 2 で統合予定。
      </p>
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded"
        >
          ← 戻る
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded"
        >
          次へ →
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: BriefWizardStep3 作成（確認 + 生成開始）**

`src/components/lp-maker/BriefWizardStep3.tsx`:

```tsx
'use client';
import type { LpBrief } from '@/lib/lp/types';

interface Props {
  brief: Partial<LpBrief>;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}

export function BriefWizardStep3({ brief, submitting, error, onBack, onSubmit }: Props) {
  return (
    <section className="bg-slate-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">STEP 3: 確認 → AI 生成開始</h2>

      <div className="bg-slate-800 rounded p-4 space-y-2 text-sm">
        <p><span className="text-slate-500">商品名:</span> {brief.productName}</p>
        {brief.lpUrl && <p><span className="text-slate-500">既存 LP:</span> {brief.lpUrl}</p>}
        <p><span className="text-slate-500">ターゲット:</span> {brief.target}</p>
        <p><span className="text-slate-500">オファー:</span> {brief.offer}</p>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-4 text-sm">
        <p className="font-bold text-emerald-300 mb-1">AI 自動セクション選定</p>
        <p className="text-slate-300">
          ブリーフから業種・オファー特性を判断し、8 セクションの最適な組合せを自動決定します。
          編集画面でいつでも変更可能です。
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 rounded p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          disabled={submitting}
          className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded disabled:opacity-50"
        >
          ← 戻る
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded disabled:opacity-50"
        >
          {submitting ? '生成中…（最大3分）' : '✨ AI で LP を生成する'}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: middleware で /lp-maker を認証必須に追加**

```bash
grep -n "PUBLIC_PATH_PREFIXES\|PUBLIC_PATHS\|/lp-maker" src/middleware.ts
```

期待: 既存パターン把握。`/lp-maker` 系は **public ではなく**、認証必須として扱う。NextAuth `signin` callback の既存ロジックが効くため、追加コードは恐らく不要（既存 `/account` 等と同じ扱い）。**確認のみ**。

- [ ] **Step 9: TypeScript build 検証**

```bash
npm run build
```

期待: build 通過。

- [ ] **Step 10: ローカル smoke test**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/lp-maker` にアクセス（Google SSO ログイン後）:
- ダッシュボードが表示される（landingPages 空なので「最初の LP を作る」CTA）
- `/lp-maker/new` で STEP1 → STEP2 → STEP3 をクリック遷移できる
- STEP3 の「✨ AI で LP を生成する」ボタンは押すと 500 エラー（API 未実装、想定通り）

- [ ] **Step 11: commit**

```bash
git add src/app/lp-maker/ src/components/lp-maker/
git commit -m "feat(D2-T3): add lp-maker dashboard + Brief wizard UI (STEP1-3 + LpCard)"
```

---

## Sprint 1 / D3 — Task 4: `/api/lp/generate` Gemini コピー生成

**Files:**
- 作成: `src/lib/lp/copy-prompts.ts`
- 作成: `src/lib/lp/copy-generator.ts`
- 作成: `src/lib/lp/orchestrator.ts`
- 作成: `src/app/api/lp/generate/route.ts`

- [ ] **Step 1: 既存 ironclad-suggest の Gemini 呼び出しパターンを参考に**

```bash
head -150 src/app/api/ironclad-suggest/route.ts
```

期待: `GoogleGenAI` import / `responseSchema` 定義 / `ai.models.generateContent` パターンを把握。

- [ ] **Step 2: copy-prompts.ts 作成（セクション別 Gemini プロンプト）**

`src/lib/lp/copy-prompts.ts`:

```typescript
import type { LpBrief, LpSectionType } from './types';

/**
 * セクション別の Gemini プロンプト生成。
 *
 * 各セクションが必要とするフィールドを responseSchema で厳密に拘束し、
 * Gemini に余計な自由度を与えない。
 */
export function buildSystemPrompt(brief: LpBrief): string {
  return `
あなたはコンバージョン特化型の LP コピーライターです。
以下のブリーフをもとに、日本の景表法・薬機法に違反しない範囲で、
読者の購買意欲を最大化するコピーを生成してください。

# 厳守ルール
- 「絶対」「100%」「必ず治る」等の断定表現は禁止。
- 数字訴求には必ず「※個人の感想です」「※当社調べ」等の根拠注記を併記。
- 薬機法カテゴリ（化粧品/サプリ/健康食品）では「治癒・改善・効果」表現を禁止。
- ターゲットの言葉を使い、過度に専門用語を使わない。
- 一文は短く、読みやすく。

# ブリーフ
- 商品名: ${brief.productName}
- ターゲット: ${brief.target}
- オファー: ${brief.offer}
${brief.lpUrl ? `- 既存 LP URL（参考）: ${brief.lpUrl}` : ''}
${brief.industryTags?.length ? `- 業種タグ: ${brief.industryTags.join(', ')}` : ''}
`.trim();
}

export function buildUserPromptForSection(sectionType: LpSectionType): string {
  const guides: Record<LpSectionType, string> = {
    hero: `
ファーストビュー（FV）のコピーを生成してください。
- headline: 30 字以内、最大訴求ベネフィット
- subheadline: 50 字以内、補強コピー
- ctaText: 12 字以内、行動喚起ボタン文言
`.trim(),
    problem: `
ターゲットが抱える課題提起セクションを生成してください。
- headline: 30 字以内
- items: 3 つの課題（title 15 字 / description 60 字）
`.trim(),
    solution: `
解決策セクションを生成してください。
- headline: 30 字以内
- description: 120 字以内
`.trim(),
    features: `
機能紹介セクションを生成してください。
- headline: 30 字以内
- items: 4 つの機能（title 15 字 / description 80 字 / iconHint: lucide-react のアイコン名候補 1 つ）
`.trim(),
    numeric_proof: `
数字訴求セクションを生成してください。
- items: 3 つの数字（number: "97%" 等、label: 30 字以内、note: ※注記 任意）
`.trim(),
    comparison: `
比較表セクションを生成してください。
- headline: 30 字以内
- rowLabels: 比較項目 5 つ（例: 制作時間 / 月額費用 / etc）
- columns: ["${'${brief.productName}'}", "従来の方法", "他社サービス"] の 3 列、各 rows は rowLabels と同数
`.trim(),
    voice: `
お客様の声セクションを生成してください。
- headline: 30 字以内
- items: 3 つの voice（quote 80 字以内、author 30 字以内、proofBadge: "代理店勤務" 等 任意）
- ※「個人の感想です」を quote 末尾に付ける
`.trim(),
    pricing: `
料金セクションを生成してください。
- headline: 30 字以内
- plans: 3 つのプラン（Free / Starter / Pro）。price は ¥表記。features は各 4 個。ctaText 12 字以内
`.trim(),
    faq: `
FAQ セクションを生成してください。
- headline: 30 字以内
- items: 6 つの Q&A（question 50 字、answer 150 字以内）
`.trim(),
    inline_cta: `
セクション間 CTA を生成してください。
- headline: 30 字以内
- buttonText: 12 字以内
- note: 任意（30 字以内）
`.trim(),
    final_cta: `
最終 CTA を生成してください。
- headline: 50 字以内、強い行動喚起
- buttonText: 12 字以内
- note: 任意（30 字以内、保証・特典等）
`.trim(),
  };
  return guides[sectionType];
}
```

- [ ] **Step 3: copy-generator.ts 作成（Gemini 呼び出し）**

`src/lib/lp/copy-generator.ts`:

```typescript
import { GoogleGenAI, Type } from '@google/genai';
import type { LpBrief, LpSectionType } from './types';
import { buildSystemPrompt, buildUserPromptForSection } from './copy-prompts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * セクション型ごとの responseSchema。
 * Gemini に厳密な JSON 構造を強制する。
 */
function schemaForSection(sectionType: LpSectionType) {
  switch (sectionType) {
    case 'hero':
      return {
        type: Type.OBJECT,
        required: ['headline', 'subheadline', 'ctaText'],
        properties: {
          headline: { type: Type.STRING },
          subheadline: { type: Type.STRING },
          ctaText: { type: Type.STRING },
        },
      };
    case 'problem':
      return {
        type: Type.OBJECT,
        required: ['headline', 'items'],
        properties: {
          headline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['title', 'description'],
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'solution':
      return {
        type: Type.OBJECT,
        required: ['headline', 'description'],
        properties: {
          headline: { type: Type.STRING },
          description: { type: Type.STRING },
        },
      };
    case 'features':
      return {
        type: Type.OBJECT,
        required: ['headline', 'items'],
        properties: {
          headline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            minItems: '4',
            maxItems: '4',
            items: {
              type: Type.OBJECT,
              required: ['title', 'description'],
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                iconHint: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'numeric_proof':
      return {
        type: Type.OBJECT,
        required: ['items'],
        properties: {
          items: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['number', 'label'],
              properties: {
                number: { type: Type.STRING },
                label: { type: Type.STRING },
                note: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'comparison':
      return {
        type: Type.OBJECT,
        required: ['headline', 'rowLabels', 'columns'],
        properties: {
          headline: { type: Type.STRING },
          rowLabels: { type: Type.ARRAY, minItems: '5', maxItems: '5', items: { type: Type.STRING } },
          columns: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['name', 'rows'],
              properties: {
                name: { type: Type.STRING },
                rows: { type: Type.ARRAY, minItems: '5', maxItems: '5', items: { type: Type.STRING } },
              },
            },
          },
        },
      };
    case 'voice':
      return {
        type: Type.OBJECT,
        required: ['headline', 'items'],
        properties: {
          headline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['quote', 'author'],
              properties: {
                quote: { type: Type.STRING },
                author: { type: Type.STRING },
                proofBadge: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'pricing':
      return {
        type: Type.OBJECT,
        required: ['headline', 'plans'],
        properties: {
          headline: { type: Type.STRING },
          plans: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            items: {
              type: Type.OBJECT,
              required: ['name', 'price', 'features', 'ctaText'],
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.STRING },
                features: { type: Type.ARRAY, minItems: '4', maxItems: '4', items: { type: Type.STRING } },
                ctaText: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'faq':
      return {
        type: Type.OBJECT,
        required: ['headline', 'items'],
        properties: {
          headline: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            minItems: '6',
            maxItems: '6',
            items: {
              type: Type.OBJECT,
              required: ['question', 'answer'],
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
              },
            },
          },
        },
      };
    case 'inline_cta':
    case 'final_cta':
      return {
        type: Type.OBJECT,
        required: ['headline', 'buttonText'],
        properties: {
          headline: { type: Type.STRING },
          buttonText: { type: Type.STRING },
          note: { type: Type.STRING },
        },
      };
  }
}

/**
 * 単一セクションのコピーを Gemini 2.5 Pro で生成。
 *
 * 1 回のリトライで構造化失敗をリカバー。
 */
export async function generateSectionCopy(
  brief: LpBrief,
  sectionType: LpSectionType
): Promise<Record<string, unknown>> {
  const systemPrompt = buildSystemPrompt(brief);
  const userPrompt = buildUserPromptForSection(sectionType);
  const schema = schemaForSection(sectionType);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      const text = result.text;
      if (!text) throw new Error('Gemini empty response');
      const parsed = JSON.parse(text);
      return parsed;
    } catch (err) {
      console.error(`[copy-generator] section=${sectionType} attempt=${attempt} error`, err);
      if (attempt === 2) throw err;
      // attempt 2 へ
    }
  }
  throw new Error('unreachable');
}
```

- [ ] **Step 4: orchestrator.ts 作成（generate API のメインオーケストレータ・コピーのみ Task 4 で）**

`src/lib/lp/orchestrator.ts`:

```typescript
import { getPrisma } from '@/lib/prisma';
import type { LpBrief, LpSection, LpSectionType } from './types';
import { generateSectionCopy } from './copy-generator';

/**
 * LP 全体を生成して DB に保存。
 *
 * Task 4 では: 全セクション固定（8 種）でコピー生成 + DB 保存。
 * Task 5 で AI 自動セクション選定に差し替え。
 * Task 6 で KV 画像生成を追加。
 */
const DEFAULT_SECTIONS: LpSectionType[] = [
  'hero',
  'problem',
  'solution',
  'features',
  'numeric_proof',
  'voice',
  'pricing',
  'faq',
  'final_cta',
];

export async function generateLandingPage(args: {
  userId: string;
  brief: LpBrief;
}): Promise<{ landingPageId: string; sections: LpSection[]; title: string }> {
  const prisma = getPrisma();

  // 並列でセクションごとのコピーを生成
  const sectionResults = await Promise.all(
    DEFAULT_SECTIONS.map(async (type, idx): Promise<LpSection> => {
      const props = await generateSectionCopy(args.brief, type);
      return {
        type,
        order: idx,
        enabled: true,
        props,
      };
    })
  );

  // タイトルは hero の headline を流用
  const heroProps = sectionResults.find((s) => s.type === 'hero')?.props as
    | { headline?: string }
    | undefined;
  const title = heroProps?.headline ?? args.brief.productName;

  // DB 保存
  // slug は仮で createdAt 由来。Task で正式化（Phase 1 ではユーザー編集可）
  const slug = `lp-${Date.now().toString(36)}`;

  const lp = await prisma.landingPage.create({
    data: {
      userId: args.userId,
      slug,
      title,
      status: 'draft',
      brief: args.brief as unknown as object,
      sections: sectionResults as unknown as object,
    },
  });

  // 生成履歴も保存（巻き戻し用）
  await prisma.landingPageGeneration.createMany({
    data: sectionResults.map((s) => ({
      landingPageId: lp.id,
      sectionType: s.type,
      prompt: JSON.stringify({ brief: args.brief, sectionType: s.type }),
      output: s.props as unknown as object,
    })),
  });

  return { landingPageId: lp.id, sections: sectionResults, title };
}
```

- [ ] **Step 5: `/api/lp/generate/route.ts` 作成**

`src/app/api/lp/generate/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { LpGenerateRequestSchema } from '@/lib/lp/schemas';
import { generateLandingPage } from '@/lib/lp/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 300; // gpt-image-2 / Gemini 並列で時間がかかる

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = LpGenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await generateLandingPage({
      userId: session.user.id,
      brief: parsed.data.brief,
    });
    return NextResponse.json({
      landingPageId: result.landingPageId,
      title: result.title,
      sections: result.sections,
    });
  } catch (err) {
    console.error('[/api/lp/generate] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: TypeScript build 検証**

```bash
npm run build
```

期待: build 通過。Prisma JSON 型 / Gemini SDK 型エラーなし。

- [ ] **Step 7: ローカル smoke test**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/lp-maker/new` にアクセス → STEP1-3 入力 → 「✨ AI で LP を生成する」押下。

期待:
- 60〜180 秒で完了
- `/lp-maker/[id]/edit` にリダイレクト（編集画面は Sprint 2 で実装するので 404 になるが、URL の id 部分から DB に保存されていることを確認）
- Prisma Studio (`npx prisma studio`) で LandingPage / LandingPageGeneration が作成されている

- [ ] **Step 8: 失敗時のリトライ・エラーログ確認**

ブラウザの DevTools / Vercel CLI ログで:
- `[copy-generator] section=xxx attempt=1 error` ログが時々出ても、attempt=2 で成功していれば OK
- 全 8 セクションで attempt=2 まで失敗する場合は responseSchema を見直す（特に comparison / pricing は構造が複雑）

- [ ] **Step 9: commit**

```bash
git add src/lib/lp/copy-prompts.ts src/lib/lp/copy-generator.ts src/lib/lp/orchestrator.ts src/app/api/lp/generate/route.ts
git commit -m "feat(D3-T4): add /api/lp/generate with Gemini 2.5 Pro responseSchema section copy generation"
```

---

## Sprint 1 / D4 — Task 5: AI 自動セクション選定ロジック

**Files:**
- 作成: `src/lib/lp/section-selector.ts`
- 変更: `src/lib/lp/orchestrator.ts`（DEFAULT_SECTIONS の使用を section-selector に差し替え）

- [ ] **Step 1: section-selector.ts 作成**

`src/lib/lp/section-selector.ts`:

```typescript
import { GoogleGenAI, Type } from '@google/genai';
import type { LpBrief, LpSectionType } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ALL_SECTIONS: LpSectionType[] = [
  'hero',
  'problem',
  'solution',
  'features',
  'numeric_proof',
  'comparison',
  'voice',
  'pricing',
  'faq',
  'inline_cta',
  'final_cta',
];

/** hero と final_cta は常に必須 */
const ALWAYS_INCLUDE: LpSectionType[] = ['hero', 'final_cta'];

/**
 * Brief から最適な 7〜9 セクション組合せを Gemini に判断させる。
 *
 * - hero / final_cta は強制含める
 * - それ以外は Gemini が業種・オファー特性から選ぶ
 * - 順序も指定させる（PASONA / AIDMA を意識）
 */
export async function selectSectionsForBrief(brief: LpBrief): Promise<LpSectionType[]> {
  const prompt = `
あなたは LP の構成設計の専門家です。以下のブリーフに最適なセクション組合せを決めてください。

# ブリーフ
- 商品名: ${brief.productName}
- ターゲット: ${brief.target}
- オファー: ${brief.offer}
${brief.lpUrl ? `- 既存 LP URL: ${brief.lpUrl}` : ''}

# 選択可能なセクション
- hero (FV)
- problem (課題提起)
- solution (解決策)
- features (機能紹介)
- numeric_proof (数字訴求)
- comparison (比較表)
- voice (お客様の声)
- pricing (料金)
- faq (FAQ)
- inline_cta (セクション間 CTA)
- final_cta (最終 CTA)

# ルール
- 必ず hero を 1 番目、final_cta を最後に含める
- 合計 7〜9 セクション
- PASONA / AIDMA を意識した順序
- D2C / EC ⇒ voice / pricing 必須
- BtoB SaaS ⇒ comparison 必須
- 高単価商品 ⇒ faq 必須

# 出力フォーマット
順序付き配列で返してください。
`.trim();

  const schema = {
    type: Type.OBJECT,
    required: ['sections'],
    properties: {
      sections: {
        type: Type.ARRAY,
        minItems: '7',
        maxItems: '9',
        items: { type: Type.STRING, enum: [...ALL_SECTIONS] },
      },
    },
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      const text = result.text;
      if (!text) throw new Error('Gemini empty response');
      const parsed = JSON.parse(text) as { sections: LpSectionType[] };

      // 検証: hero / final_cta 必須
      const set = new Set(parsed.sections);
      ALWAYS_INCLUDE.forEach((s) => set.add(s));

      // hero を先頭、final_cta を末尾に
      let ordered = parsed.sections.filter((s) => s !== 'hero' && s !== 'final_cta');
      ordered = ['hero', ...ordered, 'final_cta'];

      // 重複排除
      const seen = new Set<LpSectionType>();
      const dedup = ordered.filter((s) => {
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      });

      return dedup;
    } catch (err) {
      console.error(`[section-selector] attempt=${attempt} error`, err);
      if (attempt === 2) {
        // fallback: デフォルト 8 セクション
        return [
          'hero',
          'problem',
          'solution',
          'features',
          'numeric_proof',
          'voice',
          'pricing',
          'faq',
          'final_cta',
        ];
      }
    }
  }
  throw new Error('unreachable');
}
```

- [ ] **Step 2: orchestrator.ts を section-selector 利用に変更**

`src/lib/lp/orchestrator.ts` の `DEFAULT_SECTIONS` を削除し、`selectSectionsForBrief` 呼び出しに置き換え:

```typescript
import { getPrisma } from '@/lib/prisma';
import type { LpBrief, LpSection } from './types';
import { generateSectionCopy } from './copy-generator';
import { selectSectionsForBrief } from './section-selector';

export async function generateLandingPage(args: {
  userId: string;
  brief: LpBrief;
}): Promise<{ landingPageId: string; sections: LpSection[]; title: string }> {
  const prisma = getPrisma();

  // ステップ 1: AI 自動セクション選定
  const sectionTypes = await selectSectionsForBrief(args.brief);

  // ステップ 2: 並列でコピー生成
  const sectionResults = await Promise.all(
    sectionTypes.map(async (type, idx): Promise<LpSection> => {
      const props = await generateSectionCopy(args.brief, type);
      return {
        type,
        order: idx,
        enabled: true,
        props,
      };
    })
  );

  const heroProps = sectionResults.find((s) => s.type === 'hero')?.props as
    | { headline?: string }
    | undefined;
  const title = heroProps?.headline ?? args.brief.productName;
  const slug = `lp-${Date.now().toString(36)}`;

  const lp = await prisma.landingPage.create({
    data: {
      userId: args.userId,
      slug,
      title,
      status: 'draft',
      brief: args.brief as unknown as object,
      sections: sectionResults as unknown as object,
    },
  });

  await prisma.landingPageGeneration.createMany({
    data: sectionResults.map((s) => ({
      landingPageId: lp.id,
      sectionType: s.type,
      prompt: JSON.stringify({ brief: args.brief, sectionType: s.type }),
      output: s.props as unknown as object,
    })),
  });

  return { landingPageId: lp.id, sections: sectionResults, title };
}
```

- [ ] **Step 3: TypeScript build 検証**

```bash
npm run build
```

- [ ] **Step 4: ローカル smoke test**

```bash
npm run dev
```

`/lp-maker/new` で異なる業種のブリーフを 3 種類試す:
- 例 A) サプリ D2C → voice / pricing が含まれるか
- 例 B) BtoB SaaS → comparison が含まれるか
- 例 C) 高単価コンサル → faq が含まれるか

期待: 業種に応じてセクション組合せが変動する。すべての試行で hero が先頭・final_cta が末尾。

- [ ] **Step 5: commit**

```bash
git add src/lib/lp/section-selector.ts src/lib/lp/orchestrator.ts
git commit -m "feat(D4-T5): add AI auto section selection (Gemini 2.5 Pro decides 7-9 sections from brief)"
```

---

## Sprint 1 / D5 — Task 6: KV / セクション画像生成（gpt-image-2 + Vercel Blob）

**Files:**
- 作成: `src/lib/lp/image-generator.ts`
- 変更: `src/lib/lp/orchestrator.ts`（KV 画像生成統合）

- [ ] **Step 1: 既存 gpt-image-2 呼び出しパターンの確認**

```bash
head -120 src/lib/image-providers/openai.ts
```

期待: `openai` SDK の `images.generate` / `images.edit` 呼び出しパターンを把握。

- [ ] **Step 2: image-generator.ts 作成**

`src/lib/lp/image-generator.ts`:

```typescript
import OpenAI from 'openai';
import { put } from '@vercel/blob';
import type { LpBrief } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * LP の KV（ヒーロー画像）を gpt-image-2 で生成し Vercel Blob に保存。
 *
 * Phase 1: KV 1 枚のみ。セクション別画像は Phase 2 で追加。
 */
export async function generateKvImage(args: {
  brief: LpBrief;
  landingPageId: string;
}): Promise<{ kvImageUrl: string }> {
  const prompt = buildKvPrompt(args.brief);

  console.log('[image-generator] generating KV for', args.landingPageId);

  const result = await openai.images.generate({
    model: 'gpt-image-2',
    prompt,
    size: '1536x1024', // 横長 KV (LP FV 用)
    quality: 'medium', // Phase 1: コストとスピードのバランス
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-2 returned no image');

  const buffer = Buffer.from(b64, 'base64');
  const blob = await put(
    `lp-maker/${args.landingPageId}/kv.png`,
    buffer,
    { access: 'public', contentType: 'image/png' }
  );

  return { kvImageUrl: blob.url };
}

function buildKvPrompt(brief: LpBrief): string {
  return `
高品質な日本市場向け LP のファーストビュー（ヒーロー）画像を生成してください。

# 商材
${brief.productName}

# ターゲット
${brief.target}

# 厳守ルール
- 写実的な実在人物の生成は禁止（モデル素材は別途ユーザーが用意）
- 抽象的・印象的なシーン、商品の世界観を表現する背景画像
- 余白を残し、テキストオーバーレイ用にコピー領域を空ける
- 日本市場向けの色彩・トーン
- 文字を画像内に描画しない（後でコピーを HTML でオーバーレイするため）
- ブランドの品格を保つ高解像度な仕上がり
`.trim();
}
```

- [ ] **Step 3: orchestrator.ts に KV 画像生成を統合**

`src/lib/lp/orchestrator.ts` を更新:

```typescript
import { getPrisma } from '@/lib/prisma';
import type { LpBrief, LpSection } from './types';
import { generateSectionCopy } from './copy-generator';
import { selectSectionsForBrief } from './section-selector';
import { generateKvImage } from './image-generator';

export async function generateLandingPage(args: {
  userId: string;
  brief: LpBrief;
}): Promise<{ landingPageId: string; sections: LpSection[]; title: string; kvImageUrl: string }> {
  const prisma = getPrisma();

  // ステップ 1: AI 自動セクション選定
  const sectionTypes = await selectSectionsForBrief(args.brief);

  // ステップ 2: 仮の LandingPage を作成（KV 画像 URL を後で update するため）
  const slug = `lp-${Date.now().toString(36)}`;
  const lp = await prisma.landingPage.create({
    data: {
      userId: args.userId,
      slug,
      title: args.brief.productName,
      status: 'draft',
      brief: args.brief as unknown as object,
      sections: [] as unknown as object,
    },
  });

  // ステップ 3: コピー生成と KV 画像生成を並列実行
  const [sectionResults, kvResult] = await Promise.all([
    Promise.all(
      sectionTypes.map(async (type, idx): Promise<LpSection> => {
        const props = await generateSectionCopy(args.brief, type);
        return { type, order: idx, enabled: true, props };
      })
    ),
    generateKvImage({ brief: args.brief, landingPageId: lp.id }),
  ]);

  // ステップ 4: hero セクションの props に kvImageUrl を注入
  const finalSections = sectionResults.map((s) =>
    s.type === 'hero'
      ? { ...s, props: { ...s.props, imageUrl: kvResult.kvImageUrl } }
      : s
  );

  const heroProps = finalSections.find((s) => s.type === 'hero')?.props as
    | { headline?: string }
    | undefined;
  const title = heroProps?.headline ?? args.brief.productName;

  // ステップ 5: LandingPage を更新
  await prisma.landingPage.update({
    where: { id: lp.id },
    data: {
      title,
      sections: finalSections as unknown as object,
    },
  });

  // ステップ 6: 生成履歴保存
  await prisma.landingPageGeneration.createMany({
    data: finalSections.map((s) => ({
      landingPageId: lp.id,
      sectionType: s.type,
      prompt: JSON.stringify({ brief: args.brief, sectionType: s.type }),
      output: s.props as unknown as object,
    })),
  });

  return {
    landingPageId: lp.id,
    sections: finalSections,
    title,
    kvImageUrl: kvResult.kvImageUrl,
  };
}
```

- [ ] **Step 4: TypeScript build 検証**

```bash
npm run build
```

期待: build 通過。

- [ ] **Step 5: ローカル smoke test（end-to-end）**

```bash
npm run dev
```

`/lp-maker/new` でブリーフ入力 → 生成完了:
- 90〜180 秒で完了
- Prisma Studio で LandingPage.sections JSON 内に `hero.props.imageUrl` が Vercel Blob URL として保存されている
- Blob URL を直接ブラウザで開くと KV 画像が表示される

- [ ] **Step 6: コスト確認**

```bash
# OpenAI Usage ダッシュボードを開く
echo "https://platform.openai.com/account/usage"
```

期待: 1 LP 生成で gpt-image-2 medium 1536x1024 1 枚 ≒ $0.05、Gemini 2.5 Pro x 約 10 回 ≒ $0.05 〜 0.08。合計 約 $0.10〜0.13。

- [ ] **Step 7: commit**

```bash
git add src/lib/lp/image-generator.ts src/lib/lp/orchestrator.ts
git commit -m "feat(D5-T6): add KV image generation with gpt-image-2 + Vercel Blob storage"
```

- [ ] **Step 8: feature branch を push**

```bash
git push -u origin feat/lpmaker-pro-2-sprint1
```

- [ ] **Step 9: Sprint 1 完了タグ**

```bash
git tag sprint1-complete
git push origin sprint1-complete
```

---

## Sprint 1 完了基準 (Definition of Done)

- [ ] Pre-Sprint P-1〜P-3 完了（Vercel ドメイン接続 / rewrites / Stripe Live リソース）
- [ ] Prisma 新テーブル 3 + User/Generation 拡張が dev DB に migrate 済
- [ ] `/lp-maker` ダッシュボードが認証付きで表示される
- [ ] `/lp-maker/new` の Brief ウィザード STEP1-3 が動く
- [ ] `/api/lp/generate` が Brief を受け取り、Gemini で AI 自動セクション選定 + 各セクションコピー生成 + KV 画像生成して LandingPage を保存し、landingPageId を返す
- [ ] Prisma Studio で LandingPage の sections JSON に hero/problem/solution 等のコピーと KV 画像 URL が格納されている
- [ ] feature ブランチ `feat/lpmaker-pro-2-sprint1` が push 済、tag `sprint1-complete`

---

## Sprint 1 → Sprint 2 への引き継ぎ事項

Sprint 2 (D6-D10) では以下を実装:
- D6: `/lp-maker/[id]/edit` 編集画面のレイアウト + 既存 11 LP コンポーネントを props 駆動でレンダリング
- D7: セクション ON/OFF / D&D 並べ替え / コピー編集 UI + auto-save
- D8: ブロック単位「もう一案」AI 再生成（3 案モーダル + Diff highlight）
- D9: `/api/lp/[id]/publish` + slug 確定 + OGP 自動生成 + GTM/GA4/Pixel ID 入力フォーム
- D10: `/site/[user]/[slug]` SSR 公開ページ + Edge Cache + Robots/Sitemap

**前提となる Sprint 1 成果物:**
- LandingPage / LandingPageGeneration テーブル
- `src/lib/lp/types.ts` の LpSection / LpSectionType
- `src/lib/lp/copy-generator.ts` の generateSectionCopy (再生成 API でも流用)

---

## リスク・注意点

| リスク | 緩和策 |
|---|---|
| Gemini 2.5 Pro の `responseSchema` 構造化失敗（特に comparison / pricing）| copy-generator の attempt 2 リトライで吸収。それでも失敗続出なら schema を簡素化 |
| gpt-image-2 のタイムアウト（300s 超過）| Promise.all で並列実行することで 90-180s に圧縮。それでも超過する場合は KV 画像生成を非同期化（job + ポーリング）に変更 |
| dev DB 失効 | `.env` の DATABASE_URL を PROD_DATABASE_URL の値で一時的に上書き |
| Vercel Blob の容量制限 | Phase 1 では 1 LP あたり 1 枚なので問題なし。Phase 2 でセクション別画像追加時に再評価 |
| Stripe live setup の重複作成 | Step 4 の dry-run で必ず既存リソースを確認してから実行 |
