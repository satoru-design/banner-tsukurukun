# Phase A.11.3: 機能 gate + 使用回数表示 + クレジット可視化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ヘッダーに使用状況を `12/100 [12%]` 形式で常時表示し、上限到達時はフロント・API 両方で生成を gate する。生成成功後は `useSession().update()` で session を即時 merge してヘッダーカウンタをリアルタイム反映する。

**Architecture:** ① 新規 `UsageDisplay` (Client Component) を Header に挿入し useSession() で usageCount/Limit を表示。② `UsageLimitModal` を `layout/` 配下に新設し、上限到達時の UX を統一。③ `/api/ironclad-generate` 冒頭で DB から fresh count を取得して gate（lazy reset 考慮）、成功時は新 usageCount をレスポンスに含める。④ 生成クライアントで pre-check + 429 ハンドル + `update()` 呼出を追加。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Tailwind CSS / NextAuth.js v5 (`useSession`/`update`) / Prisma 7 / Neon Postgres

**Spec:** [docs/superpowers/specs/2026-04-27-usage-gate-design.md](../specs/2026-04-27-usage-gate-design.md)

**Test方針:** プロジェクトはテストフレームワーク未導入。各タスクは「TypeScript ビルド通過 + 段階手動確認」で検証。最終的に §6 全項目 PASS で main 反映（Phase A.11.0-A.11.2 と同じ方式）。

---

## ファイル構成マップ

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/components/layout/UsageDisplay.tsx` | ヘッダー右側、PlanPill 隣の使用状況表示（Client Component） |
| `src/components/layout/UsageLimitModal.tsx` | 上限到達時のモーダル（Client Component） |
| `src/lib/plans/usage-check.ts` | `isUsageLimitReached(user)` 等の DRY ヘルパー |

### 変更
| ファイル | 変更内容 |
|---|---|
| `src/components/layout/Header.tsx` | PlanPill の隣に UsageDisplay 配置 |
| `src/app/api/ironclad-generate/route.ts` | 冒頭で gate（429 返却）+ レスポンスに新 usageCount 含める |
| `src/components/ironclad/IroncladGenerateScreen.tsx` | pre-check + 429 ハンドル + `useSession().update()` 呼出 |

---

## Task 0: 安全措置（feature ブランチ作成）

**目的:** Phase A.11.2 完了状態を保護し、独立ブランチで開発開始。

**Files:**
- なし（git 操作のみ）

- [ ] **Step 1: 現在の git 状態確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
git log --oneline -5
```

期待: working tree clean / 最新コミットが `d251b15 docs: add Phase A.11.3 usage gate + credit visualization design spec`（または同等）

- [ ] **Step 2: feature ブランチ作成**

```bash
git checkout -b feat/phase-a11-3-usage-gate
git branch --show-current
```

期待: `feat/phase-a11-3-usage-gate`

---

## Task 1: usage-check ヘルパー作成

**設計方針**: pre-check（クライアント）と API gate（サーバ）で同じロジックを使うため、共通ヘルパーに切り出す。lazy reset 考慮も含める。

**Files:**
- Create: `src/lib/plans/usage-check.ts`

- [ ] **Step 1: usage-check.ts 作成**

```ts
/**
 * Phase A.11.3: 使用回数上限到達判定ヘルパー。
 *
 * クライアント (pre-check) と API gate の両方から呼ぶことで、判定ロジックを DRY 化。
 * lazy reset 考慮: usageResetAt を過ぎていれば 0 として扱う（生成許可）。
 */

interface UsageCheckInput {
  /** 現在の使用回数 */
  usageCount: number;
  /** 月次上限。Infinity（admin）の場合は常に false */
  usageLimit: number;
  /** リセット予定日時。null or 過去なら effectiveCount=0 として扱う */
  usageResetAt: Date | null;
}

/**
 * 効果的な使用回数（lazy reset 考慮）を返す。
 * usageResetAt が null または 過去なら 0、未来なら usageCount をそのまま返す。
 */
export function effectiveUsageCount(input: UsageCheckInput, now: Date = new Date()): number {
  if (!input.usageResetAt) return input.usageCount;
  if (now >= input.usageResetAt) return 0;
  return input.usageCount;
}

/**
 * 上限到達判定。admin (usageLimit=Infinity) は常に false。
 */
export function isUsageLimitReached(input: UsageCheckInput, now: Date = new Date()): boolean {
  if (!Number.isFinite(input.usageLimit)) return false;
  return effectiveUsageCount(input, now) >= input.usageLimit;
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/plans/usage-check.ts
git commit -m "feat(plans): add usage-check helper with lazy reset"
```

