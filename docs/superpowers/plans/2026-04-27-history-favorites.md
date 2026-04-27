# Phase A.11.5: 履歴 + お気に入り + プラン別ロック方式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** バナー生成時に Generation/GenerationImage を自動保存し、`/history` ページで一覧・詳細・再生成・お気に入り・一括 ZIP DL を提供する。プラン別ロック方式（Free=10, Starter=30, Pro=∞）で loss aversion を活用した Pro 訴求を実現する。

**Architecture:** ① Prisma schema に Generation/GenerationImage を追加し migration 適用。② `/api/ironclad-generate` を成功時に Generation 作成 + Vercel Blob upload するよう拡張。③ 新規 6 API（list/detail/delete/regenerate/favorite/zip）を実装し、ロック判定ロジックを `getHistoryAccessLimit` ヘルパーに集約。④ `/history` 一覧 + `/history/[id]` 詳細ページ、`UpgradeLockModal`、UserMenu / /account / Step 3 トースト の 3 経路で導線を確保。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Tailwind CSS / Prisma 7 / NextAuth.js v5 / @vercel/blob / jszip / lucide-react

**Spec:** [docs/superpowers/specs/2026-04-27-history-favorites-design.md](../specs/2026-04-27-history-favorites-design.md)

**Test方針:** プロジェクトはテストフレーム未導入。各タスクは「TypeScript ビルド通過 + 段階手動確認」で検証。最終的に §7 全項目 PASS で main 反映（Phase A.11.0-A.11.3 と同じ方式）。

---

## ファイル構成マップ

### 新規作成
| ファイル | 役割 |
|---|---|
| `prisma/migrations/<ts>_phase_a11_5_history_favorites/migration.sql` | Generation + GenerationImage テーブル追加 |
| `src/lib/plans/history-limits.ts` | プラン → 直近アクセス可能件数 / お気に入り上限 のマッピング |
| `src/lib/plans/history-lock.ts` | `computeLockState()` ロック判定 + ★救済ロジック |
| `src/lib/generations/blob-client.ts` | Generation 画像専用の Blob put/del ラッパー（path 構造込み） |
| `src/lib/generations/snapshot.ts` | briefSnapshot 構築 + 復元（IroncladBrief + selections + asset id 群）|
| `src/app/api/history/route.ts` | GET 一覧 |
| `src/app/api/history/[id]/route.ts` | GET 詳細 / DELETE |
| `src/app/api/history/[id]/regenerate/route.ts` | POST 同条件再生成 |
| `src/app/api/history/[id]/zip/route.ts` | GET ZIP DL 用 URL リスト |
| `src/app/api/history/image/[imageId]/favorite/route.ts` | PUT お気に入りトグル |
| `src/app/history/page.tsx` | 一覧ページ |
| `src/app/history/[id]/page.tsx` | 詳細ページ |
| `src/app/history/HistoryList.tsx` | 一覧 Client Component |
| `src/app/history/SessionCard.tsx` | 1 セッションカード（通常 / ロック表示両対応） |
| `src/app/history/UpgradeLockModal.tsx` | ロック行クリック時の Pro 訴求モーダル |
| `src/app/history/[id]/HistoryDetail.tsx` | 詳細 Client Component（再生成・★・削除）|
| `src/app/history/[id]/zip-helper.ts` | jszip でクライアント側 ZIP 生成 |
| `src/components/ui/Toast.tsx` | 簡易トースト Component（Step 3 完成時用） |

### 変更
| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | Generation + GenerationImage モデル追加 |
| `src/app/api/ironclad-generate/route.ts` | 成功時に Generation 作成 + Blob upload + レスポンスに generationId |
| `src/components/layout/UserMenu.tsx` | ドロップダウンに「履歴」項目追加 |
| `src/app/account/page.tsx` | 「履歴」セクション追加（4 セクション目） |
| `src/app/account/HistorySection.tsx` (新規) | 履歴サマリ表示 Server Component |
| `src/app/page.tsx` | `?regenerate=<id>` / `?prefill=<id>` URL パラメータ対応 |
| `src/components/ironclad/IroncladGenerateScreen.tsx` | 完成トースト + generationId state 保持 |
| `src/types/next-auth.d.ts` | 不要、変更なし（既存 plan で判定） |
| `package.json` | jszip 依存追加 |

---

## Task 0: 安全措置（feature ブランチ作成）

**Files:**
- なし（git 操作のみ）

- [ ] **Step 1: 現在の git 状態確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
git log --oneline -3
```

期待: working tree clean / 最新コミットが `26f0f32 docs: add Phase A.11.5 history + favorites + plan-based lock design spec`（または同等）

- [ ] **Step 2: feature ブランチ作成**

```bash
git checkout main
git pull origin main
git checkout -b feat/phase-a11-5-history
git branch --show-current
```

期待: `feat/phase-a11-5-history`

---

## Task 1: jszip 依存追加

**Files:**
- Modify: `package.json`

- [ ] **Step 1: jszip インストール**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm install jszip@^3.10.1
```

期待: package.json に `"jszip": "^3.10.1"` 追加 + package-lock.json 更新

- [ ] **Step 2: TypeScript 型確認**

```bash
npm install --save-dev @types/jszip 2>/dev/null || echo "no separate types needed"
```

jszip は現行版で型を内蔵しているので追加 install 不要。

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "deps: add jszip for client-side ZIP DL"
```

---

## Task 2: Prisma schema 拡張

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Generation + GenerationImage モデル追加**

`prisma/schema.prisma` の末尾（`VerificationToken` モデルの後）に追加：

```prisma
/// Phase A.11.5: 生成履歴。1 ブリーフ = 1 セッション、複数サイズ画像を含む
model Generation {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// IroncladBrief + IroncladSelections + 使用 asset の id 群を JSON でスナップショット保存
  briefSnapshot   Json

  createdAt       DateTime  @default(now())

  images          GenerationImage[]

  @@index([userId, createdAt])
}

/// Phase A.11.5: Generation 内の各サイズ画像
model GenerationImage {
  id                String     @id @default(cuid())
  generationId      String
  generation        Generation @relation(fields: [generationId], references: [id], onDelete: Cascade)

  /// 'Instagram (1080x1080)' 等
  size              String
  /// Vercel Blob Public URL
  blobUrl           String
  /// 'gpt-image' / 'flux' / 'imagen4'
  provider          String
  /// model, fallback flag 等
  providerMetadata  Json?

  /// ★お気に入り（永続アクセス保護対象）
  isFavorite        Boolean    @default(false)
  /// お気に入り化された日時（プラン別 5 枚カウント用）
  favoritedAt       DateTime?

  createdAt         DateTime   @default(now())

  @@index([generationId])
  @@index([isFavorite, favoritedAt])
}
```

- [ ] **Step 2: User モデルに Generation リレーション追加**

`User` モデルの `assets Asset[]` の下に追加：

```prisma
  generations   Generation[]
```

- [ ] **Step 3: migration SQL を手動生成**

prisma migrate dev はインタラクティブ環境を要求するため、`migrate diff` で SQL 抽出して手動配置。Phase A.11.0 と同じ手順。

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

期待: `CREATE TABLE "Generation" (...)` と `CREATE TABLE "GenerationImage" (...)` が出力される。出力された SQL をコピー。

- [ ] **Step 4: migration ディレクトリ + ファイル作成**

```bash
TS=$(date -u +"%Y%m%d%H%M%S")
mkdir -p "prisma/migrations/${TS}_phase_a11_5_history_favorites"
```

`prisma/migrations/<TS>_phase_a11_5_history_favorites/migration.sql` を作成し、Step 3 の SQL を貼り付ける。

期待: 以下のような内容（実際のタイムスタンプ・カラム順は環境依存）

```sql
-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "briefSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationImage" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMetadata" JSONB,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "favoritedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Generation_userId_createdAt_idx" ON "Generation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationImage_generationId_idx" ON "GenerationImage"("generationId");

