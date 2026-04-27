# Phase A.11.0-A.11.2: アカウント基盤 + ヘッダー + マイページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User schema を拡張して plan 関連カラム + 使用回数を持たせ、共有 Header コンポーネントと `/account` マイアカウントページを新設する。Phase A.12（Stripe）の前準備として認証・課金基盤の UI 表面を完成させる。

**Architecture:** 3 段階で順次マージ。①A.11.0 で User schema + Session callback + usage helper を導入（UI変化なし）、②A.11.1 で共有 Header + PlanPill + UserMenu を新設し既存 ironclad ページに導入、③A.11.2 で `/account` ルートを新設してプロフィール編集・プラン情報・セキュリティ機能を実装。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript / Tailwind CSS / Prisma 7 / NextAuth.js v5 / @base-ui/react / lucide-react / Neon Postgres

**Spec:** [docs/superpowers/specs/2026-04-27-account-ui-design.md](../specs/2026-04-27-account-ui-design.md)

**Test方針:** プロジェクトはテストフレームワーク未導入。各タスクは「TypeScript ビルド通過 + 段階手動確認」で検証。最終的に §6 全項目PASS で本番反映（Phase A.10 と同じ方式）。

---

## ファイル構成マップ

### 新規作成
| ファイル | 役割 | フェーズ |
|---|---|---|
| `prisma/migrations/<timestamp>_phase_a11_0_user_extensions/migration.sql` | User テーブル拡張 + 既存ユーザー初期値埋込 | A.11.0 |
| `src/lib/plans/limits.ts` | プラン → 使用回数上限のマッピング | A.11.0 |
| `src/lib/plans/usage.ts` | `incrementUsage` ヘルパー（lazy reset 込み） | A.11.0 |
| `src/components/layout/Header.tsx` | 共有 Header（Server Component） | A.11.1 |
| `src/components/layout/PlanPill.tsx` | プラン Pill 単体 | A.11.1 |
| `src/components/layout/UserMenu.tsx` | アバター + ドロップダウン（Client Component） | A.11.1 |
| `src/app/account/page.tsx` | マイアカウント本体（Server Component） | A.11.2 |
| `src/app/account/ProfileSection.tsx` | プロフィール編集（Client Component） | A.11.2 |
| `src/app/account/PlanSection.tsx` | プラン情報＋使用状況 | A.11.2 |
| `src/app/account/SecuritySection.tsx` | サインアウト + 削除依頼 | A.11.2 |
| `src/app/account/UpgradeModal.tsx` | 「準備中」モーダル（Client Component） | A.11.2 |
| `src/app/api/account/name/route.ts` | PUT: nameOverride 更新 API | A.11.2 |

### 変更
| ファイル | 変更内容 | フェーズ |
|---|---|---|
| `prisma/schema.prisma` | User モデルにカラム追加 | A.11.0 |
| `src/types/next-auth.d.ts` | Session 型拡張（追加フィールド） | A.11.0 |
| `src/lib/auth/auth.ts` | jwt / session callback 拡張 | A.11.0 |
| `src/lib/auth/get-current-user.ts` | CurrentUser インターフェース拡張 | A.11.0 |
| `src/app/api/ironclad-generate/route.ts` | 成功時 `incrementUsage` 呼出追加 | A.11.0 |
| `src/app/page.tsx` | 既存ヘッダー部分を共有 Header に置換 | A.11.1 |

---

## Task 0: 安全措置（git tag + ブランチ作成）

**目的:** Phase A.10 完了状態を保護タグで残し、独立ブランチで開発開始。

**Files:**
- なし（git 操作のみ）

- [ ] **Step 1: 現在の git 状態確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
git log --oneline -3
```

期待: working tree clean / 最新コミットが `2e9d7eb docs: add Phase A.11.0-A.11.2 account UI design spec`（または同等）

- [ ] **Step 2: phase-a10-stable タグ作成 + push**

```bash
git tag phase-a10-stable
git push origin phase-a10-stable
```

期待: タグ作成成功・GitHub 上にも push 完了

- [ ] **Step 3: feature ブランチ作成**

```bash
git checkout -b feat/phase-a11-account-ui
git branch --show-current
```

期待: `feat/phase-a11-account-ui`

---

# Phase A.11.0: DB Schema + Session 拡張

## Task 1: prisma/schema.prisma 拡張

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: User モデルにカラム追加**

`prisma/schema.prisma` の User モデル全体を以下に置換（既存フィールドは維持しつつ追加）：

```prisma
/// Phase A.10: NextAuth.js v5 + admin/plan 区別の基盤
/// Phase A.11.0: nameOverride / planStartedAt / planExpiresAt / stripe* / usageCount / usageResetAt 追加
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?

  /// Phase A.10: 'free' | 'starter' | 'pro' | 'admin'
  /// Phase A.11+ で機能 gate のキーとして使用
  plan          String    @default("free")

  /// Phase A.11.0: ユーザー編集後の表示名（NULL なら name を使う）
  nameOverride          String?
  /// Phase A.11.0: 現在プラン開始日（既存ユーザーは migration で createdAt をセット）
  planStartedAt         DateTime?
  /// Phase A.11.0: 有料プラン期限（free/admin は NULL）
  planExpiresAt         DateTime?
  /// Phase A.11.0: Stripe Customer ID（A.12 で使用、今は NULL）
  stripeCustomerId      String?  @unique
  /// Phase A.11.0: Stripe Subscription ID（A.12 で使用、今は NULL）
  stripeSubscriptionId  String?  @unique
  /// Phase A.11.0: 当月使用回数（lazy reset）
  usageCount            Int       @default(0)
  /// Phase A.11.0: 次回リセット日時（NULL なら初回アクセス時にセット）
  usageResetAt          DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  assets        Asset[]

  @@index([stripeCustomerId])
}
```

- [ ] **Step 2: migration 生成**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
pnpm prisma migrate dev --name phase_a11_0_user_extensions --create-only
```

期待: `prisma/migrations/<timestamp>_phase_a11_0_user_extensions/migration.sql` が作成され、`ALTER TABLE "User" ADD COLUMN ...` が並ぶ

- [ ] **Step 3: migration.sql に既存ユーザー初期値埋込 SQL 追記**

生成された migration.sql の末尾に以下を追記：

```sql
-- Phase A.11.0: 既存ユーザーの planStartedAt を createdAt で初期化
UPDATE "User" SET "planStartedAt" = "createdAt" WHERE "planStartedAt" IS NULL;
```

- [ ] **Step 4: migration 適用**

```bash
pnpm prisma migrate dev
```

期待: migration が適用され、既存ユーザーの `planStartedAt` が `createdAt` で埋まる

- [ ] **Step 5: DB 直接確認**

```bash
pnpm prisma studio
```

ブラウザで User テーブルを開き、新カラム（`nameOverride`, `planStartedAt`, `planExpiresAt`, `stripeCustomerId`, `stripeSubscriptionId`, `usageCount`, `usageResetAt`）が存在し、既存ユーザーの `planStartedAt` が NULL でないことを確認。

