# Phase A.14: メータード課金 + Free 段階制限 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free プラン 4 回目以降を「PREVIEW 透かし入りプレビュー」モードに切り替え、Pro プラン 101 回目以降は Stripe meterEvents で usage_records を送信して ¥80/回課金を成立させる。

**Architecture:** ① ironclad-generate API 内で usage 判定し plan 別に分岐。② Free 上限超過時は sharp で PREVIEW 透かしを画像に後処理合成。③ Pro 上限超過時は `stripe.billing.meterEvents.create({ identifier: generation.id })` を idempotency 担保つきで送信。④ DB に Generation.isPreview と User.proOverageNoticeShownAt を追加。⑤ UI（Step 3 バナー / /account 超過表示）を統合。

**Tech Stack:** Next.js 16 / TypeScript / Prisma 7 / Stripe SDK / sharp（既存 dep）/ Vercel Blob

**Spec:** [docs/superpowers/specs/2026-04-28-phase-a14-metered-billing-design.md](../specs/2026-04-28-phase-a14-metered-billing-design.md)

**Test方針:** プロジェクトはテストフレーム未導入。各タスクは「TypeScript ビルド + Stripe Test Clock + 段階手動確認」で検証。

**前提:** Phase A.12 live mode 完了（KYC 完了 + 本番 Stripe Customer/Subscription が動く状態）。Phase A.12 test mode 完了状態だけでも CP1-CP4 の実装+検証は可能。CP5 は live mode 必須。

---

## ファイル構成マップ

### 新規作成

| ファイル | 役割 |
|---|---|
| `prisma/migrations/<ts>_phase_a14_metered/migration.sql` | Generation.isPreview + User.proOverageNoticeShownAt |
| `src/lib/billing/usage-records.ts` | sendMeteredUsage() ラッパー（meterEvents.create + idempotency） |
| `src/lib/image-providers/watermark.ts` | applyPreviewWatermark() — sharp で PREVIEW 透かし合成 |
| `src/components/ironclad/PreviewBanner.tsx` | Step 3 完成画面の「これはプレビュー版です」訴求バナー |
| `src/components/account/ProOverageDisplay.tsx` | /account の Pro 超過分表示（今月 N 回 × ¥80） |

### 変更

| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | Generation に isPreview / User に proOverageNoticeShownAt 追加 |
| `src/app/api/ironclad-generate/route.ts` | plan/usage 判定 + 透かし合成 + meterEvents 送信を追加 |
| `src/lib/plans/limits.ts` | USAGE_LIMIT_FREE=3, USAGE_LIMIT_PRO=100 定数化 |
| `src/components/ironclad/IroncladGenerateScreen.tsx` | 生成レスポンスの isPreview フラグ受信 + PreviewBanner 表示 |
| `src/app/account/PlanSection.tsx` | ProOverageDisplay 統合 |
| `src/lib/billing/webhook-handlers/payment-succeeded.ts` | proOverageNoticeShownAt をリセット |

---

## Task 0: 前提確認

**Files:** なし（git/環境確認）

- [ ] **Step 1: 現在のブランチ確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
git branch --show-current
```

期待: main または feature ブランチ作成前。working tree clean。

- [ ] **Step 2: Phase A.12 完了タグ確認**

```bash
git tag | grep phase-a12
```

期待: `phase-a12-test-complete` 存在。理想的には `phase-a12-complete`（live mode 完了）も存在。

- [ ] **Step 3: feature ブランチ作成**

```bash
git checkout main
git pull origin main
git checkout -b feat/phase-a14-metered
```

---

## CP1: DB + ライブラリ基盤

## Task 1: Prisma schema 拡張 + migration

**Files:**
- 変更: `prisma/schema.prisma`
- 作成: `prisma/migrations/<ts>_phase_a14_metered/migration.sql`

- [ ] **Step 1: Generation に isPreview 追加**

`prisma/schema.prisma` の Generation モデル内、適切な位置に追加:

```prisma
  /// Phase A.14: Free 上限超過時の「透かし入りプレビュー」フラグ
  /// true なら PREVIEW 透かし入りで保存、UI でアップグレード訴求バナー表示
  isPreview         Boolean   @default(false)