-- CreateIndex
CREATE INDEX "GenerationImage_isFavorite_favoritedAt_idx" ON "GenerationImage"("isFavorite", "favoritedAt");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationImage" ADD CONSTRAINT "GenerationImage_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: migration 適用**

```bash
npx prisma migrate deploy
```

期待: `Applying migration <ts>_phase_a11_5_history_favorites` の出力 + `All migrations have been successfully applied.`

- [ ] **Step 6: Prisma client 再生成**

```bash
npx prisma generate
```

期待: `Generated Prisma Client (v7.7.0)` の出力

- [ ] **Step 7: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Generation + GenerationImage for Phase A.11.5"
```

---

## Task 3: history-limits + history-lock ヘルパー作成

**Files:**
- Create: `src/lib/plans/history-limits.ts`
- Create: `src/lib/plans/history-lock.ts`

- [ ] **Step 1: history-limits.ts 作成**

```ts
/**
 * Phase A.11.5: プラン → 履歴アクセス可能件数 / お気に入り上限のマッピング。
 *
 * - Free: 直近 10 セッションのみアクセス可（11 件目以降ロック）
 * - Starter: 直近 30 セッションのみアクセス可
 * - Pro / Plan C: 無制限（ロックなし）
 *
 * お気に入り上限:
 * - Free: 0 枚（使用不可、Pro 訴求）
 * - Starter: 5 枚
 * - Pro / Plan C: 無制限
 */

export const HISTORY_ACCESS_LIMITS: Record<string, number> = {
  free: 10,
  starter: 30,
  pro: Number.POSITIVE_INFINITY,
  admin: Number.POSITIVE_INFINITY,
};

export const FAVORITE_LIMITS: Record<string, number> = {
  free: 0,
  starter: 5,
  pro: Number.POSITIVE_INFINITY,
  admin: Number.POSITIVE_INFINITY,
};

export function getHistoryAccessLimit(plan: string): number {
  return HISTORY_ACCESS_LIMITS[plan] ?? HISTORY_ACCESS_LIMITS.free;
}

export function getFavoriteLimit(plan: string): number {
  return FAVORITE_LIMITS[plan] ?? FAVORITE_LIMITS.free;
}
```

- [ ] **Step 2: history-lock.ts 作成**

```ts
/**
 * Phase A.11.5: 履歴セッションのロック判定。
 *
 * ルール:
 * - 直近 N 件（N = getHistoryAccessLimit(plan)）はロックなし
 * - それ以前のセッションでも ★ お気に入り画像が 1 つでも含まれていればロックなし（救済枠）
 * - 上記以外はロック対象（一覧で blur サムネ + クリックで Pro 訴求モーダル）
 */

interface SessionLockInput {
  /** 配列の index = createdAt desc 順での順位（0 = 最新） */
  index: number;
  /** プラン別アクセス上限 */
  accessLimit: number;
  /** ★ お気に入り画像が含まれるか */
  hasFavorite: boolean;
}

export function computeLocked(input: SessionLockInput): boolean {
  const withinLimit = input.index < input.accessLimit;
  if (withinLimit) return false;
  if (input.hasFavorite) return false;
  return true;
}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/lib/plans/history-limits.ts src/lib/plans/history-lock.ts
git commit -m "feat(plans): add history access limits + lock judgement helpers"
```

---

## Task 4: Generation 画像 Blob クライアント作成

**Files:**
- Create: `src/lib/generations/blob-client.ts`

- [ ] **Step 1: blob-client.ts 作成**

```ts
/**
 * Phase A.11.5: Generation 画像専用の Vercel Blob クライアント。
 *
 * Path 構造: generations/<userId>/<generationId>/<size>.png
 * → 削除時に prefix 一括 list → del で完全清掃可能
 */
import { put, del, list } from '@vercel/blob';

function ensureToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  return token;
}

/**
 * 生成画像を Blob にアップロード。base64 dataURL を Buffer に変換して put。
 * @param userId User.id
 * @param generationId Generation.id
 * @param size 'Instagram (1080x1080)' 等。ファイル名に safe 化して使用
 * @param base64DataUrl 'data:image/png;base64,...' 形式
 */
export async function uploadGenerationImage(
  userId: string,
  generationId: string,
  size: string,
  base64DataUrl: string,
): Promise<string> {
  const token = ensureToken();
  const base64 = base64DataUrl.split(',')[1] ?? base64DataUrl;
  const buf = Buffer.from(base64, 'base64');

  const safeSize = size.replace(/[^a-zA-Z0-9-]/g, '_');
  const path = `generations/${userId}/${generationId}/${safeSize}.png`;

  const result = await put(path, buf, {
    access: 'public',
    contentType: 'image/png',
    token,
  });
  return result.url;
}

/**
 * 1 セッション分の画像群を一括削除。Generation 削除時に呼ぶ。
 * Vercel Blob の list API で prefix 検索して del。
 */