- [ ] **Step 6: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Phase A.11.0 User extensions (plan dates + usage + stripe ids)"
```

---

## Task 2: NextAuth 型拡張

**Files:**
- Modify: `src/types/next-auth.d.ts`

- [ ] **Step 1: Session 型に新フィールド追加**

`src/types/next-auth.d.ts` を以下に置換：

```ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Phase A.10: session.user に id と plan を追加。
   * Phase A.11.0: nameOverride / planStartedAt / planExpiresAt / usageCount / usageResetAt 追加。
   */
  interface Session {
    user: {
      id: string;
      plan: string;
      nameOverride: string | null;
      planStartedAt: string | null;  // Date は serializable でない → ISO string で保持
      planExpiresAt: string | null;
      usageCount: number;
      usageResetAt: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    plan?: string;
    nameOverride?: string | null;
    planStartedAt?: Date | null;
    planExpiresAt?: Date | null;
    usageCount?: number;
    usageResetAt?: Date | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    plan?: string;
    nameOverride?: string | null;
    planStartedAt?: string | null;
    planExpiresAt?: string | null;
    usageCount?: number;
    usageResetAt?: string | null;
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
pnpm prisma generate
pnpm tsc --noEmit
```

期待: エラーなし（この時点では auth.ts が新フィールドを参照していないが、型宣言は通る）

- [ ] **Step 3: コミット**

```bash
git add src/types/next-auth.d.ts
git commit -m "feat(types): extend NextAuth Session/JWT for Phase A.11.0 fields"
```

---

## Task 3: auth.ts callback 拡張

**Files:**
- Modify: `src/lib/auth/auth.ts`

- [ ] **Step 1: jwt callback に新フィールド読込追加**

`src/lib/auth/auth.ts` の `jwt` callback を以下に置換（既存の admin 判定は維持）：

```ts
async jwt({ token, user, trigger }) {
  // 初回 signIn 時: user オブジェクトから id を取得 + admin 判定
  if (user) {
    token.id = user.id;
    // ADMIN_EMAILS のメアドなら token.plan='admin' を即時反映
    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isAdmin = !!user.email && adminEmails.includes(user.email);
    token.plan = isAdmin ? 'admin' : ((user as { plan?: string }).plan ?? 'free');
    // Phase A.11.0: 新フィールドも JWT に載せる
    const u = user as {
      nameOverride?: string | null;
      planStartedAt?: Date | null;
      planExpiresAt?: Date | null;
      usageCount?: number;
      usageResetAt?: Date | null;
    };
    token.nameOverride = u.nameOverride ?? null;
    token.planStartedAt = u.planStartedAt ? u.planStartedAt.toISOString() : null;
    token.planExpiresAt = u.planExpiresAt ? u.planExpiresAt.toISOString() : null;
    token.usageCount = u.usageCount ?? 0;
    token.usageResetAt = u.usageResetAt ? u.usageResetAt.toISOString() : null;
  } else if (trigger === 'update' && token.email) {
    // 明示的 update（プラン変更直後など）の時だけ DB から再取得
    const dbUser = await prisma.user.findUnique({
      where: { email: token.email as string },
    });
    if (dbUser) {
      token.plan = dbUser.plan;
      token.nameOverride = dbUser.nameOverride;
      token.planStartedAt = dbUser.planStartedAt ? dbUser.planStartedAt.toISOString() : null;
      token.planExpiresAt = dbUser.planExpiresAt ? dbUser.planExpiresAt.toISOString() : null;
      token.usageCount = dbUser.usageCount;
      token.usageResetAt = dbUser.usageResetAt ? dbUser.usageResetAt.toISOString() : null;
    }
  }
  return token;
}
```

- [ ] **Step 2: session callback に新フィールド注入追加**

同ファイルの `session` callback を以下に置換：

```ts
async session({ session, token }) {
  if (session.user && token) {
    session.user.id = (token.id as string) ?? '';
    session.user.plan = (token.plan as string) ?? 'free';
    // Phase A.11.0: 新フィールドも session に載せる
    session.user.nameOverride = (token.nameOverride as string | null) ?? null;
    session.user.planStartedAt = (token.planStartedAt as string | null) ?? null;
    session.user.planExpiresAt = (token.planExpiresAt as string | null) ?? null;
    session.user.usageCount = (token.usageCount as number) ?? 0;
    session.user.usageResetAt = (token.usageResetAt as string | null) ?? null;
  }
  return session;
}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/lib/auth/auth.ts
git commit -m "feat(auth): extend jwt/session callbacks with Phase A.11.0 fields"
```

---

## Task 4: プラン制限マッピング作成

**Files:**
- Create: `src/lib/plans/limits.ts`

- [ ] **Step 1: limits.ts 作成**

```ts
/**
 * Phase A.11.0: プラン → 月次使用回数上限のマッピング。
 * 事業計画 v2 §2.1 のプラン構成に基づく。
 *
 * - free: 3 回（生涯ではなく月次。3回限定の挙動は Phase A.14 でグレーアウト実装）
 * - starter: 30 回/月
 * - pro: 100 回/月（超過は Phase A.14 でメータード課金）
 * - admin: 無制限（Number.POSITIVE_INFINITY）
 *
 * 不明な plan 値が来た場合は free 値にフォールバック。
 */
export const PLAN_USAGE_LIMITS: Record<string, number> = {
  free: 3,
  starter: 30,
  pro: 100,
  admin: Number.POSITIVE_INFINITY,
};

export function getUsageLimit(plan: string): number {
  return PLAN_USAGE_LIMITS[plan] ?? PLAN_USAGE_LIMITS.free;
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/plans/limits.ts
git commit -m "feat(plans): add plan usage limit mapping"
```

---

## Task 5: usage.ts ヘルパー作成

**Files:**
- Create: `src/lib/plans/usage.ts`

- [ ] **Step 1: usage.ts 作成**

```ts
/**
 * Phase A.11.0: 使用回数カウントアップ + lazy reset。
 * cron 不要：月をまたいだ最初のアクセス時に自動的にリセット & 次月の reset 日時をセット。
 *
 * 使用箇所: /api/ironclad-generate の成功パス末尾
 */
import { getPrisma } from '@/lib/prisma';

const prisma = getPrisma();

/**
 * 渡した日時の翌月 1 日 00:00:00（local TZ）を返す。
 * usageResetAt の次回値として使う。
 */
export function nextMonthStart(now: Date): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * userId の usageCount を +1 する。usageResetAt を過ぎていれば 1 にリセット。
 * usageResetAt が NULL の場合は次月開始日時をセット。
 *
 * Prisma の `{ increment: 1 }` はトランザクション保証あり、複数同時呼出でも整合。
 */
export async function incrementUsage(userId: string): Promise<void> {
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  if (user.usageResetAt && now >= user.usageResetAt) {
    // 期限切れ: リセットして今回分を 1 にセット
    await prisma.user.update({
      where: { id: userId },
      data: {
        usageCount: 1,
        usageResetAt: nextMonthStart(now),
      },
    });
  } else {
    // 通常: increment（usageResetAt が NULL なら同時にセット）
    await prisma.user.update({
      where: { id: userId },
      data: {
        usageCount: { increment: 1 },
        ...(user.usageResetAt ? {} : { usageResetAt: nextMonthStart(now) }),
      },
    });
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/plans/usage.ts
git commit -m "feat(plans): add incrementUsage helper with lazy reset"
```

---

## Task 6: getCurrentUser 拡張 + sessionToCurrentUser ヘルパー作成

**設計方針**: derive ロジック（session → CurrentUser）を `sessionToCurrentUser` ヘルパーに集約。これにより Server 側 `getCurrentUser()` と Client 側（A.11.1 で実装する Header）の両方で同じ変換を使える。

**Files:**
- Create: `src/lib/auth/session-to-current-user.ts`
- Modify: `src/lib/auth/get-current-user.ts`

- [ ] **Step 1: get-current-user.ts に CurrentUser インターフェース定義 + 関数を置換**

`src/lib/auth/get-current-user.ts` 全体を以下に置換：

```ts
import { auth } from './auth';
import { sessionToCurrentUser } from './session-to-current-user';

/**
 * Phase A.10: NextAuth.js v5 セッションから現在のユーザーを取得（Server 用）。
 * Phase A.11.0: 拡張フィールド（displayName / planDates / usage）追加。
 *
 * Server Components / Route Handlers / Server Actions から呼ぶ。
 * derive ロジックは sessionToCurrentUser に集約（Client 側 Header でも同じ変換を使う）。
 */
export interface CurrentUser {
  /** ログイン済の Prisma User.id。未ログイン時は null。 */
  userId: string | null;
  /** ログイン済の email。未ログイン時は null。 */
  email: string | null;
  /** 'free' | 'starter' | 'pro' | 'admin' */
  plan: string;
  /** 表示名（nameOverride ?? name ?? "ユーザー"） */
  displayName: string;
  /** Google アバター URL */
  image: string | null;
  /** 現在プラン開始日 */
  planStartedAt: Date | null;
  /** 有料プラン期限（free/admin は null） */
  planExpiresAt: Date | null;
  /** 当月使用回数 */
  usageCount: number;
  /** プランから導出される月次上限（admin は Infinity） */
  usageLimit: number;
  /** 次回リセット日時 */
  usageResetAt: Date | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  return sessionToCurrentUser(session);
}
```

- [ ] **Step 2: session-to-current-user.ts ヘルパー作成**

`src/lib/auth/session-to-current-user.ts`:

```ts
import type { Session } from 'next-auth';
import type { CurrentUser } from './get-current-user';
import { getUsageLimit } from '@/lib/plans/limits';

/**
 * Phase A.11.0: NextAuth Session を CurrentUser に変換するヘルパー。
 * Server side: getCurrentUser() で auth() の結果を渡す。
 * Client side（A.11.1 Header 等）: useSession() の data を渡す。
 *
 * 両方で同じ derive ロジックを使うことで、Header を Client/Server 両用に統一できる。
 */
export function sessionToCurrentUser(session: Session | null): CurrentUser {
  if (!session?.user?.id) {
    return {
      userId: null,
      email: null,
      plan: 'free',
      displayName: 'ゲスト',
      image: null,
      planStartedAt: null,
      planExpiresAt: null,
      usageCount: 0,
      usageLimit: getUsageLimit('free'),
      usageResetAt: null,
    };
  }
  const u = session.user;
  const plan = u.plan ?? 'free';
  return {
    userId: u.id,
    email: u.email ?? null,
    plan,
    displayName: u.nameOverride ?? u.name ?? 'ユーザー',
    image: u.image ?? null,
    planStartedAt: u.planStartedAt ? new Date(u.planStartedAt) : null,
    planExpiresAt: u.planExpiresAt ? new Date(u.planExpiresAt) : null,
    usageCount: u.usageCount ?? 0,
    usageLimit: getUsageLimit(plan),
    usageResetAt: u.usageResetAt ? new Date(u.usageResetAt) : null,
  };
}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: 既存呼出箇所への影響確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
grep -rn "getCurrentUser" src --include="*.ts" --include="*.tsx"
```

期待: 既存呼出箇所で `userId` / `email` / `plan` の使い方は変わっていないので破壊的変更なし（追加プロパティが返るだけ）。

- [ ] **Step 5: コミット**

```bash
git add src/lib/auth/session-to-current-user.ts src/lib/auth/get-current-user.ts
git commit -m "feat(auth): extend CurrentUser + extract sessionToCurrentUser helper"
```

---

## Task 7: /api/ironclad-generate に usage 組込

**Files:**
- Modify: `src/app/api/ironclad-generate/route.ts`

- [ ] **Step 1: import 追加**

`src/app/api/ironclad-generate/route.ts` の冒頭 import 群に追加：

```ts
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { incrementUsage } from '@/lib/plans/usage';
```

- [ ] **Step 2: 成功レスポンス直前に incrementUsage 呼出追加**

`return NextResponse.json({...})` の直前（69 行目付近）に追加：

```ts
// Phase A.11.0: 生成成功時に使用回数カウントアップ（失敗時はカウントしない）
const currentUser = await getCurrentUser();
if (currentUser.userId) {
  // ベストエフォート（失敗してもユーザー体験を壊さない）
  await incrementUsage(currentUser.userId).catch((err) => {
    console.error('incrementUsage failed:', err);
  });
}

return NextResponse.json({
  imageUrl: result.base64,
  // ... 以下既存
});
```

完成後の該当部分は以下のような形：

```ts
const result = await generateWithFallback('gpt-image', { /* ... */ });

// Phase A.11.0: 生成成功時に使用回数カウントアップ
const currentUser = await getCurrentUser();
if (currentUser.userId) {
  await incrementUsage(currentUser.userId).catch((err) => {
    console.error('incrementUsage failed:', err);
  });
}

return NextResponse.json({
  imageUrl: result.base64,
  provider: result.providerId,
  fallback: result.providerMetadata.fallback === true,
  metadata: result.providerMetadata,
  promptPreview: finalPrompt,
});
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/app/api/ironclad-generate/route.ts
git commit -m "feat(api): wire incrementUsage into ironclad-generate success path"
```

---

## Task 8: Phase A.11.0 手動検証 + main マージ

**Files:**
- なし（検証 + git 操作のみ）

- [ ] **Step 1: フルビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
pnpm build
```

期待: ビルド成功（`✓ Compiled successfully`）

- [ ] **Step 2: 開発サーバ起動 + admin ログインで動作確認**

```bash
pnpm dev
```

ブラウザで `http://localhost:3000` にアクセス → Google でログイン（`str.kk.co@gmail.com`）。

- [ ] **Step 3: prisma studio で User row 確認**

別ターミナルで:

```bash
pnpm prisma studio
```

ブラウザで User テーブルを開き、自分の row が以下を満たすことを確認：
- `plan = 'admin'`
- `planStartedAt` が NULL でない
- `nameOverride` は NULL（未編集）
- `usageCount = 0`
- `usageResetAt` は NULL（まだ生成していない）

- [ ] **Step 4: 1回バナー生成 → usageCount 増加確認**

ironclad ページから 1 回バナー生成（Step 1 → 2 → 3 → 生成完了まで通す）。

その後 prisma studio で再確認：
- `usageCount = 1`
- `usageResetAt` が翌月 1 日 00:00:00 にセットされている

- [ ] **Step 5: lazy reset 動作確認（手動）**

prisma studio で自分の `usageResetAt` を「昨日の日時」に手動編集 → 保存。

ironclad ページからもう 1 回バナー生成。

prisma studio で再確認：
- `usageCount = 1`（リセットされた後の +1）
- `usageResetAt` が再び翌月 1 日 00:00:00 にセットされている

- [ ] **Step 6: ブランチを main にマージ**

```bash
git checkout main
git pull
git merge feat/phase-a11-account-ui --no-ff -m "Merge: Phase A.11.0 DB schema + session + usage helper"
git push origin main
```

- [ ] **Step 7: 本番（Vercel）デプロイ確認**

Vercel の自動デプロイが完了するのを待ち（GitHub push trigger）、`https://autobanner.jp/` にアクセスして本番環境でログイン → 1 回バナー生成 → Neon コンソールで User row の `usageCount = 1` 確認。

- [ ] **Step 8: feature ブランチに戻って次フェーズ準備**

```bash
git checkout feat/phase-a11-account-ui
git merge main  # main の最新を取り込み
```

---

# Phase A.11.1: 共有 Header コンポーネント

## Task 9: PlanPill コンポーネント作成

**Files:**
- Create: `src/components/layout/PlanPill.tsx`

- [ ] **Step 1: PlanPill.tsx 作成**

```tsx
/**
 * Phase A.11.1: プラン表示用の Pill コンポーネント。
 * Header と マイページの両方で再利用する。
 *
 * 不明な plan 値は free 表示にフォールバック（DB 異常値防御）。
 */
import { ReactElement } from 'react';

const PLAN_STYLES: Record<string, { label: string; className: string }> = {
  free: {
    label: 'Free',
    className: 'bg-slate-700 text-slate-200',
  },
  starter: {
    label: 'Starter',
    className: 'bg-teal-600 text-white',
  },
  pro: {
    label: 'Pro',
    className: 'bg-amber-500 text-amber-950',
  },
  admin: {
    label: 'Admin',
    className: 'bg-purple-600 text-white',
  },
};

interface PlanPillProps {
  plan: string;
  /** size variant. デフォルト xs（ヘッダー用）。マイページ用に sm を使う */
  size?: 'xs' | 'sm';
}

export function PlanPill({ plan, size = 'xs' }: PlanPillProps): ReactElement {
  const style = PLAN_STYLES[plan] ?? PLAN_STYLES.free;
  const sizeClass = size === 'sm' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`${sizeClass} rounded-full font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/layout/PlanPill.tsx
git commit -m "feat(layout): add PlanPill component"
```

---

## Task 10: UserMenu コンポーネント作成

**Files:**
- Create: `src/components/layout/UserMenu.tsx`

- [ ] **Step 1: UserMenu.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.1: アバター + ドロップダウンメニュー。
 *
 * - ログイン時: アバター画像クリックでドロップダウン展開
 *   - 表示名 / メール / プラン Pill
 *   - マイアカウント / プラン変更 / サインアウト
 * - 未ログイン時: グレーの人型アイコン（クリックで /signin 直行）
 *
 * アバターは <img> を使用（next/image は使わない、remotePatterns 不要のため）。
 * 画像 fetch 失敗時は lucide-react の <UserCircle /> にフォールバック。
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { UserCircle, User, CreditCard, LogOut } from 'lucide-react';
import { PlanPill } from './PlanPill';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface UserMenuProps {
  user: CurrentUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handle);
      return () => document.removeEventListener('mousedown', handle);
    }
  }, [open]);

  // ESC で閉じる
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handle);
      return () => document.removeEventListener('keydown', handle);
    }
  }, [open]);

  // 未ログイン: グレーアバター → /signin 直行
  if (!user.userId) {
    return (
      <Link
        href="/signin"
        aria-label="ログイン"
        className="text-slate-500 hover:text-slate-300 transition"
      >
        <UserCircle className="w-7 h-7" />
      </Link>
    );
  }

  // ログイン済: アバター + ドロップダウン
  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="アカウントメニュー"
        className="block rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {user.image && !imgError ? (
          <img
            src={user.image}
            alt={user.displayName}
            width={28}
            height={28}
            className="rounded-full"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <UserCircle className="w-7 h-7 text-slate-400" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-700 bg-neutral-900 shadow-xl py-1 z-50"
        >
          {/* ヘッダー部 */}
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="font-semibold text-white truncate">
              {user.displayName}
            </div>
            <div className="text-xs text-slate-400 truncate">{user.email}</div>
            <div className="mt-2">
              <PlanPill plan={user.plan} />
            </div>
          </div>

          {/* リンク群 */}
          <Link
            href="/account"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            onClick={() => setOpen(false)}
          >
            <User className="w-4 h-4" />
            マイアカウント
          </Link>
          <Link
            href="/account#plan"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            onClick={() => setOpen(false)}
          >
            <CreditCard className="w-4 h-4" />
            プラン変更
          </Link>

          {/* サインアウト */}
          <div className="border-t border-slate-800 mt-1 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut({ callbackUrl: '/signin' });
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
              サインアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: lucide-react import 確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
grep -A 3 '"lucide-react"' package.json
```

期待: lucide-react が依存に存在（既に入っている）。`User`, `CreditCard`, `LogOut`, `UserCircle` icon を使用。

- [ ] **Step 3: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/layout/UserMenu.tsx
git commit -m "feat(layout): add UserMenu with avatar dropdown"
```

---

## Task 11: Header + SessionProvider 設定（Client Component 方式）

**設計方針（重要）**: Header は **Client Component** として実装し、`useSession()` で session を読む。これにより `'use client'` ページ（ironclad）と Server Component ページ（/account）の両方から同じ Header を使える。SSR フラッシュ回避のため、layout.tsx で `auth()` を呼び SessionProvider に初期 session を渡す。

`sessionToCurrentUser` ヘルパーは Task 6 で作成済みなので、本タスクではそれを使うのみ。

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/layout/Header.tsx`

- [ ] **Step 1: layout.tsx に SessionProvider 追加**

`src/app/layout.tsx` を以下に置換：

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "勝ちバナー作る君",
  description: "勝ちパターンを学習して、勝てるバナーを量産するAIツール",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Phase A.11.1: SSR で session を取得し SessionProvider に渡す（フラッシュ回避）
  const session = await auth();
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Header.tsx 作成（Client Component）**

`src/components/layout/Header.tsx`:

```tsx
'use client';

/**
 * Phase A.11.1: 共有 Header（Client Component）。
 * useSession() で session を読み、sessionToCurrentUser で CurrentUser に変換。
 * SessionProvider が layout.tsx で SSR session を渡しているため、初回レンダリングからフラッシュなし。
 */
import { ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { PlanPill } from './PlanPill';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  /** ヘッダー中央に差し込むスロット（StepIndicator 等のページ固有 UI） */
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
          <PlanPill plan={user.plan} />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/app/layout.tsx src/components/layout/Header.tsx
git commit -m "feat(layout): add Client Header + SessionProvider in root layout"
```

---

## Task 12: 既存 ironclad ページに Header 統合

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: ironclad page を Header 統合形に置換**

`src/app/page.tsx` の `header` ブロック（90-103 行目）と `StepIndicator` コンポーネント定義（155-171 行目）を以下の形に置換。

ファイル全体を再構成（`'use client'` は維持）:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { IroncladBriefForm } from '@/components/ironclad/IroncladBriefForm';
import {
  IroncladSuggestSelector,
  IroncladSelections,
  IroncladSuggestions,
} from '@/components/ironclad/IroncladSuggestSelector';
import { IroncladGenerateScreen } from '@/components/ironclad/IroncladGenerateScreen';
import { Asset } from '@/components/ironclad/AssetLibrary';
import type { IroncladBrief, IroncladBaseMaterials } from '@/lib/prompts/ironclad-banner';

type IroncladStep = 1 | 2 | 3;

const INITIAL_BRIEF: IroncladBrief = {
  pattern: '王道',
  product: '',
  target: '',
  purpose: '',
  sizes: ['Instagram (1080x1080)'],
};

const INITIAL_SELECTIONS: IroncladSelections = {
  copies: ['', '', '', ''],
  designRequirements: ['', '', '', ''],
  cta: '',
  tone: '',
  caution: '',
};

export default function IroncladPage() {
  const [step, setStep] = useState<IroncladStep>(1);
  const [brief, setBrief] = useState<IroncladBrief>(INITIAL_BRIEF);
  const [productAsset, setProductAsset] = useState<Asset | null>(null);
  const [badge1Asset, setBadge1Asset] = useState<Asset | null>(null);
  const [badge2Asset, setBadge2Asset] = useState<Asset | null>(null);
  const [useWinningRef, setUseWinningRef] = useState<boolean>(true);
  const [selections, setSelections] = useState<IroncladSelections>(INITIAL_SELECTIONS);
  const [suggestions, setSuggestions] = useState<IroncladSuggestions | null>(null);
  const [suggestionsSignature, setSuggestionsSignature] = useState<string>('');
  const [baseMaterials, setBaseMaterials] = useState<IroncladBaseMaterials | null>(null);

  const currentSignature = `${brief.pattern}|${brief.product}|${brief.target}|${brief.purpose}`;
  useEffect(() => {
    if (suggestions && currentSignature !== suggestionsSignature) {
      setSuggestions(null);
      setSuggestionsSignature('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSignature]);

  const handleSuggestionsChange = (s: IroncladSuggestions | null) => {
    setSuggestions(s);
    setSuggestionsSignature(s ? currentSignature : '');
  };

  useEffect(() => {
    const autoSelectLatest = async () => {
      try {
        const [productRes, badgeRes] = await Promise.all([
          fetch('/api/assets?type=product'),
          fetch('/api/assets?type=badge'),
        ]);
        if (productRes.ok) {
          const { assets } = await productRes.json();
          if (assets && assets.length > 0) setProductAsset(assets[0]);
        }
        if (badgeRes.ok) {
          const { assets } = await badgeRes.json();
          if (assets && assets.length > 0) {
            setBadge1Asset(assets[0]);
            if (assets.length > 1) setBadge2Asset(assets[1]);
          }
        }
      } catch (err) {
        console.warn('Failed to auto-select latest assets:', err);
      }
    };
    void autoSelectLatest();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Phase A.11.1: 共有 Header に置換。Step インジケータは中央スロットへ */}
      <Header rightSlot={<StepIndicatorRow current={step} />} />

      <main className="px-6 py-8">
        {step === 1 && (
          <IroncladBriefForm
            brief={brief}
            onChangeBrief={setBrief}
            productAsset={productAsset}
            onChangeProductAsset={setProductAsset}
            badge1Asset={badge1Asset}
            onChangeBadge1Asset={setBadge1Asset}
            badge2Asset={badge2Asset}
            onChangeBadge2Asset={setBadge2Asset}
            useWinningRef={useWinningRef}
            onChangeUseWinningRef={setUseWinningRef}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <IroncladSuggestSelector
            brief={brief}
            useWinningRef={useWinningRef}
            selections={selections}
            onChangeSelections={setSelections}
            suggestions={suggestions}
            onChangeSuggestions={handleSuggestionsChange}
            onBack={() => setStep(1)}
            onNext={(partial) => {
              setBaseMaterials({
                ...partial,
                productImageUrl: productAsset?.blobUrl,
                badgeImageUrl1: badge1Asset?.blobUrl,
                badgeImageUrl2: badge2Asset?.blobUrl,
              });
              setStep(3);
            }}
          />
        )}

        {step === 3 && baseMaterials && (
          <IroncladGenerateScreen
            baseMaterials={baseMaterials}
            sizes={brief.sizes}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  );
}

/**
 * Phase A.11.1: 既存の StepIndicator を 3 連で並べる Row。Header の rightSlot に渡す。
 * モバイル幅では数字のみ（label を sm:inline で隠す）。
 */
function StepIndicatorRow({ current }: { current: IroncladStep }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <StepIndicator current={current} step={1} label="お題" />
      <span className="text-slate-600">→</span>
      <StepIndicator current={current} step={2} label="素材" />
      <span className="text-slate-600">→</span>
      <StepIndicator current={current} step={3} label="完成" />
    </div>
  );
}

function StepIndicator({
  current,
  step,
  label,
}: {
  current: IroncladStep;
  step: IroncladStep;
  label: string;
}) {
  const active = current === step;
  const done = current > step;
  return (
    <div
      className={`px-3 py-1 rounded-full border transition ${
        active
          ? 'bg-teal-500 text-white border-teal-500'
          : done
            ? 'bg-teal-900/40 text-teal-300 border-teal-700'
            : 'bg-slate-800 text-slate-400 border-slate-700'
      }`}
    >
      <span>{step}.</span>
      <span className="hidden sm:inline ml-1">{label}</span>
    </div>
  );
}
```

**重要**: 上の `Header` import は冒頭の import 群に追加が必要（Step 2）。Header は Task 11 で **Client Component** として実装済みなので `'use client'` page から直接 import OK（Server Component の async 制約は無し）。

- [ ] **Step 2: Header import を追加**

ファイル冒頭の import 群に追加：

```ts
import { Header } from '@/components/layout/Header';
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし。Header は Client Component なので `'use client'` page から制約なく呼び出せる。

- [ ] **Step 4: フルビルド確認**

```bash
pnpm build
```

期待: ビルド成功

- [ ] **Step 5: コミット**

```bash
git add src/app/page.tsx
git commit -m "feat(ironclad): replace inline header with shared Header + StepIndicator slot"
```

---

## Task 13: Phase A.11.1 手動検証 + main マージ

**Files:**
- なし（検証 + git 操作のみ）

- [ ] **Step 1: 開発サーバ起動**

```bash
pnpm dev
```

- [ ] **Step 2: ヘッダー表示確認（PC幅）**

`http://localhost:3000` にログイン状態でアクセス。

確認項目:
- [ ] 左にロゴ「**勝ちバナー**作る君」（teal アクセント）
- [ ] 中央に Step インジケータ「1.お題 → 2.素材 → 3.完成」
- [ ] 右に Pill（admin プランなので紫の `Admin`）+ Google アバター画像
- [ ] アバタークリック → ドロップダウン展開
- [ ] ドロップダウン内: 表示名 / メール / Pill / マイアカウント / プラン変更 / サインアウト
- [ ] ドロップダウン外をクリック → 閉じる
- [ ] ESC キー → 閉じる
- [ ] 「マイアカウント」クリック → 一旦 `/account` へ（404 表示で OK、A.11.2 で実装する）
- [ ] 「サインアウト」クリック → `/signin` へリダイレクト

- [ ] **Step 3: 未ログイン挙動確認**

サインアウト状態で `/signin` ページにアクセス → ヘッダーに「グレーの人型アイコン」+「Free Pill」が表示される（middleware で /signin は public なので、ヘッダー使用ページから直接見るには別ルートが必要。今回は次フェーズ A.11.2 の `/account` 実装後に検証可能）。

代替確認: ブラウザの DevTools で session を強制クリア → 任意ページで未ログイン UI が出ることを確認。

- [ ] **Step 4: スマホ幅表示確認**

DevTools でビューポート 375px に切替 → 確認項目:
- [ ] StepIndicator が「1 → 2 → 3」のみ表示（label が消える）
- [ ] ロゴが折り返さず横スクロール許容
- [ ] Pill とアバターが右側に維持される

- [ ] **Step 5: PlanPill 各 plan 値の見た目確認**

prisma studio で自分の plan を `free` / `starter` / `pro` / `admin` に手動切替（テスト用）→ 各色を確認 → 終わったら `admin` に戻す。

- [ ] **Step 6: ブランチを main にマージ**

```bash
git checkout main
git pull
git merge feat/phase-a11-account-ui --no-ff -m "Merge: Phase A.11.1 shared Header + UserMenu"
git push origin main
```

- [ ] **Step 7: 本番デプロイ確認**

`https://autobanner.jp/` で同じ確認を実施。

- [ ] **Step 8: feature ブランチに戻って次フェーズ準備**

```bash
git checkout feat/phase-a11-account-ui
git merge main
```

---

# Phase A.11.2: マイアカウントページ（`/account`）

## Task 14: /api/account/name route 作成

**Files:**
- Create: `src/app/api/account/name/route.ts`

- [ ] **Step 1: route.ts 作成**

```ts
/**
 * Phase A.11.2: PUT /api/account/name
 * Body: { name: string }
 *
 * - 空文字 → User.nameOverride = NULL（Google 名に戻す）
 * - 1〜50 文字（trim 後） → User.nameOverride = name
 * - 51 文字以上 or 空白のみ → 400
 *
 * session 必須。自分の User row のみ更新可。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const prisma = getPrisma();

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as { name?: unknown };
    const rawName = body.name;

    if (typeof rawName !== 'string') {
      return NextResponse.json({ error: 'name must be string' }, { status: 400 });
    }

    const trimmed = rawName.trim();

    // 空文字 → Google 名に戻す
    if (trimmed.length === 0) {
      await prisma.user.update({
        where: { id: user.userId },
        data: { nameOverride: null },
      });
      return NextResponse.json({ nameOverride: null });
    }

    // バリデーション: 50 文字以下
    if (trimmed.length > 50) {
      return NextResponse.json(
        { error: '表示名は 50 文字以下で入力してください' },
        { status: 400 },
      );
    }

    // 全空白チェック（trim 後 0 文字なら上で弾けているので、ここは安全に通る）

    await prisma.user.update({
      where: { id: user.userId },
      data: { nameOverride: trimmed },
    });

    return NextResponse.json({ nameOverride: trimmed });
  } catch (err) {
    console.error('PUT /api/account/name error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/api/account/name/route.ts
git commit -m "feat(api): add PUT /api/account/name for nameOverride update"
```

---

## Task 15: ProfileSection コンポーネント作成

**Files:**
- Create: `src/app/account/ProfileSection.tsx`

- [ ] **Step 1: ProfileSection.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.2: プロフィールセクション。
 * - アバター + 表示名（インライン編集可）
 * - メール（変更不可・グレー表示）
 * - 利用開始日
 *
 * インライン編集: ✏ クリックで input 切替、Enter で保存（PUT /api/account/name）、ESC で キャンセル。
 * バリデーション: 1〜50 文字（trim 後）、空文字保存で Google 名に戻る。
 */
import { useState, KeyboardEvent } from 'react';
import { Pencil, UserCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface ProfileSectionProps {
  user: CurrentUser;
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(user.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleSave = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 50) {
      setError('50 文字以下で入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/account/name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? '保存に失敗しました');
        return;
      }
      // 成功: Server Component を再評価して最新の displayName を反映
      setEditing(false);
      router.refresh();
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    } else if (e.key === 'Escape') {
      setDraftName(user.displayName);
      setEditing(false);
      setError(null);
    }
  };

  const formattedStartDate = user.planStartedAt
    ? user.planStartedAt.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '-';

  return (
    <section>
      <h2 className="text-lg font-semibold border-b border-slate-800 pb-2 mb-4">
        プロフィール
      </h2>

      <div className="space-y-4">
        {/* アバター + 名前 */}
        <div className="flex items-center gap-4">
          {user.image && !imgError ? (
            <img
              src={user.image}
              alt={user.displayName}
              width={56}
              height={56}
              className="rounded-full"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserCircle className="w-14 h-14 text-slate-400" />
          )}

          <div className="flex-1">
            {editing ? (
              <div>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  disabled={saving}
                  maxLength={60}
                  className="bg-neutral-900 border border-slate-700 rounded px-3 py-1 text-white focus:border-teal-500 focus:outline-none w-64"
                />
                <div className="text-xs text-slate-500 mt-1">
                  Enter で保存 / ESC でキャンセル
                </div>
                {saving && (
                  <Loader2 className="inline w-4 h-4 animate-spin ml-2 text-teal-400" />
                )}
                {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">{user.displayName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(user.displayName);
                    setEditing(true);
                  }}
                  aria-label="表示名を編集"
                  className="text-slate-400 hover:text-white transition"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* メール */}
        <div>
          <div className="text-xs text-slate-500 mb-1">メールアドレス</div>
          <div className="text-slate-400">{user.email ?? '-'}（変更不可）</div>
        </div>

        {/* 利用開始日 */}
        <div>
          <div className="text-xs text-slate-500 mb-1">利用開始日</div>
          <div className="text-slate-200">{formattedStartDate}</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/account/ProfileSection.tsx
git commit -m "feat(account): add ProfileSection with inline name editing"
```

---

## Task 16: PlanSection コンポーネント作成

**Files:**
- Create: `src/app/account/PlanSection.tsx`

- [ ] **Step 1: PlanSection.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.2: プラン情報セクション。
 * - 現在のプラン Pill
 * - 利用開始日 / 次回更新日（有料時のみ）
 * - 今月の使用状況プログレスバー
 * - アップグレード/ダウングレードボタン → UpgradeModal
 *
 * id="plan" のアンカー対応（ヘッダードロップダウンの「プラン変更」リンクから来る）。
 */
import { useState } from 'react';
import { PlanPill } from '@/components/layout/PlanPill';
import { UpgradeModal } from './UpgradeModal';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface PlanSectionProps {
  user: CurrentUser;
}

function formatDate(d: Date | null): string {
  if (!d) return '-';
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function PlanSection({ user }: PlanSectionProps) {
  const [modalType, setModalType] = useState<'upgrade' | 'downgrade' | null>(null);

  const isUnlimited = !Number.isFinite(user.usageLimit);
  const ratio = isUnlimited
    ? 0
    : Math.min(1, user.usageCount / Math.max(1, user.usageLimit));
  const percent = Math.round(ratio * 100);

  // 80% 超で amber, 100% で red
  const barColor =
    ratio >= 1
      ? 'bg-red-500'
      : ratio >= 0.8
        ? 'bg-amber-500'
        : 'bg-teal-500';

  return (
    <section id="plan">
      <h2 className="text-lg font-semibold border-b border-slate-800 pb-2 mb-4">
        プラン
      </h2>

      <div className="space-y-4">
        {/* 現在のプラン */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 w-32">現在のプラン</span>
          <PlanPill plan={user.plan} size="sm" />
        </div>

        {/* 利用開始日 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 w-32">利用開始日</span>
          <span className="text-slate-200">{formatDate(user.planStartedAt)}</span>
        </div>

        {/* 次回更新日（有料時のみ表示） */}
        {user.planExpiresAt && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 w-32">次回更新日</span>
            <span className="text-slate-200">{formatDate(user.planExpiresAt)}</span>
          </div>
        )}

        {/* 今月の使用状況 */}
        <div>
          <div className="text-sm text-slate-400 mb-2">今月の使用状況</div>
          {isUnlimited ? (
            <div className="text-slate-200">
              <span className="font-semibold">{user.usageCount}</span> 回（無制限プラン）
            </div>
          ) : (
            <>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${barColor}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="text-sm text-slate-300 mt-2">
                {user.usageCount} / {user.usageLimit} 回
              </div>
              {user.usageResetAt && (
                <div className="text-xs text-slate-500 mt-1">
                  リセット日: {formatDate(user.usageResetAt)}
                </div>
              )}
            </>
          )}
        </div>

        {/* アップグレード/ダウングレードボタン */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setModalType('upgrade')}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded transition"
          >
            アップグレード
          </button>
          <button
            type="button"
            onClick={() => setModalType('downgrade')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded transition"
          >
            ダウングレード
          </button>
        </div>
      </div>

      {modalType && (
        <UpgradeModal
          type={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: PlanSection 自体はエラーなし（UpgradeModal は次タスクで作成するので、まだエラーが出る場合はこの Step は次タスク完了後に再実行）

- [ ] **Step 3: 一旦コミット（次タスクで UpgradeModal 作成後にビルド完全確認）**

```bash
git add src/app/account/PlanSection.tsx
git commit -m "feat(account): add PlanSection with usage progress bar"
```

---

## Task 17: UpgradeModal コンポーネント作成

**Files:**
- Create: `src/app/account/UpgradeModal.tsx`

- [ ] **Step 1: 既存 base-ui dialog 確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
ls node_modules/@base-ui/react/dialog
```

期待: dialog ディレクトリが存在し、`<Dialog>` コンポーネントが利用可能。

- [ ] **Step 2: UpgradeModal.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.2: 「準備中」モーダル。
 * Phase A.12（Stripe）完成までの暫定 UI。
 *
 * - アップグレード/ダウングレード ボタンクリック時に表示
 * - 「メールでお知らせ希望」mailto リンク提供
 * - Phase A.12 着手時は本コンポーネントを Stripe Checkout 起動コードに差し替え
 */
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

interface UpgradeModalProps {
  type: 'upgrade' | 'downgrade';
  onClose: () => void;
}

export function UpgradeModal({ type, onClose }: UpgradeModalProps) {
  const title =
    type === 'upgrade' ? 'アップグレード機能' : 'ダウングレード機能';

  return (
    <DialogPrimitive.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 bg-black/60 z-50" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(90vw,460px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white">
          <DialogPrimitive.Title className="text-lg font-bold mb-3">
            {title}、まもなく公開予定です
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-slate-300 leading-relaxed mb-5">
            Stripe 決済対応中（Phase A.12）。完成までしばらくお待ちください。
            <br />
            メールでお知らせをご希望の方は、
            <a
              href="mailto:str.kk.co@gmail.com?subject=%E3%80%90%E5%8B%9D%E3%81%A1%E3%83%90%E3%83%8A%E3%83%BC%E4%BD%9C%E3%82%8B%E5%90%9B%E3%80%91%E6%B1%BA%E6%B8%88%E5%85%AC%E9%96%8B%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B%E5%B8%8C%E6%9C%9B"
              className="text-teal-400 underline mx-1 hover:text-teal-300"
            >
              こちら
            </a>
            までご一報ください。
          </DialogPrimitive.Description>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
            >
              閉じる
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

**注意**: `@base-ui/react/dialog` の API がバージョン違いで上記と異なる場合は、ファイル冒頭でドキュメント参照: `cat node_modules/@base-ui/react/dialog/index.d.ts | head -50`。素朴な `<div role="dialog">` フォールバックでも要件は満たせる。

- [ ] **Step 3: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし。

エラーが出る場合は dialog API 不一致 → 以下の素朴な実装にフォールバック：

```tsx
'use client';

interface UpgradeModalProps {
  type: 'upgrade' | 'downgrade';
  onClose: () => void;
}

export function UpgradeModal({ type, onClose }: UpgradeModalProps) {
  const title =
    type === 'upgrade' ? 'アップグレード機能' : 'ダウングレード機能';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[min(90vw,460px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-3">
          {title}、まもなく公開予定です
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          Stripe 決済対応中（Phase A.12）。完成までしばらくお待ちください。
          <br />
          メールでお知らせをご希望の方は、
          <a
            href="mailto:str.kk.co@gmail.com?subject=%E3%80%90%E5%8B%9D%E3%81%A1%E3%83%90%E3%83%8A%E3%83%BC%E4%BD%9C%E3%82%8B%E5%90%9B%E3%80%91%E6%B1%BA%E6%B8%88%E5%85%AC%E9%96%8B%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B%E5%B8%8C%E6%9C%9B"
            className="text-teal-400 underline mx-1 hover:text-teal-300"
          >
            こちら
          </a>
          までご一報ください。
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

- [ ] **Step 4: コミット**

```bash
git add src/app/account/UpgradeModal.tsx
git commit -m "feat(account): add UpgradeModal for plan change placeholder"
```

---

## Task 18: SecuritySection コンポーネント作成

**Files:**
- Create: `src/app/account/SecuritySection.tsx`

- [ ] **Step 1: SecuritySection.tsx 作成**

```tsx
'use client';

/**
 * Phase A.11.2: セキュリティセクション。
 * - サインアウト（NextAuth signOut 経由）
 * - アカウント削除依頼（mailto で運営に送信）
 *
 * 削除依頼は API + Formspree ではなく mailto 採用（spec §5.7）。
 * 法的に有料顧客のデータ削除は慎重判断が必要なので運営側手動対応とする。
 */
import { signOut } from 'next-auth/react';
import { LogOut, Mail } from 'lucide-react';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface SecuritySectionProps {
  user: CurrentUser;
}

export function SecuritySection({ user }: SecuritySectionProps) {
  // mailto link 構築
  const subject = `[勝ちバナー作る君] アカウント削除依頼: ${user.email ?? '不明'}`;
  const body =
    `アカウント削除を依頼します。\n\n` +
    `メール: ${user.email ?? '不明'}\n` +
    `ユーザーID: ${user.userId ?? '不明'}\n\n` +
    `削除理由（任意）: \n`;
  const mailtoHref = `mailto:str.kk.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <section>
      <h2 className="text-lg font-semibold border-b border-slate-800 pb-2 mb-4">
        セキュリティ
      </h2>

      <div className="space-y-6">
        {/* サインアウト */}
        <div>
          <div className="text-sm text-slate-300 mb-2">サインアウト</div>
          <div className="text-xs text-slate-500 mb-3">
            すべてのデバイスからサインアウトします
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/signin' })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            <LogOut className="w-4 h-4" />
            サインアウト
          </button>
        </div>

        {/* アカウント削除依頼 */}
        <div>
          <div className="text-sm text-slate-300 mb-2">アカウント削除依頼</div>
          <div className="text-xs text-slate-500 mb-3">
            アカウント情報と素材を削除する場合は運営にメールでご連絡ください
          </div>
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded transition"
          >
            <Mail className="w-4 h-4" />
            削除を依頼する
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
pnpm tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/app/account/SecuritySection.tsx
git commit -m "feat(account): add SecuritySection (signout + delete via mailto)"
```

---

## Task 19: /account ページ本体作成

**Files:**
- Create: `src/app/account/page.tsx`

- [ ] **Step 1: page.tsx 作成**

```tsx
/**
 * Phase A.11.2: マイアカウントページ（Server Component）。
 *
 * 構造:
 * - Header（共有）
 * - main 内に 3 セクション: ProfileSection / PlanSection / SecuritySection
 *
 * 認証: middleware で /account は認証必須なので、ここに到達 = ログイン済み。
 * 念のため userId === null の保険ロジックも入れる。
 */
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ProfileSection } from './ProfileSection';
import { PlanSection } from './PlanSection';
import { SecuritySection } from './SecuritySection';

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user.userId) {
    redirect('/signin?callbackUrl=/account');
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <h1 className="text-2xl font-bold">マイアカウント</h1>
        <ProfileSection user={user} />
        <PlanSection user={user} />
        <SecuritySection user={user} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: フルビルド確認**

```bash
pnpm build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/app/account/page.tsx
git commit -m "feat(account): add /account page combining all sections"
```

---

## Task 20: Phase A.11.2 手動検証 + main マージ

**Files:**
- なし（検証 + git 操作のみ）

- [ ] **Step 1: 開発サーバ起動**

```bash
pnpm dev
```

- [ ] **Step 2: /account 直アクセス（未ログイン状態）**

サインアウト状態で `http://localhost:3000/account` にアクセス → `/signin?callbackUrl=/account` にリダイレクトされることを確認。サインイン後 `/account` に戻る。

- [ ] **Step 3: マイアカウントページ全体表示確認**

ログイン状態で `/account` 表示。確認項目:
- [ ] ヘッダーが表示される（StepIndicator なし、ロゴ + Pill + アバター）
- [ ] h1「マイアカウント」表示
- [ ] プロフィールセクション: アバター + 名前 + メール + 利用開始日
- [ ] プランセクション: Pill + 利用開始日 + プログレスバー + ボタン
- [ ] セキュリティセクション: サインアウト + 削除依頼ボタン

- [ ] **Step 4: 名前インライン編集動作確認**

確認項目:
- [ ] ✏ クリック → input 切替
- [ ] 「テスト名」入力 → Enter → 保存成功 → 表示が「テスト名」に変わる
- [ ] ページリロード → 「テスト名」が継続表示
- [ ] 再度 ✏ → 51 文字以上入力 → Enter → 赤字エラー「50 文字以下で入力してください」
- [ ] 再度 ✏ → 空文字入力（空白のみも含む）→ Enter → 成功 → Google 名に戻る
- [ ] ✏ → 編集中に ESC → 編集キャンセル、元の名前のまま

- [ ] **Step 5: プランセクション動作確認**

確認項目:
- [ ] admin プランで「無制限プラン」表示、プログレスバーなし
- [ ] prisma studio で自分の plan を `pro` に変更、`usageCount=80`、`usageLimit=100` 相当 → リロード → プログレスバー 80% で amber 色
- [ ] `usageCount=100` → red 色
- [ ] 「アップグレード」ボタンクリック → モーダル表示「アップグレード機能、まもなく公開予定です」
- [ ] モーダルの「閉じる」ボタンで閉じる
- [ ] モーダル外背景クリックで閉じる
- [ ] mailto リンクをクリック → メーラーが開き、件名・宛先が正しい
- [ ] 確認後、自分の plan を `admin` に戻す

- [ ] **Step 6: セキュリティセクション動作確認**

確認項目:
- [ ] サインアウトボタンクリック → `/signin` へリダイレクト
- [ ] 再度ログインして `/account` に戻る
- [ ] 削除依頼ボタンクリック → メーラー起動、宛先 `str.kk.co@gmail.com`、件名・本文に user.email / userId 含む

- [ ] **Step 7: ヘッダードロップダウンとの導線確認**

確認項目:
- [ ] アバタークリック → ドロップダウン → 「マイアカウント」クリック → `/account` 遷移
- [ ] アバタークリック → 「プラン変更」クリック → `/account#plan` で プランセクションにアンカースクロール

- [ ] **Step 8: スマホ幅表示確認**

DevTools 375px → 確認項目:
- [ ] ヘッダーが崩れず、Pill とアバター表示維持
- [ ] マイアカウントページが 1 カラムで自然に表示される
- [ ] プログレスバーが画面幅に追従

- [ ] **Step 9: フルビルド最終確認**

```bash
pnpm build
```

期待: ビルド成功

- [ ] **Step 10: ブランチを main にマージ**

```bash
git checkout main
git pull
git merge feat/phase-a11-account-ui --no-ff -m "Merge: Phase A.11.2 /account page (profile + plan + security)"
git push origin main
```

- [ ] **Step 11: 本番デプロイ確認**

`https://autobanner.jp/account` で同じ確認を実施。特に:
- [ ] 名前変更が本番 DB に永続化される
- [ ] 削除依頼の mailto が運営アドレスに正しく送信される
- [ ] `incrementUsage` が本番でも正しく動作（ironclad ページから生成 → /account の usageCount 増加）

- [ ] **Step 12: 完了タグ作成**

```bash
git tag phase-a11-2-stable
git push origin phase-a11-2-stable
```

これで Phase A.11.0-A.11.2 全工程完了。

---

## 完了基準チェックリスト（spec §9 と同期）

- [ ] 既存・新規ユーザー全員が Google SSO ログイン後、ヘッダー右上に Google アバター + プラン Pill が表示される
- [ ] アバタークリックでドロップダウン展開、マイアカウントへの導線が機能する
- [ ] `/account` で プロフィール編集 / プラン情報 / 使用状況プログレスバー / サインアウト / 削除依頼 が動作する
- [ ] `/api/ironclad-generate` 実行ごとに `usageCount` が +1 され、月初に lazy reset される
- [ ] 全ての変更が `pnpm build` を通過し、本番 Vercel 環境で動作する
- [ ] Phase A.12 着手時に schema 変更不要（`stripeCustomerId` 等が既に存在する状態）

すべて達成したら本 plan は完了。