```

- [ ] **Step 2: User に proOverageNoticeShownAt 追加**

`prisma/schema.prisma` の User モデル内、`paymentFailedAt` の後に追加:

```prisma
  /// Phase A.14: Pro 上限到達アラート（101 回目で 1 度のみ表示）の last shown
  /// payment_succeeded webhook で NULL リセット
  proOverageNoticeShownAt   DateTime?
```

- [ ] **Step 3: migration 生成**

```bash
npx prisma migrate dev --name phase_a14_metered
```

期待: migration.sql に `ALTER TABLE "Generation" ADD COLUMN "isPreview"` + `ALTER TABLE "User" ADD COLUMN "proOverageNoticeShownAt"` が含まれる。

- [ ] **Step 4: ビルド + コミット**

```bash
npm run build
git add prisma/
git commit -m "feat(db): add Generation.isPreview + User.proOverageNoticeShownAt for A.14"
```

---

## Task 2: USAGE_LIMIT 定数を limits.ts に集約

**Files:**
- 変更: `src/lib/plans/limits.ts`

- [ ] **Step 1: 既存 limits.ts を確認**

```bash
cat src/lib/plans/limits.ts
```

既に plan limit 定義があるか確認。

- [ ] **Step 2: USAGE_LIMIT 定数を追加**

既存の plan limits 定義に追記（または新規エクスポート）:

```typescript
/**
 * Phase A.14: 月次生成上限
 * - Free: 3 回（4 回目以降は PREVIEW 透かしモード）
 * - Pro: 100 回（101 回目以降は Stripe meterEvents で ¥80/回課金）
 * - Starter: 既存定義に従う（透かしなし、上限到達で block）
 * - Admin: 無制限
 */
export const USAGE_LIMIT_FREE = 3;
export const USAGE_LIMIT_PRO = 100;
```

- [ ] **Step 3: ビルド + コミット**

```bash
npm run build
git add src/lib/plans/limits.ts
git commit -m "feat(plans): centralize USAGE_LIMIT_FREE/PRO constants"
```

---

## Task 3: usage-records.ts（meterEvents ラッパー）

**Files:**
- 作成: `src/lib/billing/usage-records.ts`

- [ ] **Step 1: 作成**

```typescript
import { getStripeClient } from './stripe-client';

/**
 * Phase A.14: Stripe Billing Meter に usage event を 1 件送信
 *
 * - event_name は A.12 で作成した meter と一致させる: 'banner_generation_overage'
 * - identifier に Generation.id を使い idempotency 担保
 * - Stripe 側で同 identifier の重複送信は自動 dedupe
 *
 * 失敗時はログのみ。ユーザー側は成功扱いで進める（売上漏れは Stripe Dashboard 監視で検知）。
 */
export const sendMeteredUsage = async (
  customerId: string,
  generationId: string
): Promise<void> => {
  const stripe = getStripeClient();
  try {
    await stripe.billing.meterEvents.create({
      event_name: 'banner_generation_overage',
      payload: {
        stripe_customer_id: customerId,
        value: '1',
      },
      identifier: generationId,
    });
  } catch (e) {
    console.error(
      '[usage-records] failed to send meter event',
      { customerId, generationId, error: e }
    );
    // ユーザー体験優先: 失敗を握りつぶす
  }
};
```

- [ ] **Step 2: ビルド + コミット**

```bash
npm run build
git add src/lib/billing/usage-records.ts
git commit -m "feat(billing): add sendMeteredUsage wrapper with idempotency"
```

---

## Task 4: watermark.ts（PREVIEW 透かし合成）

**Files:**
- 作成: `src/lib/image-providers/watermark.ts`

- [ ] **Step 1: sharp の dep 確認**

```bash
grep -E '"sharp"' package.json
```

既存にあるはず（Next.js 16 + 画像処理で標準）。なければ `npm install sharp`。

- [ ] **Step 2: 作成**

```typescript
import sharp from 'sharp';

/**
 * Phase A.14: 画像に PREVIEW 透かしを焼き込む
 *
 * - 中央に「PREVIEW」斜め大文字（白半透明 30%）
 * - 下部に「Pro なら透かしなし」小文字（白半透明 50%）
 * - 黒ドロップシャドウで読みやすさ確保
 * - フォントサイズは幅の 8%
 *
 * 失敗時は元画像をそのまま返す（生成成功を優先）。
 */