export async function deleteGenerationFolder(
  userId: string,
  generationId: string,
): Promise<void> {
  const token = ensureToken();
  const prefix = `generations/${userId}/${generationId}/`;

  const result = await list({ prefix, token });
  if (result.blobs.length === 0) return;

  await del(
    result.blobs.map((b) => b.url),
    { token },
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/generations/blob-client.ts
git commit -m "feat(generations): add Blob client for upload/delete"
```

---

## Task 5: briefSnapshot ヘルパー作成

**Files:**
- Create: `src/lib/generations/snapshot.ts`

- [ ] **Step 1: snapshot.ts 作成**

```ts
/**
 * Phase A.11.5: briefSnapshot の構築 + 復元。
 *
 * Generation.briefSnapshot に保存する内容:
 * - IroncladBrief（pattern, product, target, purpose, sizes）
 * - 使用したコピー / デザイン要件 / CTA / トーン / 注意（最終的に生成に渡された値）
 * - 使用 asset id 群（productAssetId, badgeAsset1Id, badgeAsset2Id, useWinningRef）
 */

import type { IroncladMaterials } from '@/lib/prompts/ironclad-banner';

export interface BriefSnapshot {
  /** Generation 単位で固定（Step 1 で入力） */
  pattern: string;
  product: string;
  target: string;
  purpose: string;
  sizes: string[];

  /** Step 2 で選択（最終生成時の値） */
  copies: [string, string, string, string];
  designRequirements: [string, string, string, string];
  cta: string;
  tone: string;
  caution: string;

  /** Asset id 群（再生成時の素材復元用） */
  productImageUrl: string | null;
  badgeImageUrl1: string | null;
  badgeImageUrl2: string | null;
  useWinningRef: boolean;
}

/**
 * IroncladMaterials（API 入力）から briefSnapshot を構築。
 * 注: assetId ではなく blobUrl を保存する。Asset row が削除されても画像 URL から復元可能。
 */
export function buildBriefSnapshot(materials: IroncladMaterials): BriefSnapshot {
  return {
    pattern: materials.pattern,
    product: materials.product,
    target: materials.target,
    purpose: materials.purpose,
    sizes: [materials.size], // 単一サイズ呼出時は 1 要素、後で merge
    copies: materials.copies,
    designRequirements: materials.designRequirements,
    cta: materials.cta,
    tone: materials.tone,
    caution: materials.caution,
    productImageUrl: materials.productImageUrl ?? null,
    badgeImageUrl1: materials.badgeImageUrl1 ?? null,
    badgeImageUrl2: materials.badgeImageUrl2 ?? null,
    useWinningRef: materials.useWinningRef ?? false,
  };
}

/**
 * 同セッション判定: 同じ pattern/product/target/purpose かつ過去 5 分以内なら同セッション扱い
 * 戻り値: マージ可能な既存 Generation の briefSnapshot 比較用キー
 */
export function snapshotIdentityKey(s: BriefSnapshot): string {
  return [s.pattern, s.product, s.target, s.purpose].join('|');
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/generations/snapshot.ts
git commit -m "feat(generations): add briefSnapshot helpers"
```

---

## Task 6: ironclad-generate を Generation 保存対応に拡張

**Files:**
- Modify: `src/app/api/ironclad-generate/route.ts`

- [ ] **Step 1: import 群拡張**

`src/app/api/ironclad-generate/route.ts` の冒頭 import に追加：

```ts
import { buildBriefSnapshot, snapshotIdentityKey, type BriefSnapshot } from '@/lib/generations/snapshot';
import { uploadGenerationImage } from '@/lib/generations/blob-client';
```

- [ ] **Step 2: 生成成功直後に Generation 作成 + Blob upload を追加**

既存の「Phase A.11.0/A.11.3: 生成成功時に使用回数カウントアップ」ブロックの直後（`return NextResponse.json(...)` の前）に追加：

```ts
    // Phase A.11.5: 履歴保存（Generation + GenerationImage）
    let generationId: string | undefined;
    if (currentUser.userId) {
      try {
        const snapshot = buildBriefSnapshot(materials);
        const identityKey = snapshotIdentityKey(snapshot);

        // 同セッション判定: 過去 5 分以内に同じブリーフがあればマージ
        const recentSessions = await getPrisma().generation.findMany({
          where: {
            userId: currentUser.userId,
            createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        const matched = recentSessions.find((g) => {
          const s = g.briefSnapshot as unknown as BriefSnapshot;
          return snapshotIdentityKey(s) === identityKey;
        });

        let generation;
        if (matched) {
          generation = matched;
        } else {
          generation = await getPrisma().generation.create({
            data: {
              userId: currentUser.userId,
              briefSnapshot: snapshot as unknown as object,
            },
          });
        }
        generationId = generation.id;

        // 画像を Blob にアップロード
        const blobUrl = await uploadGenerationImage(
          currentUser.userId,
          generation.id,
          materials.size,
          result.base64,
        );

        await getPrisma().generationImage.create({
          data: {
            generationId: generation.id,
            size: materials.size,
            blobUrl,
            provider: result.providerId,
            providerMetadata: result.providerMetadata as unknown as object,
          },
        });
      } catch (err) {
        // 履歴保存失敗はベストエフォート（生成自体は成功扱いを維持）
        console.error('Phase A.11.5 generation save failed:', err);
      }
    }
```

- [ ] **Step 3: レスポンスに generationId を含める**

既存の `return NextResponse.json({...})` を以下に置換：

```ts
    return NextResponse.json({
      imageUrl: result.base64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
      promptPreview: finalPrompt,
      usageCount: newUsageCount,
      generationId,  // Phase A.11.5: クライアントが「履歴を見る」リンクに使う
    });
```

- [ ] **Step 4: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/app/api/ironclad-generate/route.ts
git commit -m "feat(api): save Generation + Blob on successful generation"
```

---

## Task 7: GET /api/history 一覧 API

**Files:**
- Create: `src/app/api/history/route.ts`

- [ ] **Step 1: route.ts 作成**

```ts
/**
 * Phase A.11.5: GET /api/history
 *
 * クエリ:
 * - cursor?: string  Generation.id（カーソルベースページング）
 * - limit?: string   1〜50（デフォルト 20）
 *
 * レスポンス:
 * {
 *   sessions: [{ id, createdAt, brief, images, locked, hasFavorite }],
 *   nextCursor: string | null,
 *   lockedCount: number,    // ロック中の総数（Free/Starter のみ非ゼロ）
 *   plan: string,
 * }
 *
 * ロック判定: 直近 N 件以内 OR ★お気に入り含む → unlocked
 * ロック時は images の blobUrl を空文字でマスク（漏洩防止）
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limitStr = url.searchParams.get('limit') ?? '20';
    const limit = Math.min(50, Math.max(1, Number.parseInt(limitStr, 10) || 20));

    const prisma = getPrisma();
    const accessLimit = getHistoryAccessLimit(user.plan);

    // 全件取得（プラン制限・ロック判定のため index 必要）
    // 大量履歴ユーザーは Pro 想定で件数自体は多くない（数百件程度想定）
    const allSessions = await prisma.generation.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: { images: true },
    });

    // ロック判定 + マスキング
    const enriched = allSessions.map((s, idx) => {
      const hasFavorite = s.images.some((img) => img.isFavorite);
      const locked = computeLocked({ index: idx, accessLimit, hasFavorite });
      return {
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        brief: pickBriefFields(s.briefSnapshot as unknown as BriefSnapshot),
        images: s.images.map((img) => ({
          id: img.id,
          size: img.size,
          blobUrl: locked ? '' : img.blobUrl,
          isFavorite: img.isFavorite,
        })),
        locked,
        hasFavorite,
      };
    });

    const lockedCount = enriched.filter((s) => s.locked).length;

    // カーソルページング（cursor 以降の limit 件）
    const startIdx = cursor ? enriched.findIndex((s) => s.id === cursor) + 1 : 0;
    const page = enriched.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < enriched.length ? page[page.length - 1]?.id : null;

    return NextResponse.json({
      sessions: page,
      nextCursor: nextCursor ?? null,
      lockedCount,
      plan: user.plan,
    });
  } catch (err) {
    console.error('GET /api/history error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function pickBriefFields(s: BriefSnapshot) {
  return {
    pattern: s.pattern,
    product: s.product,
    target: s.target,
    purpose: s.purpose,
  };
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/api/history/route.ts
git commit -m "feat(api): GET /api/history list with lock detection"
```

---

## Task 8: GET / DELETE /api/history/[id]

**Files:**
- Create: `src/app/api/history/[id]/route.ts`

- [ ] **Step 1: route.ts 作成**

```ts
/**
 * Phase A.11.5: GET /api/history/[id] 詳細 / DELETE 削除
 *
 * GET: ロック対象は 403、自分の userId 以外も 403
 * DELETE: 自分の userId のもののみ、Blob も prefix 一括削除
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import { deleteGenerationFolder } from '@/lib/generations/blob-client';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!generation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ロック判定: index を出すために createdAt desc で全件取得
    const allSessions = await prisma.generation.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, images: { select: { isFavorite: true } } },
    });
    const accessLimit = getHistoryAccessLimit(user.plan);
    const idx = allSessions.findIndex((s) => s.id === id);
    const hasFavorite = allSessions[idx]?.images.some((img) => img.isFavorite) ?? false;
    const locked = computeLocked({ index: idx, accessLimit, hasFavorite });

    if (locked) {
      return NextResponse.json(
        { error: 'Locked. Upgrade to Pro for full access.' },
        { status: 403 },
      );
    }

    return NextResponse.json({
      id: generation.id,
      createdAt: generation.createdAt.toISOString(),
      briefSnapshot: generation.briefSnapshot as unknown as BriefSnapshot,
      images: generation.images.map((img) => ({
        id: img.id,
        size: img.size,
        blobUrl: img.blobUrl,
        provider: img.provider,
        isFavorite: img.isFavorite,
        favoritedAt: img.favoritedAt?.toISOString() ?? null,
        createdAt: img.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('GET /api/history/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({ where: { id } });
    if (!generation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Blob を先に削除（DB 削除後だと参照情報が消える）
    await deleteGenerationFolder(user.userId, id).catch((err) => {
      console.error('deleteGenerationFolder failed (continuing):', err);
    });

    // DB cascade で GenerationImage も削除される
    await prisma.generation.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/history/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/api/history/[id]/route.ts
git commit -m "feat(api): GET/DELETE /api/history/[id]"
```

---

## Task 9: PUT /api/history/image/[imageId]/favorite

**Files:**
- Create: `src/app/api/history/image/[imageId]/favorite/route.ts`

- [ ] **Step 1: route.ts 作成**

```ts
/**
 * Phase A.11.5: PUT /api/history/image/[imageId]/favorite
 *
 * Body: { isFavorite: boolean }
 * プラン別制限:
 * - Free: 常に 403（お気に入り使用不可、Pro 訴求）
 * - Starter: 既に 5 枚 ★ 済 + 新規 ★ → 429
 * - Pro / Plan C: 制限なし
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getFavoriteLimit } from '@/lib/plans/history-limits';

export const runtime = 'nodejs';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = getFavoriteLimit(user.plan);
    if (limit === 0) {
      return NextResponse.json(
        { error: 'お気に入りは Pro プランで開放されます' },
        { status: 403 },
      );
    }

    const body = (await req.json()) as { isFavorite?: unknown };
    if (typeof body.isFavorite !== 'boolean') {
      return NextResponse.json({ error: 'isFavorite must be boolean' }, { status: 400 });
    }

    const prisma = getPrisma();
    const image = await prisma.generationImage.findUnique({
      where: { id: imageId },
      include: { generation: true },
    });
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (image.generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 新規 ★ 化の場合、上限チェック
    if (body.isFavorite && !image.isFavorite && Number.isFinite(limit)) {
      const currentCount = await prisma.generationImage.count({
        where: {
          generation: { userId: user.userId },
          isFavorite: true,
        },
      });
      if (currentCount >= limit) {
        return NextResponse.json(
          {
            error: `お気に入り上限に到達しました（${limit} 枚）`,
            limit,
            current: currentCount,
          },
          { status: 429 },
        );
      }
    }

    const updated = await prisma.generationImage.update({
      where: { id: imageId },
      data: {
        isFavorite: body.isFavorite,
        favoritedAt: body.isFavorite ? new Date() : null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      isFavorite: updated.isFavorite,
      favoritedAt: updated.favoritedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error('PUT /api/history/image/[imageId]/favorite error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/api/history/image/[imageId]/favorite/route.ts
git commit -m "feat(api): PUT favorite toggle with plan limit"
```

---

## Task 10: GET /api/history/[id]/zip

**Files:**
- Create: `src/app/api/history/[id]/zip/route.ts`

- [ ] **Step 1: route.ts 作成**

```ts
/**
 * Phase A.11.5: GET /api/history/[id]/zip
 *
 * Pro+ のみ。実際の ZIP 生成はクライアント側 (jszip)。
 * このエンドポイントは画像 URL リストを返すだけ。
 *
 * Free / Starter は 403、ロック対象は 403
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pro+ のみ
    if (user.plan !== 'pro' && user.plan !== 'admin') {
      return NextResponse.json(
        { error: 'ZIP DL は Pro プラン以上で利用可能です' },
        { status: 403 },
      );
    }

    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!generation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pro+ なのでロック対象になる事は通常ないが、保険として判定
    const allSessions = await prisma.generation.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, images: { select: { isFavorite: true } } },
    });
    const idx = allSessions.findIndex((s) => s.id === id);
    const hasFavorite = allSessions[idx]?.images.some((img) => img.isFavorite) ?? false;
    const locked = computeLocked({
      index: idx,
      accessLimit: getHistoryAccessLimit(user.plan),
      hasFavorite,
    });
    if (locked) {
      return NextResponse.json({ error: 'Locked' }, { status: 403 });
    }

    const snapshot = generation.briefSnapshot as unknown as BriefSnapshot;
    const safeProductName = (snapshot.product || 'banner').replace(
      /[^a-zA-Z0-9ぁ-んァ-ヶ一-龥-]/g,
      '_',
    ).slice(0, 30);
    const ts = generation.createdAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    return NextResponse.json({
      filenamePrefix: `${safeProductName}_${ts}`,
      images: generation.images.map((img) => ({
        size: img.size,
        blobUrl: img.blobUrl,
        filename: `${safeProductName}_${img.size.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
      })),
    });
  } catch (err) {
    console.error('GET /api/history/[id]/zip error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/api/history/[id]/zip/route.ts
git commit -m "feat(api): GET ZIP DL URL list (Pro+)"
```

---

## Task 11: UpgradeLockModal コンポーネント

**Files:**
- Create: `src/app/history/UpgradeLockModal.tsx`

- [ ] **Step 1: UpgradeLockModal.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.5: ロック対象セッションをクリックした時の Pro 訴求モーダル。
 *
 * - mailto でアップグレード相談 (A.12 Stripe 完成までの暫定)
 * - body スクロールロック + ESC で閉じる
 */
import { useEffect } from 'react';

interface UpgradeLockModalProps {
  open: boolean;
  onClose: () => void;
  plan: string;
  lockedCount: number;
}

export function UpgradeLockModal({
  open,
  onClose,
  plan,
  lockedCount,
}: UpgradeLockModalProps) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  if (!open) return null;

  const subject = `[勝ちバナー作る君] アップグレード相談（${plan} → Pro）`;
  const body =
    `現在のプラン: ${plan}\n` +
    `ロック中履歴: ${lockedCount} 件\n\n` +
    `Pro プランへのアップグレードを希望します。`;
  const mailtoHref = `mailto:str.kk.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[min(90vw,460px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="lock-modal-title" className="text-lg font-bold mb-3">
          🔒 このバナーは Pro プランで開放できます
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          {plan === 'free' ? 'Free' : 'Starter'} プランでは
          {plan === 'free' ? '直近 10' : '直近 30'} セッションのみアクセス可能です。
          Pro プラン (¥14,800/月) で全履歴・全画像にアクセス・DL できます。
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            閉じる
          </button>
          <a
            href={mailtoHref}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 text-sm rounded font-semibold transition"
          >
            アップグレードのご相談
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/history/UpgradeLockModal.tsx
git commit -m "feat(history): add UpgradeLockModal"
```

---

## Task 12: SessionCard コンポーネント

**Files:**
- Create: `src/app/history/SessionCard.tsx`

- [ ] **Step 1: SessionCard.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.5: 履歴一覧の 1 セッションカード。
 *
 * - 通常表示: サムネ + ブリーフ要約 + アクション（詳細リンク）
 * - ロック表示: blur サムネ + 鍵アイコン + クリックでモーダル
 */
import Link from 'next/link';
import { Lock } from 'lucide-react';

interface BriefSummary {
  pattern: string;
  product: string;
  target: string;
  purpose: string;
}

interface SessionImage {
  id: string;
  size: string;
  blobUrl: string;
  isFavorite: boolean;
}

interface SessionCardProps {
  id: string;
  createdAt: string;
  brief: BriefSummary;
  images: SessionImage[];
  locked: boolean;
  onLockClick: () => void;
}

export function SessionCard({
  id,
  createdAt,
  brief,
  images,
  locked,
  onLockClick,
}: SessionCardProps) {
  const dateStr = new Date(createdAt).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const summary = `${brief.product} / ${brief.target} / ${brief.purpose}`;
  const visibleThumbs = images.slice(0, 3);
  const extraCount = Math.max(0, images.length - 3);

  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockClick}
        className="w-full text-left bg-neutral-900/50 border border-slate-800 rounded-lg p-4 hover:bg-neutral-900 transition relative overflow-hidden"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="text-xs text-slate-500">{dateStr}</div>
          <Lock className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-sm text-slate-300 mb-3 truncate">{summary}</div>
        <div className="flex gap-2">
          {visibleThumbs.map((img) => (
            <div
              key={img.id}
              className="w-16 h-16 bg-slate-800 rounded relative overflow-hidden"
            >
              {/* ロック時は blobUrl が空文字、サムネは灰色矩形 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          ))}
          {extraCount > 0 && (
            <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-500 text-xs">
              +{extraCount}
            </div>
          )}
        </div>
        <div className="text-xs text-amber-400 mt-3">クリックして Pro で解除</div>
      </button>
    );
  }

  return (
    <Link
      href={`/history/${id}`}
      className="block bg-neutral-900/50 border border-slate-800 rounded-lg p-4 hover:bg-neutral-900 transition"
    >
      <div className="text-xs text-slate-500 mb-2">{dateStr}</div>
      <div className="text-sm text-slate-200 mb-3 truncate">{summary}</div>
      <div className="flex gap-2">
        {visibleThumbs.map((img) => (
          <div key={img.id} className="w-16 h-16 bg-slate-800 rounded overflow-hidden relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.blobUrl}
              alt={img.size}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {img.isFavorite && (
              <div className="absolute top-0 right-0 text-amber-300 text-xs px-1">★</div>
            )}
          </div>
        ))}
        {extraCount > 0 && (
          <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-400 text-xs">
            +{extraCount}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/history/SessionCard.tsx
git commit -m "feat(history): add SessionCard with normal/locked variants"
```

---

## Task 13: HistoryList + history/page.tsx

**Files:**
- Create: `src/app/history/HistoryList.tsx`
- Create: `src/app/history/page.tsx`

- [ ] **Step 1: HistoryList.tsx 作成（Client Component）**

```tsx
'use client';

/**
 * Phase A.11.5: /history のクライアント側リスト。
 * - GET /api/history で取得
 * - フィルタ「全て / お気に入りのみ」
 * - ロック行クリックで UpgradeLockModal 表示
 * - フッターに「他 N 件ロック中」バナー
 */
import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { SessionCard } from './SessionCard';
import { UpgradeLockModal } from './UpgradeLockModal';

interface SessionDto {
  id: string;
  createdAt: string;
  brief: { pattern: string; product: string; target: string; purpose: string };
  images: { id: string; size: string; blobUrl: string; isFavorite: boolean }[];
  locked: boolean;
  hasFavorite: boolean;
}

interface ListResponse {
  sessions: SessionDto[];
  nextCursor: string | null;
  lockedCount: number;
  plan: string;
}

export function HistoryList() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/history?limit=50');
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as ListResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="text-slate-400 text-sm">読み込み中…</div>;
  }
  if (error) {
    return <div className="text-red-400 text-sm">エラー: {error}</div>;
  }
  if (!data || data.sessions.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-12 text-center">
        まだ履歴がありません。バナーを生成してみましょう。
      </div>
    );
  }

  const visible =
    filter === 'favorites'
      ? data.sessions.filter((s) => s.hasFavorite)
      : data.sessions;

  return (
    <div className="space-y-6">
      {/* フィルタ */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-xs rounded-full border transition ${
            filter === 'all'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          全て
        </button>
        <button
          type="button"
          onClick={() => setFilter('favorites')}
          className={`px-3 py-1 text-xs rounded-full border transition ${
            filter === 'favorites'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          ★ お気に入りのみ
        </button>
      </div>

      {/* セッションリスト */}
      <div className="space-y-3">
        {visible.map((s) => (
          <SessionCard
            key={s.id}
            id={s.id}
            createdAt={s.createdAt}
            brief={s.brief}
            images={s.images}
            locked={s.locked}
            onLockClick={() => setModalOpen(true)}
          />
        ))}
      </div>

      {/* フッターバナー: ロック中件数表示 */}
      {data.lockedCount > 0 && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 hover:bg-amber-900/40 transition text-left"
        >
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-amber-400" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-300">
                🔒 他 {data.lockedCount} 件ロック中
              </div>
              <div className="text-xs text-amber-400/80 mt-1">
                Pro プランで全件アクセス可能になります
              </div>
            </div>
            <span className="text-xs text-amber-400 underline">
              アップグレード →
            </span>
          </div>
        </button>
      )}

      <UpgradeLockModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        plan={data.plan}
        lockedCount={data.lockedCount}
      />
    </div>
  );
}
```

- [ ] **Step 2: page.tsx 作成（Server Component）**

```tsx
/**
 * Phase A.11.5: /history ページ。
 * Server Component で Header を render、リストは Client Component (HistoryList) に委譲。
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { Header } from '@/components/layout/Header';
import { HistoryList } from './HistoryList';

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user.userId) {
    redirect('/signin?callbackUrl=/history');
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">履歴</h1>
          <Link
            href="/"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded transition"
          >
            + 新規作成
          </Link>
        </div>
        <HistoryList />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/app/history/HistoryList.tsx src/app/history/page.tsx
git commit -m "feat(history): add /history list page"
```

---

## Task 14: history/[id] 詳細ページ + zip-helper

**Files:**
- Create: `src/app/history/[id]/HistoryDetail.tsx`
- Create: `src/app/history/[id]/page.tsx`
- Create: `src/app/history/[id]/zip-helper.ts`

- [ ] **Step 1: zip-helper.ts 作成**

```ts
/**
 * Phase A.11.5: クライアント側で jszip を使った ZIP 生成・ダウンロード。
 * GET /api/history/[id]/zip で URL リスト取得 → fetch → JSZip → blob URL → click DL
 */
import JSZip from 'jszip';

interface ZipImageMeta {
  size: string;
  blobUrl: string;
  filename: string;
}

interface ZipApiResponse {
  filenamePrefix: string;
  images: ZipImageMeta[];
}

export async function downloadGenerationZip(generationId: string): Promise<void> {
  const res = await fetch(`/api/history/${generationId}/zip`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as ZipApiResponse;

  const zip = new JSZip();
  await Promise.all(
    data.images.map(async (img) => {
      const r = await fetch(img.blobUrl);
      const buf = await r.arrayBuffer();
      zip.file(img.filename, buf);
    }),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.filenamePrefix}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: HistoryDetail.tsx 作成（Client Component）**

```tsx
'use client';

/**
 * Phase A.11.5: 履歴詳細の Client UI。
 * - ブリーフ全体表示
 * - 各サイズ画像グリッド + ★ トグル + 個別 DL + 削除
 * - 「同条件で再生成」「編集して再生成」ボタン
 * - 「一括 ZIP DL」（Pro+ のみ有効）
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Star, Download, Trash2, Sparkles, Pencil, Archive } from 'lucide-react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { downloadGenerationZip } from './zip-helper';

interface DetailImage {
  id: string;
  size: string;
  blobUrl: string;
  provider: string;
  isFavorite: boolean;
  favoritedAt: string | null;
  createdAt: string;
}

interface DetailDto {
  id: string;
  createdAt: string;
  briefSnapshot: {
    pattern: string;
    product: string;
    target: string;
    purpose: string;
    sizes: string[];
    copies: [string, string, string, string];
    designRequirements: [string, string, string, string];
    cta: string;
    tone: string;
    caution: string;
  };
  images: DetailImage[];
}

interface HistoryDetailProps {
  detail: DetailDto;
}

export function HistoryDetail({ detail: initialDetail }: HistoryDetailProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = sessionToCurrentUser(session);
  const [detail, setDetail] = useState(initialDetail);
  const [favError, setFavError] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isPro = user.plan === 'pro' || user.plan === 'admin';

  const handleFavoriteToggle = async (imageId: string, current: boolean) => {
    setFavError(null);
    try {
      const res = await fetch(`/api/history/image/${imageId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !current }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFavError(j.error || `HTTP ${res.status}`);
        return;
      }
      setDetail((prev) => ({
        ...prev,
        images: prev.images.map((img) =>
          img.id === imageId ? { ...img, isFavorite: !current } : img,
        ),
      }));
    } catch (e) {
      setFavError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleZipDownload = async () => {
    if (!isPro) return;
    setZipLoading(true);
    try {
      await downloadGenerationZip(detail.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setZipLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('この履歴を削除しますか？画像も完全に消去されます。')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/history/${detail.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `HTTP ${res.status}`);
        return;
      }
      router.push('/history');
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerateSame = () => {
    router.push(`/?regenerate=${detail.id}`);
  };

  const handleRegenerateEdit = () => {
    router.push(`/?prefill=${detail.id}`);
  };

  const handleImageDownload = (blobUrl: string, size: string) => {
    const link = document.createElement('a');
    link.href = blobUrl;
    const safe = size.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `${detail.briefSnapshot.product || 'banner'}_${safe}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const dateStr = new Date(detail.createdAt).toLocaleString('ja-JP');

  return (
    <div className="space-y-8">
      {/* ヘッダー操作 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">履歴詳細</h1>
          <div className="text-xs text-slate-500 mt-1">作成: {dateStr}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRegenerateSame}
            className="inline-flex items-center gap-1 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded transition"
          >
            <Sparkles className="w-4 h-4" />
            同条件で再生成
          </button>
          <button
            type="button"
            onClick={handleRegenerateEdit}
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            <Pencil className="w-4 h-4" />
            編集して再生成
          </button>
          <button
            type="button"
            onClick={handleZipDownload}
            disabled={!isPro || zipLoading}
            title={isPro ? '一括 ZIP ダウンロード' : 'ZIP DL は Pro プランで利用可能'}
            className={`inline-flex items-center gap-1 px-3 py-2 text-sm rounded transition ${
              isPro
                ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Archive className="w-4 h-4" />
            {zipLoading ? '生成中…' : '一括 ZIP DL'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            削除
          </button>
        </div>
      </div>

      {/* ブリーフ要約 */}
      <section className="bg-neutral-900/50 border border-slate-800 rounded-lg p-4 space-y-2 text-sm">
        <h2 className="text-base font-semibold text-teal-300 mb-2">ブリーフ</h2>
        <div><span className="text-slate-500 w-24 inline-block">パターン:</span> {detail.briefSnapshot.pattern}</div>
        <div><span className="text-slate-500 w-24 inline-block">商材:</span> {detail.briefSnapshot.product}</div>
        <div><span className="text-slate-500 w-24 inline-block">ターゲット:</span> {detail.briefSnapshot.target}</div>
        <div><span className="text-slate-500 w-24 inline-block">目的:</span> {detail.briefSnapshot.purpose}</div>
        <div><span className="text-slate-500 w-24 inline-block">CTA:</span> {detail.briefSnapshot.cta}</div>
        <div><span className="text-slate-500 w-24 inline-block">トーン:</span> {detail.briefSnapshot.tone}</div>
      </section>

      {favError && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded px-3 py-2">
          {favError}
        </div>
      )}

      {/* 画像グリッド */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {detail.images.map((img) => (
          <div
            key={img.id}
            className="bg-neutral-900/50 border border-slate-800 rounded-lg overflow-hidden"
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.blobUrl}
                alt={img.size}
                className="w-full h-auto"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleFavoriteToggle(img.id, img.isFavorite)}
                disabled={user.plan === 'free'}
                title={
                  user.plan === 'free'
                    ? 'お気に入りは Pro プランで開放'
                    : img.isFavorite
                      ? 'お気に入り解除'
                      : 'お気に入りに追加'
                }
                className={`absolute top-2 right-2 p-2 rounded-full transition ${
                  img.isFavorite
                    ? 'bg-amber-500 text-amber-950'
                    : 'bg-black/60 text-white hover:bg-black/80'
                } ${user.plan === 'free' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Star className={`w-4 h-4 ${img.isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">{img.size}</span>
              <button
                type="button"
                onClick={() => handleImageDownload(img.blobUrl, img.size)}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition"
              >
                <Download className="w-3 h-3" />
                DL
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: page.tsx 作成（Server Component）**

```tsx
/**
 * Phase A.11.5: /history/[id] 詳細ページ。
 * Server Component で getCurrentUser + DB 取得 → HistoryDetail に渡す。
 */
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import { Header } from '@/components/layout/Header';
import { HistoryDetail } from './HistoryDetail';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.userId) {
    redirect(`/signin?callbackUrl=/history/${id}`);
  }

  const prisma = getPrisma();
  const generation = await prisma.generation.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!generation) notFound();
  if (generation.userId !== user.userId) notFound();

  // ロック判定
  const allSessions = await prisma.generation.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, images: { select: { isFavorite: true } } },
  });
  const accessLimit = getHistoryAccessLimit(user.plan);
  const idx = allSessions.findIndex((s) => s.id === id);
  const hasFavorite = allSessions[idx]?.images.some((img) => img.isFavorite) ?? false;
  const locked = computeLocked({ index: idx, accessLimit, hasFavorite });
  if (locked) {
    // ロック対象は一覧に戻して訴求モーダル経由に統一
    redirect('/history');
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <HistoryDetail
          detail={{
            id: generation.id,
            createdAt: generation.createdAt.toISOString(),
            briefSnapshot: generation.briefSnapshot as unknown as BriefSnapshot,
            images: generation.images.map((img) => ({
              id: img.id,
              size: img.size,
              blobUrl: img.blobUrl,
              provider: img.provider,
              isFavorite: img.isFavorite,
              favoritedAt: img.favoritedAt?.toISOString() ?? null,
              createdAt: img.createdAt.toISOString(),
            })),
          }}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/app/history/[id]/HistoryDetail.tsx src/app/history/[id]/page.tsx src/app/history/[id]/zip-helper.ts
git commit -m "feat(history): add /history/[id] detail page + zip helper"
```

---

## Task 15: POST /api/history/[id]/regenerate

**Files:**
- Create: `src/app/api/history/[id]/regenerate/route.ts`

- [ ] **Step 1: route.ts 作成**

```ts
/**
 * Phase A.11.5: POST /api/history/[id]/regenerate
 *
 * クライアントが「同条件で再生成」を選んだ時、briefSnapshot を返す API。
 * 実際の再生成は ironclad-generate を呼ぶ（クライアント側で組み立てる）。
 *
 * このエンドポイントは「再生成に必要な materials を取得する」だけ。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const generation = await prisma.generation.findUnique({ where: { id } });
    if (!generation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (generation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const snapshot = generation.briefSnapshot as unknown as BriefSnapshot;
    return NextResponse.json({ briefSnapshot: snapshot });
  } catch (err) {
    console.error('POST /api/history/[id]/regenerate error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/api/history/[id]/regenerate/route.ts
git commit -m "feat(api): POST regenerate (return briefSnapshot)"
```

---

## Task 16: ironclad page に regenerate / prefill URL 対応

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: useSearchParams で regenerate / prefill を処理**

`src/app/page.tsx` の `IroncladPage` 関数本体冒頭、`useState` 群の後に追加：

```tsx
import { useSearchParams } from 'next/navigation';
```

```tsx
  const searchParams = useSearchParams();

  // Phase A.11.5: ?regenerate=<id> または ?prefill=<id> で履歴から復元
  useEffect(() => {
    const regenerateId = searchParams.get('regenerate');
    const prefillId = searchParams.get('prefill');
    const targetId = regenerateId || prefillId;
    if (!targetId) return;

    (async () => {
      try {
        const res = await fetch(`/api/history/${targetId}/regenerate`, {
          method: 'POST',
        });
        if (!res.ok) {
          console.warn('failed to load regenerate target');
          return;
        }
        const { briefSnapshot } = await res.json();
        // brief を復元
        setBrief({
          pattern: briefSnapshot.pattern,
          product: briefSnapshot.product,
          target: briefSnapshot.target,
          purpose: briefSnapshot.purpose,
          sizes: briefSnapshot.sizes,
        });
        // selections を復元
        setSelections({
          copies: briefSnapshot.copies,
          designRequirements: briefSnapshot.designRequirements,
          cta: briefSnapshot.cta,
          tone: briefSnapshot.tone,
          caution: briefSnapshot.caution,
        });
        setSuggestionsSignature(
          `${briefSnapshot.pattern}|${briefSnapshot.product}|${briefSnapshot.target}|${briefSnapshot.purpose}`,
        );
        // baseMaterials を復元（regenerate のみ）
        if (regenerateId) {
          setBaseMaterials({
            pattern: briefSnapshot.pattern,
            product: briefSnapshot.product,
            target: briefSnapshot.target,
            purpose: briefSnapshot.purpose,
            copies: briefSnapshot.copies,
            designRequirements: briefSnapshot.designRequirements,
            cta: briefSnapshot.cta,
            tone: briefSnapshot.tone,
            caution: briefSnapshot.caution,
            productImageUrl: briefSnapshot.productImageUrl ?? undefined,
            badgeImageUrl1: briefSnapshot.badgeImageUrl1 ?? undefined,
            badgeImageUrl2: briefSnapshot.badgeImageUrl2 ?? undefined,
            useWinningRef: briefSnapshot.useWinningRef ?? false,
          });
          // Step 3 直行
          setStep(3);
          setMaxVisitedStep(3);
        } else {
          // prefill: Step 1 戻り
          setStep(1);
        }
      } catch (err) {
        console.error('regenerate/prefill failed:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

注: 既存の `useEffect` 群と同列で配置。`searchParams.get()` は client-side で実行される。

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/page.tsx
git commit -m "feat(ironclad): handle ?regenerate / ?prefill URL params from history"
```

---

## Task 17: UserMenu に「履歴」項目追加

**Files:**
- Modify: `src/components/layout/UserMenu.tsx`

- [ ] **Step 1: import に History アイコン追加**

`src/components/layout/UserMenu.tsx` の lucide-react import 行を以下に置換：

```tsx
import { UserCircle, User, CreditCard, LogOut, History } from 'lucide-react';
```

- [ ] **Step 2: ドロップダウン内の「マイアカウント」と「プラン変更」の間に「履歴」追加**

`<Link href="/account#plan">...プラン変更</Link>` の直前に追加：

```tsx
          <Link
            href="/history"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            onClick={() => setOpen(false)}
          >
            <History className="w-4 h-4" />
            履歴
          </Link>
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/layout/UserMenu.tsx
git commit -m "feat(layout): add 履歴 link to UserMenu dropdown"
```

---

## Task 18: /account に「履歴」セクション追加

**Files:**
- Create: `src/app/account/HistorySection.tsx`
- Modify: `src/app/account/page.tsx`

- [ ] **Step 1: HistorySection.tsx 作成**

```tsx
/**
 * Phase A.11.5: /account の「履歴」セクション。
 * Server Component で直近 1 件 + 件数 + ロック数を取得して表示。
 */
import Link from 'next/link';
import { getPrisma } from '@/lib/prisma';
import { getHistoryAccessLimit } from '@/lib/plans/history-limits';
import { computeLocked } from '@/lib/plans/history-lock';
import type { BriefSnapshot } from '@/lib/generations/snapshot';

interface HistorySectionProps {
  userId: string;
  plan: string;
}

export async function HistorySection({ userId, plan }: HistorySectionProps) {
  const prisma = getPrisma();
  const sessions = await prisma.generation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { images: { select: { isFavorite: true } } },
  });

  const accessLimit = getHistoryAccessLimit(plan);
  const lockedCount = sessions.filter((s, idx) => {
    const hasFavorite = s.images.some((img) => img.isFavorite);
    return computeLocked({ index: idx, accessLimit, hasFavorite });
  }).length;

  const total = sessions.length;
  const latest = sessions[0];

  return (
    <section>
      <h2 className="text-lg font-semibold border-b border-slate-800 pb-2 mb-4">
        履歴
      </h2>
      <div className="space-y-3">
        {total === 0 ? (
          <div className="text-sm text-slate-400">
            まだ履歴がありません。バナーを生成してみましょう。
          </div>
        ) : (
          <>
            {latest && (
              <div className="text-sm text-slate-300">
                最新の生成:{' '}
                <span className="text-slate-100">
                  {new Date(latest.createdAt).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {' / '}
                <span className="text-slate-400">
                  {(latest.briefSnapshot as unknown as BriefSnapshot).product}
                </span>
              </div>
            )}
            <div className="text-sm text-slate-300">
              履歴件数: <span className="font-semibold">{total}</span> 件
              {lockedCount > 0 && (
                <span className="text-amber-400 ml-2">
                  （うち ロック中 {lockedCount} 件）
                </span>
              )}
            </div>
          </>
        )}
        <Link
          href="/history"
          className="inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
        >
          すべての履歴を見る →
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: /account/page.tsx に HistorySection 追加**

`src/app/account/page.tsx` の import に追加：

```tsx
import { HistorySection } from './HistorySection';
```

`<PlanSection user={user} />` の直後に追加：

```tsx
        <HistorySection userId={user.userId!} plan={user.plan} />
```

注: `user.userId` は早期 redirect で null チェック済なので `!` で non-null 確定。

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/app/account/HistorySection.tsx src/app/account/page.tsx
git commit -m "feat(account): add HistorySection summary"
```

---

## Task 19: Step 3 完成画面にトースト追加

**Files:**
- Create: `src/components/ui/Toast.tsx`
- Modify: `src/components/ironclad/IroncladGenerateScreen.tsx`

- [ ] **Step 1: Toast.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.5: 簡易トースト。Step 3 完成時の「履歴に保存しました」表示用。
 *
 * - 5 秒で自動フェードアウト
 * - 任意のアクションリンク追加可能
 */
import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onClose: () => void;
}

export function Toast({ message, actionLabel, actionHref, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // フェード後にアンマウント
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 bg-emerald-900/90 border border-emerald-700 rounded-lg px-4 py-3 shadow-2xl">
        <CheckCircle className="w-5 h-5 text-emerald-300" />
        <span className="text-sm text-emerald-100">{message}</span>
        {actionLabel && actionHref && (
          <a
            href={actionHref}
            className="text-sm text-emerald-300 underline hover:text-emerald-200"
          >
            {actionLabel}
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-emerald-300 hover:text-emerald-100"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: IroncladGenerateScreen.tsx でトースト表示**

`src/components/ironclad/IroncladGenerateScreen.tsx` の import に追加：

```tsx
import { Toast } from '@/components/ui/Toast';
```

state を追加（既存 `usageLimitModalOpen` 等と同列）：

```tsx
  const [toastInfo, setToastInfo] = useState<{ generationId: string } | null>(null);
```

`generateOne` 関数内、`usageCount` 反映の直後に追加：

```tsx
      // Phase A.11.5: 履歴保存通知トースト
      if (typeof json.generationId === 'string') {
        setToastInfo({ generationId: json.generationId });
      }
```

JSX の最後（`</UsageLimitModal />` の直後）に追加：

```tsx
      {toastInfo && (
        <Toast
          message="履歴に保存しました"
          actionLabel="履歴を見る"
          actionHref={`/history/${toastInfo.generationId}`}
          onClose={() => setToastInfo(null)}
        />
      )}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/ui/Toast.tsx src/components/ironclad/IroncladGenerateScreen.tsx
git commit -m "feat(ironclad): add 'saved to history' toast on Step 3 success"
```

---

## Task 20: 統合検証 + main マージ【checkpoint】

**Files:**
- なし（検証 + git 操作のみ）

- [ ] **Step 1: フルビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功（`✓ Compiled successfully`）

- [ ] **Step 2: 開発サーバ起動**

```bash
npm run dev
```

- [ ] **Step 3: 履歴自動保存の検証**

ironclad ページ（`/`）で 1 サイズだけバナー生成：
- [ ] 完成画面に **「履歴に保存しました [履歴を見る]」トースト** 表示（5 秒で自動消滅）
- [ ] `node --env-file=.env scripts/verify-a11-users.mjs` で確認 → admin user の Generation 数が +1
- [ ] Vercel Blob ダッシュボード or list で `generations/<userId>/<generationId>/<size>.png` 確認

- [ ] **Step 4: /history 一覧の検証（admin）**

`/history` にアクセス：
- [ ] 1 セッション表示、サムネ + ブリーフ要約 + 日時
- [ ] フィルタ「全て / お気に入りのみ」切替動作
- [ ] フッターバナー「他 N 件ロック中」が **非表示**（admin はロックなし）
- [ ] サムネが正しく Blob URL から表示される

- [ ] **Step 5: 履歴詳細の検証**

セッションカードクリック → `/history/[id]`：
- [ ] ブリーフ全体表示（パターン / 商材 / ターゲット / 目的 / CTA / トーン）
- [ ] 画像グリッド表示
- [ ] ★ トグル → 反映、再リロードでも保持
- [ ] 個別 DL ボタン動作
- [ ] 一括 ZIP DL（admin なので有効）→ クライアント側 jszip 動作 → ZIP ダウンロード

- [ ] **Step 6: 再生成（同条件）の検証**

履歴詳細「同条件で再生成」クリック：
- [ ] `/?regenerate=<id>` に遷移
- [ ] Step 3 が自動表示される
- [ ] baseMaterials が復元され、すぐに再生成可能な状態
- [ ] 「すべて再生成」または「このサイズだけ再生成」で生成 → 同セッションに追加 or 新セッション

- [ ] **Step 7: 再生成（編集）の検証**

履歴詳細「編集して再生成」クリック：
- [ ] `/?prefill=<id>` に遷移
- [ ] Step 1 表示、フォームに前回入力が pre-fill されている
- [ ] 商材を変更 → Step 2 → Step 3 で新セッションとして保存

- [ ] **Step 8: 削除の検証**

履歴詳細「削除」→ confirm OK：
- [ ] /history へリダイレクト
- [ ] 一覧から消える
- [ ] DB の Generation が削除されている
- [ ] Vercel Blob の `generations/<userId>/<id>/` 配下が空になっている

- [ ] **Step 9: プラン別ロックの検証（手動 DB 切替）**

`scripts/set-test-pro.mjs` を `pro` から `free` + `usageCount=0` に書き換えて実行：

```bash
node --env-file=.env -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const {PrismaPg} = await import('@prisma/adapter-pg');
  const p = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})});
  // 11 セッション目を強制的に作って Free でロック挙動を確認するため、12 セッション分の Generation を生成
  // ただし複雑なので簡略: 既存セッションが 12 件以上ある状態を作る
  await p.user.update({where:{email:'str.kk.co@gmail.com'},data:{plan:'free',usageCount:0,usageResetAt:null}});
  console.log('switched to free');
  await p.\$disconnect();
});"
```

セッションを 11 件以上生成（バナー生成を 11 回繰り返す or DB に手動で 11 件挿入）→ /history で：
- [ ] 直近 10 件は通常表示
- [ ] 11 件目以降は **ロックカード表示**（鍵アイコン + ぼかし）
- [ ] ロック行クリック → UpgradeLockModal 表示
- [ ] フッターに「他 1 件以上ロック中」バナー表示
- [ ] DB は全件保持（消えてない）

検証後、admin に戻す：

```bash
node --env-file=.env scripts/restore-admin.mjs
```

- [ ] **Step 10: お気に入り 5 枚制限の検証**

DB を Starter に切替：

```bash
node --env-file=.env -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const {PrismaPg} = await import('@prisma/adapter-pg');
  const p = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})});
  await p.user.update({where:{email:'str.kk.co@gmail.com'},data:{plan:'starter',usageCount:0}});
  console.log('switched to starter');
  await p.\$disconnect();
});"
```

サインアウト → 再ログイン（プラン反映のため）or /account 訪問で SessionSyncer 走行：
- [ ] 履歴詳細で ★ をクリックして 5 枚お気に入り化
- [ ] 6 枚目をクリック → 「お気に入り上限に到達しました（5 枚）」エラー
- [ ] ★ 1 つ解除 → 6 枚目を再度クリック → 成功

検証後、admin に戻す。

- [ ] **Step 11: ヘッダー / /account 導線の検証**

- [ ] アバタークリック → ドロップダウンに「履歴」項目あり
- [ ] クリック → /history へ遷移
- [ ] /account の「履歴」セクションに直近 1 件サマリ + 件数表示
- [ ] 「すべての履歴を見る」ボタンで /history へ

- [ ] **Step 12: ブランチを main にマージ**

```bash
git checkout main
git pull
git merge feat/phase-a11-5-history --no-ff -m "Merge: Phase A.11.5 history + favorites + plan-based lock"
git push origin main
```

- [ ] **Step 13: 本番（Vercel）デプロイ確認**

`https://autobanner.jp/` で:
- [ ] 1 サイズ生成 → /history で確認
- [ ] /account の履歴セクション動作確認
- [ ] ヘッダー → 履歴リンク動作確認

- [ ] **Step 14: 完了タグ作成**

```bash
git tag phase-a11-5-stable
git push origin phase-a11-5-stable
```

これで Phase A.11.5 完了。

---

## 完了基準チェックリスト（spec §8 と同期）

- [ ] バナー生成成功時、自動的に履歴 (Generation) として保存される
- [ ] /history で一覧・詳細・削除・再生成・お気に入り操作ができる
- [ ] プラン別ロック表示（Free=10, Starter=30, Pro=∞）が正しく機能する
- [ ] ロック行クリックで Pro 訴求モーダル
- [ ] お気に入り画像があるセッションはロック対象外
- [ ] Pro+ で一括 ZIP DL 動作（クライアント完結）
- [ ] ヘッダードロップダウン + /account + Step 3 完成トーストの 3 経路から /history 到達可
- [ ] プラン変更（手動 DB 更新）→ /account 訪問で SessionSyncer 走行 → ロック判定が同期
- [ ] `npm run build` 通過、本番 Vercel で動作確認済み

すべて達成したら本 plan は完了。