---

## Task 2: UsageDisplay コンポーネント作成

**Files:**
- Create: `src/components/layout/UsageDisplay.tsx`

- [ ] **Step 1: UsageDisplay.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.3: ヘッダー右側、PlanPill 隣に表示する使用状況コンポーネント。
 *
 * - useSession() で session を読み、sessionToCurrentUser で CurrentUser に変換
 * - admin / 無制限プランは表示なし（PlanPill だけで十分）
 * - 80%超で amber、100%で red の文字色変化（マイページのバーと色味統一）
 * - tabular-nums でカウントアップ時の見た目ガタつき防止
 */
import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';

export function UsageDisplay() {
  const { data: session } = useSession();
  const user = sessionToCurrentUser(session);

  // 未ログイン: 表示なし
  if (!user.userId) return null;

  // admin / 無制限: 表示なし
  if (!Number.isFinite(user.usageLimit)) return null;

  const ratio = user.usageCount / user.usageLimit;
  const percent = Math.round(ratio * 100);

  // 80%超で amber, 100%で red
  const colorClass =
    ratio >= 1
      ? 'text-red-400'
      : ratio >= 0.8
        ? 'text-amber-400'
        : 'text-slate-300';

  return (
    <span
      className={`text-xs ${colorClass} tabular-nums`}
      aria-label={`今月の使用状況: ${user.usageCount} 回 / ${user.usageLimit} 回 (${percent}%)`}
    >
      {user.usageCount}/{user.usageLimit} [{percent}%]
    </span>
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
git add src/components/layout/UsageDisplay.tsx
git commit -m "feat(layout): add UsageDisplay for header"
```

---

## Task 3: UsageLimitModal コンポーネント作成

**Files:**
- Create: `src/components/layout/UsageLimitModal.tsx`

- [ ] **Step 1: UsageLimitModal.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.3: 上限到達時に表示するモーダル。
 *
 * - 生成画面の pre-check ヒット時 / API 429 受信時に表示
 * - mailto でアップグレード相談を受け付け（A.12 Stripe 完成までの暫定）
 * - body スクロールロック + ESC で閉じる
 *
 * 構造は src/app/account/UpgradeModal.tsx と類似だが、コンテキストが違う
 * （あちらは「準備中」、こちらは「上限到達」）ため別コンポーネント化。
 */
import { useEffect } from 'react';

interface UsageLimitModalProps {
  open: boolean;
  onClose: () => void;
  usageCount: number;
  usageLimit: number;
  plan: string;
}

export function UsageLimitModal({
  open,
  onClose,
  usageCount,
  usageLimit,
  plan,
}: UsageLimitModalProps) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const subject = `[勝ちバナー作る君] アップグレード相談（${plan} → 上位プラン）`;
  const body =
    `現在のプラン: ${plan}\n` +
    `今月使用: ${usageCount}/${usageLimit}\n\n` +
    `アップグレードを希望します。`;
  const mailtoHref = `mailto:str.kk.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="usage-limit-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[min(90vw,460px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="usage-limit-title" className="text-lg font-bold mb-3">
          今月の生成回数上限に到達しました
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          現在の {plan} プランの月間上限（{usageLimit} 回）を使い切りました。
          来月 1 日にリセットされます。それまでに追加で生成したい場合は、
          <a
            href={mailtoHref}
            className="text-teal-400 underline mx-1 hover:text-teal-300"
          >
            アップグレードのご相談
          </a>
          をお送りください（Phase A.12 で Stripe Checkout に切替予定）。
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            閉じる
          </button>
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
git add src/components/layout/UsageLimitModal.tsx
git commit -m "feat(layout): add UsageLimitModal for limit-reached UX"
```

---

## Task 4: Header に UsageDisplay 統合

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Header.tsx 編集**

`src/components/layout/Header.tsx` の右側ブロックを以下に置換：

```tsx
'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { PlanPill } from './PlanPill';
import { UsageDisplay } from './UsageDisplay';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  rightSlot?: ReactNode;
}

export function Header({ rightSlot }: HeaderProps) {
  const { data: session } = useSession();
  const user = sessionToCurrentUser(session);

  return (
    <header className="border-b border-slate-800 px-6 py-4 sticky top-0 bg-neutral-950 z-40">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight whitespace-nowrap"
        >
          <span className="text-teal-400">勝ちバナー</span>作る君
        </Link>

        <div className="flex-1 flex justify-center min-w-0">{rightSlot}</div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <PlanPill plan={user.plan} />
            <UsageDisplay />
          </div>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: 開発サーバ起動 + 表示確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセス。確認項目:
- admin プラン: PlanPill のみ表示（UsageDisplay 非表示）
- prisma で自分の plan を `pro` に変更 + `usageCount=12` に設定 → リロード → `Pro 12/100 [12%]` 表示
- 確認後 plan を `admin` に戻す

- [ ] **Step 4: コミット**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(layout): integrate UsageDisplay into Header"
```

---

## Task 5: API gate 実装（/api/ironclad-generate）

**Files:**
- Modify: `src/app/api/ironclad-generate/route.ts`

- [ ] **Step 1: import 追加 + getCurrentUser を冒頭に移動**

`src/app/api/ironclad-generate/route.ts` の冒頭 import 群に `getPrisma` と `isUsageLimitReached`, `effectiveUsageCount` を追加：

```ts
import { NextResponse } from 'next/server';
import {
  buildIroncladImagePromptWithPrefix,
  SIZE_TO_API_IRONCLAD,
  type IroncladMaterials,
} from '@/lib/prompts/ironclad-banner';
import { generateWithFallback } from '@/lib/image-providers';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { incrementUsage } from '@/lib/plans/usage';
import { isUsageLimitReached, effectiveUsageCount } from '@/lib/plans/usage-check';
import { getPrisma } from '@/lib/prisma';
```

- [ ] **Step 2: POST 関数本体を置換**

`POST` 関数全体を以下に置換（既存ロジック + 上限 gate + レスポンス拡張）：

```ts
export async function POST(req: Request) {
  try {
    const materials = (await req.json()) as IroncladMaterials;

    // 最低限バリデーション
    if (!materials.product || !materials.target || !materials.purpose) {
      return NextResponse.json(
        { error: 'product, target, purpose are required' },
        { status: 400 },
      );
    }
    if (!Array.isArray(materials.copies) || materials.copies.length !== 4) {
      return NextResponse.json({ error: 'copies must be 4-tuple' }, { status: 400 });
    }
    if (!Array.isArray(materials.designRequirements) || materials.designRequirements.length !== 4) {
      return NextResponse.json(
        { error: 'designRequirements must be 4-tuple' },
        { status: 400 },
      );
    }

    const sizeMeta = SIZE_TO_API_IRONCLAD[materials.size];
    if (!sizeMeta) {
      return NextResponse.json({ error: `Unknown size: ${materials.size}` }, { status: 400 });
    }
    const aspectRatio = sizeMeta.aspectRatio;
    const apiSizeOverride = sizeMeta.apiSize;

    // Phase A.11.3: 上限チェック（fail-fast でコスト保護）
    // DB から fresh な count を取得（JWT は古い可能性あり）
    const currentUser = await getCurrentUser();
    if (currentUser.userId && Number.isFinite(currentUser.usageLimit)) {
      const prisma = getPrisma();
      const dbUser = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { usageCount: true, usageResetAt: true },
      });
      if (dbUser) {
        const effective = effectiveUsageCount({
          usageCount: dbUser.usageCount,
          usageLimit: currentUser.usageLimit,
          usageResetAt: dbUser.usageResetAt,
        });
        const reached = isUsageLimitReached({
          usageCount: dbUser.usageCount,
          usageLimit: currentUser.usageLimit,
          usageResetAt: dbUser.usageResetAt,
        });
        if (reached) {
          return NextResponse.json(
            {
              error: '今月の生成回数上限に到達しました',
              usageCount: effective,
              usageLimit: currentUser.usageLimit,
              limitReached: true,
            },
            { status: 429 },
          );
        }
      }
    }

    const finalPrompt = buildIroncladImagePromptWithPrefix(materials);

    // 参考画像URLを集約（商品画像・バッジ1・バッジ2）
    const referenceImageUrls = [
      materials.productImageUrl,
      materials.badgeImageUrl1,
      materials.badgeImageUrl2,
    ].filter((u): u is string => Boolean(u && u.trim()));

    const copyBundle = {
      mainCopy: materials.copies[0],
      subCopy: materials.copies[1],
      ctaText: materials.cta,
      primaryBadgeText: materials.copies[2],
      secondaryBadgeText: materials.copies[3],
    };

    const result = await generateWithFallback('gpt-image', {
      prompt: finalPrompt,
      aspectRatio,
      apiSizeOverride,
      referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      referenceMode: 'composite',
      copyBundle,
    });

    // Phase A.11.0: 生成成功時に使用回数カウントアップ
    // Phase A.11.3: 新 usageCount をレスポンスに含めてクライアント update() に渡す
    let newUsageCount: number | undefined;
    if (currentUser.userId) {
      try {
        await incrementUsage(currentUser.userId);
        const prisma = getPrisma();
        const updated = await prisma.user.findUnique({
          where: { id: currentUser.userId },
          select: { usageCount: true },
        });
        newUsageCount = updated?.usageCount;
      } catch (err) {
        console.error('incrementUsage failed:', err);
      }
    }

    return NextResponse.json({
      imageUrl: result.base64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
      promptPreview: finalPrompt,
      usageCount: newUsageCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('ironclad-generate error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/app/api/ironclad-generate/route.ts
git commit -m "feat(api): add usage limit gate + usageCount in response"
```

---

## Task 6: 生成クライアントに pre-check + 429 ハンドル + update()

**Files:**
- Modify: `src/components/ironclad/IroncladGenerateScreen.tsx`

- [ ] **Step 1: import + state 追加**

`src/components/ironclad/IroncladGenerateScreen.tsx` の冒頭 import 群に追加：

```tsx
import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { isUsageLimitReached } from '@/lib/plans/usage-check';
import { UsageLimitModal } from '@/components/layout/UsageLimitModal';
```

- [ ] **Step 2: コンポーネント本体に session + Modal state を追加**

`export function IroncladGenerateScreen({...}: Props)` の冒頭付近、既存 `useState` 群の隣に追加：

```tsx
export function IroncladGenerateScreen({ baseMaterials, sizes, onBack }: Props) {
  const { data: session, update: updateSession } = useSession();
  const user = sessionToCurrentUser(session);
  const [usageLimitModalOpen, setUsageLimitModalOpen] = useState(false);

  const [results, setResults] = useState<SizeResult[]>(
    sizes.map((size) => ({ size, status: 'idle' })),
  );
  const [overallGenerating, setOverallGenerating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // ... 既存ロジック続く ...
}
```

- [ ] **Step 3: generateOne に pre-check + 429 ハンドル + update() 追加**

既存の `generateOne` 関数を以下に置換：

```tsx
  const generateOne = async (size: IroncladSize): Promise<void> => {
    // Phase A.11.3: 生成前 pre-check
    if (
      user.userId &&
      isUsageLimitReached({
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
        usageResetAt: user.usageResetAt,
      })
    ) {
      setUsageLimitModalOpen(true);
      return;
    }

    updateResult(size, { status: 'generating', errorMessage: undefined });
    const materials: IroncladMaterials = { ...baseMaterials, size };

    // Phase A.11.2 hotfix: クライアント側タイムアウト 320s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 320 * 1000);

    try {
      const res = await fetch('/api/ironclad-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materials),
        signal: controller.signal,
      });

      // Phase A.11.3: 429 = 上限到達（API gate）→ Modal 表示して return
      if (res.status === 429) {
        setUsageLimitModalOpen(true);
        updateResult(size, { status: 'idle' });
        return;
      }

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          errMsg = j?.error || errMsg;
        } catch {
          if (res.status === 504) {
            errMsg = '生成がタイムアウトしました（5分超過）。もう一度お試しください';
          }
        }
        throw new Error(errMsg);
      }

      const json = await res.json();
      updateResult(size, {
        status: 'success',
        imageUrl: json.imageUrl,
        promptPreview: json.promptPreview,
        metadata: json.metadata,
      });

      // Phase A.11.3: ヘッダーカウンタ即時反映
      if (typeof json.usageCount === 'number') {
        await updateSession({ usageCount: json.usageCount });
      }
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      const errorMessage = isAbort
        ? '生成がタイムアウトしました（5分20秒経過）。もう一度お試しください'
        : e instanceof Error
          ? e.message
          : String(e);
      updateResult(size, {
        status: 'error',
        errorMessage,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };
```

- [ ] **Step 4: JSX に UsageLimitModal を追加**

`IroncladGenerateScreen` の `return (...)` の最後（最外 `</div>` の直前）に追加：

```tsx
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ... 既存 JSX 全部そのまま ... */}

      {/* Phase A.11.3: 上限到達モーダル */}
      <UsageLimitModal
        open={usageLimitModalOpen}
        onClose={() => setUsageLimitModalOpen(false)}
        usageCount={user.usageCount}
        usageLimit={user.usageLimit}
        plan={user.plan}
      />
    </div>
  );
}
```

**注意**: `</div>` を 1 つ追加してしまわないよう、既存の最外 `</div>` の **内側** に Modal を置く。

- [ ] **Step 5: TypeScript ビルド確認**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/components/ironclad/IroncladGenerateScreen.tsx
git commit -m "feat(ironclad): add pre-check + 429 handler + session update on success"
```

---

## Task 7: 統合検証 + main マージ

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

- [ ] **Step 3: ヘッダー表示の検証**

ログイン状態（admin）で `http://localhost:3000` にアクセス：
- [ ] PlanPill の隣に UsageDisplay が**表示されない**（admin は無制限）

prisma studio などで自分の plan を `pro`、`usageCount` を 12 に変更：

```bash
node --env-file=.env scripts/verify-a11-users.mjs
```

ブラウザリロード →
- [ ] ヘッダーに `Pro 12/100 [12%]` が表示される
- [ ] 文字色: slate（80%未満なので通常色）

`usageCount` を 85 に変更 → リロード →
- [ ] ヘッダーが amber 色 `85/100 [85%]`

`usageCount` を 100 に変更 → リロード →
- [ ] ヘッダーが red 色 `100/100 [100%]`

- [ ] **Step 4: 上限到達 pre-check の検証**

`usageCount=100`, `plan=pro` 状態で：
- [ ] Step 1 → 2 → 3 へ進む
- [ ] Step 3 で生成ボタン押下 → **API は呼ばれず**（DevTools Network で `/api/ironclad-generate` リクエストが発生していないことを確認）
- [ ] UsageLimitModal が表示される
- [ ] モーダルに「Pro プランの月間上限（100 回）を使い切りました」表示
- [ ] mailto リンクが正しい subject/body
- [ ] 閉じるボタン / 背景クリック / ESC で閉じる

- [ ] **Step 5: API gate（429）の検証**

`usageCount=99`, `plan=pro` 状態で（クライアント pre-check は通る）：

ブラウザ DevTools コンソールで session を改ざんして pre-check を回避：

```js
// DevTools Console
// 強制的に session.user.usageCount を 0 に書換え（pre-check 回避用）
// ただし NextAuth の session は immutable なので直接書換えは難しい。
// 代替: usageCount を一時的に 99 にしておけば pre-check は通る (99 < 100)
// この状態で生成ボタン → API 側で 429 が返るか確認
```

実用的には DB を `usageCount=100` にしてから session のみ古い値（例: 99）の状態を再現する。

簡易テスト方法:
1. DB で `usageCount=99` にしてセッション開始
2. 別タブで DB を `usageCount=100` に更新（このタブのセッションは 99 のまま）
3. このタブで生成ボタン押下 → pre-check は 99 < 100 で通過 → API 呼出 → API gate で 429 → Modal 表示

- [ ] DevTools Network で `/api/ironclad-generate` が status 429 を返している
- [ ] レスポンス body: `{ error: '今月の生成回数上限に到達しました', usageCount: 100, usageLimit: 100, limitReached: true }`
- [ ] UsageLimitModal が表示される

検証後、`usageCount` を 0 に戻す。

- [ ] **Step 6: 生成成功時の即時反映の検証**

`plan=pro`, `usageCount=12` 状態で：
- [ ] Step 1 → 2 → 3 で 1 サイズ生成
- [ ] 生成完了直後（ページリロードなし）にヘッダーカウンタが `12/100 [12%]` → `13/100 [13%]` に**即更新**される
- [ ] 引き続き別サイズも生成 → `14/100 [14%]` に更新

- [ ] **Step 7: /account との同期検証**

`usageCount=14` 状態で `/account` に遷移：
- [ ] PlanSection のプログレスバーが `14/100` で表示される
- [ ] ヘッダーの `14/100 [14%]` と一致

- [ ] **Step 8: lazy reset の検証**

prisma で `usageResetAt` を昨日の日時に書換 + `usageCount=100` に設定：

ブラウザリロード →
- [ ] ヘッダーは `100/100 [100%]` 表示（session の usageCount は古い）
- [ ] Step 3 で生成ボタン押下 → API gate が effectiveUsageCount=0 と判定して通過
- [ ] 生成成功 → DB の usageCount=1, usageResetAt=翌月 1 日 にリセット
- [ ] ヘッダーが `1/100 [1%]` に更新

検証後、`usageCount=0`, `usageResetAt=null`, `plan=admin` に戻す。

- [ ] **Step 9: スマホ幅表示の検証**

DevTools でビューポート 375px に切替 → admin 状態で：
- [ ] ヘッダー右側が崩れない（PlanPill + UserMenu のみ）

prisma で plan を `pro`, `usageCount=12` に変更 → リロード →
- [ ] ヘッダーに `Pro 12/100 [12%]` が表示される（折り返しせず）

検証後、admin に戻す。

- [ ] **Step 10: ブランチを main にマージ**

```bash
git checkout main
git pull
git merge feat/phase-a11-3-usage-gate --no-ff -m "Merge: Phase A.11.3 usage gate + credit visualization"
git push origin main
```

- [ ] **Step 11: 本番（Vercel）デプロイ確認**

`https://autobanner.jp/` にアクセス → admin 状態でヘッダー表示確認 → 1 回バナー生成して即時反映確認。

- [ ] **Step 12: 完了タグ作成**

```bash
git tag phase-a11-3-stable
git push origin phase-a11-3-stable
```

これで Phase A.11.3 完了。

---

## 完了基準チェックリスト（spec §8 と同期）

- [ ] ヘッダーで使用状況が `12/100 [12%]` 形式で常時表示される（admin 除く）
- [ ] 上限到達時、フロント・API 両方で生成が gate される
- [ ] 生成成功後、ヘッダーと /account のカウンタが即時更新される
- [ ] Phase A.12（Stripe）着手時に追加実装不要（plan 変更で usageLimit 自動連動）
- [ ] `npm run build` エラーなく通り、本番 Vercel で動作確認済み

すべて達成したら本 plan は完了。