export const applyPreviewWatermark = async (imageBuffer: Buffer): Promise<Buffer> => {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const w = meta.width ?? 1080;
    const h = meta.height ?? 1080;
    const fontSizeMain = Math.round(w * 0.08);
    const fontSizeSub = Math.round(w * 0.025);

    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="ds" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="black" flood-opacity="0.6"/>
          </filter>
        </defs>
        <text x="${w / 2}" y="${h / 2}"
              text-anchor="middle"
              dominant-baseline="middle"
              transform="rotate(-30, ${w / 2}, ${h / 2})"
              font-family="Arial, sans-serif"
              font-weight="900"
              font-size="${fontSizeMain}"
              fill="white"
              fill-opacity="0.30"
              filter="url(#ds)"
              letter-spacing="${Math.round(fontSizeMain * 0.1)}">PREVIEW</text>
        <text x="${w / 2}" y="${h - h * 0.05}"
              text-anchor="middle"
              font-family="Arial, sans-serif"
              font-weight="700"
              font-size="${fontSizeSub}"
              fill="white"
              fill-opacity="0.50"
              filter="url(#ds)">Pro なら透かしなし</text>
      </svg>
    `;

    return await sharp(imageBuffer)
      .composite([{ input: Buffer.from(svg), gravity: 'center' }])
      .toBuffer();
  } catch (e) {
    console.error('[watermark] failed, returning original', e);
    return imageBuffer;
  }
};
```

- [ ] **Step 3: ビルド + コミット**

```bash
npm run build
git add src/lib/image-providers/watermark.ts
git commit -m "feat(image): add PREVIEW watermark overlay via sharp"
```

---

## CP2: ironclad-generate API 統合

## Task 5: ironclad-generate route に分岐ロジック追加

**Files:**
- 変更: `src/app/api/ironclad-generate/route.ts`

- [ ] **Step 1: 既存 route.ts を読む**

```bash
cat src/app/api/ironclad-generate/route.ts | head -100
```

usage 増加箇所、画像保存箇所、Generation 作成箇所を把握。

- [ ] **Step 2: 透かし合成 + isPreview セット**

画像生成成功後、Vercel Blob upload 前に分岐を挿入:

```typescript
import { applyPreviewWatermark } from '@/lib/image-providers/watermark';
import { sendMeteredUsage } from '@/lib/billing/usage-records';
import { USAGE_LIMIT_FREE, USAGE_LIMIT_PRO } from '@/lib/plans/limits';

// 既存: gpt-image-2 で生成 → imageBuffer
// ↓ ここから A.14 追加

// usage は既に incrementUsage() で +1 済の前提
const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
const isPreview = updatedUser.plan === 'free' && updatedUser.usageCount > USAGE_LIMIT_FREE;

let finalBuffer = imageBuffer;
if (isPreview) {
  finalBuffer = await applyPreviewWatermark(imageBuffer);
}

// 既存: Vercel Blob upload + Generation 作成
// ↓ Generation 作成時に isPreview を渡す
const generation = await prisma.generation.create({
  data: {
    // ... 既存フィールド ...
    isPreview,
  },
});

// A.14 追加: Pro 上限超過なら meterEvents 送信
if (
  updatedUser.plan === 'pro' &&
  updatedUser.stripeCustomerId &&
  updatedUser.usageCount > USAGE_LIMIT_PRO
) {
  // 失敗してもユーザーには影響なし（fire-and-forget 的扱いだが await で順序保証）
  await sendMeteredUsage(updatedUser.stripeCustomerId, generation.id);
}

// レスポンスに isPreview を含める（クライアントで UI 切替に使う）
return NextResponse.json({ ...existingResponse, isPreview, generationId: generation.id });
```

注: 既存の `incrementUsage` の位置を確認し、その**後**に user を再取得して usageCount 判定するのがポイント。incrementUsage 前の usageCount で判定すると 1 ずれる。

- [ ] **Step 3: ローカル動作確認**

DB を一時的に編集して plan='free' / usageCount=3 にする → 1 サイズ生成 → レスポンスの `isPreview` が true で返る + DB の Generation.isPreview = true + Vercel Blob 上の画像に PREVIEW 透かしが乗っている

```bash
npm run dev
```

- [ ] **Step 4: ビルド + コミット**

```bash
npm run build
git add src/app/api/ironclad-generate/
git commit -m "feat(api): add Free preview / Pro overage logic to ironclad-generate"
```

---

## Task 6: payment-succeeded handler で proOverageNoticeShownAt リセット

**Files:**
- 変更: `src/lib/billing/webhook-handlers/payment-succeeded.ts`

- [ ] **Step 1: 既存ファイル読み**

```bash
cat src/lib/billing/webhook-handlers/payment-succeeded.ts
```

- [ ] **Step 2: paymentFailedAt クリアと同じ場所に proOverageNoticeShownAt リセット追加**

```typescript
// 既存: paymentFailedAt クリア
if (user.paymentFailedAt || user.proOverageNoticeShownAt) {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      paymentFailedAt: null,
      proOverageNoticeShownAt: null, // A.14: 新月次サイクルで再度アラート許可
    },
  });
}
```

- [ ] **Step 3: ビルド + コミット**

```bash
npm run build
git add src/lib/billing/webhook-handlers/payment-succeeded.ts
git commit -m "feat(billing): reset proOverageNoticeShownAt on payment_succeeded"
```

---

## CP3: UI 統合

## Task 7: PreviewBanner.tsx + Step 3 統合

**Files:**
- 作成: `src/components/ironclad/PreviewBanner.tsx`
- 変更: `src/components/ironclad/IroncladGenerateScreen.tsx`

- [ ] **Step 1: PreviewBanner.tsx 作成**

```typescript
'use client';

import { useState } from 'react';
import { UpgradeModal } from '@/app/account/UpgradeModal';

/**
 * Phase A.14: Free プラン 4 回目以降の生成完了時に表示する訴求バナー
 *
 * - Step 3 完成画面の上部に常駐
 * - クリックで UpgradeModal を開く（Pro 訴求）
 */
export const PreviewBanner = ({ plan }: { plan: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="bg-amber-600/20 border border-amber-500/40 rounded p-4 mb-4">
        <p className="text-amber-200 font-bold">
          ⚠️ これはプレビュー版（PREVIEW 透かし入り）です
        </p>
        <p className="text-amber-100/80 text-sm mt-1">
          今月の Free 上限（3 回）を超えました。
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="underline font-bold hover:text-white ml-1"
          >
            Pro にアップグレード
          </button>
          すれば透かしなしで使えます。
        </p>
      </div>
      {open && <UpgradeModal type="upgrade" onClose={() => setOpen(false)} plan={plan} />}
    </>
  );
};
```

- [ ] **Step 2: IroncladGenerateScreen に統合**

生成レスポンスから `isPreview` を受け取り、true なら PreviewBanner を Step 3 上部に表示。既存 IroncladGenerateScreen.tsx の生成完了 state に `isPreview: boolean` を追加し、JSX で条件レンダリング。

- [ ] **Step 3: ビルド + コミット**

```bash
npm run build
git add src/components/ironclad/
git commit -m "feat(ironclad): show PreviewBanner on Free plan overage"
```

---

## Task 8: ProOverageDisplay.tsx + /account 統合

**Files:**
- 作成: `src/components/account/ProOverageDisplay.tsx`
- 変更: `src/app/account/PlanSection.tsx`

- [ ] **Step 1: ProOverageDisplay.tsx 作成**

```typescript
import { USAGE_LIMIT_PRO } from '@/lib/plans/limits';

/**
 * Phase A.14: Pro プランの今月超過分を表示
 *
 * - usageCount > USAGE_LIMIT_PRO の時のみ表示
 * - 「今月超過: N 回 × ¥80 = ¥X」を見せる
 * - Stripe 側の usage と同期（payment_succeeded で usageCount=0 リセット）
 */
interface Props {
  plan: string;
  usageCount: number;
}

export const ProOverageDisplay = ({ plan, usageCount }: Props) => {
  if (plan !== 'pro') return null;
  const overage = Math.max(0, usageCount - USAGE_LIMIT_PRO);
  if (overage === 0) return null;
  const yen = overage * 80;
  return (
    <div className="text-sm text-amber-300 mt-2">
      今月超過: {overage} 回 × ¥80 = ¥{yen.toLocaleString('ja-JP')}（次回請求に追加）
    </div>
  );
};
```

- [ ] **Step 2: PlanSection に統合**

PlanSection の使用状況表示の下に追加:

```tsx
import { ProOverageDisplay } from '@/components/account/ProOverageDisplay';

// In rendering:
<ProOverageDisplay plan={user.plan} usageCount={user.usageCount} />
```

- [ ] **Step 3: ビルド + コミット**

```bash
npm run build
git add src/components/account/ src/app/account/
git commit -m "feat(account): show Pro overage breakdown in PlanSection"
```

---

## CP4: Stripe Test Clock 検証

## Task 9: Test Clock で月末メータード集計確認

**Files:** なし（手動検証）

- [ ] **Step 1: Test Clock 作成（CLI）**

```bash
stripe test_helpers test_clocks create --frozen-time $(date +%s)
```

clock_xxx ID をメモ。

- [ ] **Step 2: 検証用 Customer + Subscription**

Test Clock に紐付けて Customer 作成 → Pro Subscription 作成（base + metered の 2-item）→ user.stripeCustomerId / stripeSubscriptionId を DB 直接更新。

- [ ] **Step 3: メータード送信テスト**

DB を直接編集して usageCount=101 にセット → 1 回生成 → meterEvents が送信されたか Stripe Dashboard で確認。

- [ ] **Step 4: 月末まで進める**

```bash
stripe test_helpers test_clocks advance <clock_id> --frozen-time <future_unix>
```

→ Stripe で Invoice が確定 → meter usage が請求項目として乗っているか確認。

- [ ] **Step 5: ロールバック**

User の plan を admin に戻し、Test Clock の Subscription を cancel。

---

## CP5: Live mode 移行検証

## Task 10: 自分の Pro Subscription で実検証（live mode、要 KYC 完了）

**Files:** なし

**注意:** 実費 ¥80 が発生（後日 Stripe Dashboard で「Add credit」または手動で打ち消し可能）。

- [ ] **Step 1: 自分の Pro Subscription を一時的に超過**

DB で usageCount を `USAGE_LIMIT_PRO`（100）に直接セット → 1 回生成（実カードで購入済の Pro Subscription 想定）

- [ ] **Step 2: meterEvents を確認**

Stripe Dashboard（live mode）→ Customer → Subscription → Usage タブ → meter event 1 件記録されているか。

- [ ] **Step 3: 元に戻す**

DB の usageCount をリセット、Stripe の meter event は次回請求まで放置（実費 ¥80 は受け入れる、または翌月の Stripe credit で打ち消し）。

---

## Task 11: main マージ + tag

- [ ] **Step 1: 最終ビルド**

```bash
npm run build
```

- [ ] **Step 2: main マージ**

```bash
git checkout main
git pull origin main
git merge --no-ff feat/phase-a14-metered -m "Merge: Phase A.14 metered billing + Free preview overlay"
git push origin main
git tag -a phase-a14-complete -m "Phase A.14 metered + Free 4セッション目以降 preview complete"
git push origin phase-a14-complete
```

- [ ] **Step 3: メモリ更新**

`project_banner_tsukurukun.md` に A.14 完了記述追加 + MEMORY.md エントリ更新。

---

# 検証チェックリスト

- [ ] Free plan で 4 回目以降の生成 → 画像に PREVIEW 透かしが乗る
- [ ] Free plan で 4 回目以降の Step 3 → PreviewBanner 表示 + Pro モーダル起動
- [ ] Generation.isPreview = true で DB 保存される
- [ ] 履歴詳細でも PREVIEW 透かし入りで表示される
- [ ] Pro plan で 101 回目の生成 → Stripe meter event 1 件送信
- [ ] 同 Generation.id で 2 回送信しても Stripe 側で 1 件のみ（idempotency）
- [ ] /account に「今月超過: N 回 × ¥80 = ¥X」表示（Pro 超過時）
- [ ] Test Clock で月末進行 → Invoice にメータード課金が乗る
- [ ] payment_succeeded webhook 後 proOverageNoticeShownAt がリセットされる
- [ ] Live mode で実 Pro Subscription に対して 1 回擬似超過 → 実 Stripe で確認 OK

---

総タスク数: 11
予定工数: 3 営業日
