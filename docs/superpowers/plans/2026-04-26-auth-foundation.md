# Phase A.10: 認証基盤刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Basic Auth を NextAuth.js v5 + Google SSO に置換し、User テーブルを新設して `plan` カラムで admin/free 区別を仕込む。

**Architecture:** NextAuth.js v5 (Auth.js) の Prisma adapter で User/Account/Session/VerificationToken を DB 自動管理。auth.config.ts と auth.ts に config 分離（middleware は edge runtime 用 auth.config 使用）。`getCurrentUser()` を NextAuth セッションから読み取る実装に切替え。既存 Basic Auth middleware を完全置換。

**Tech Stack:** NextAuth.js v5 beta / @auth/prisma-adapter / Prisma 7 / Neon Postgres / Next.js 16 App Router

**Spec:** [docs/superpowers/specs/2026-04-26-auth-foundation-design.md](../specs/2026-04-26-auth-foundation-design.md)

**Test方針:** プロジェクトはテストフレームワーク未導入。各タスクは「TypeScript ビルド通過 + 段階手動確認」で検証。最終 §13.2 全項目PASS で本番反映。

---

## ファイル構成マップ

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/lib/auth/auth.config.ts` | Edge-compatible NextAuth config（providers + callbacks のみ、DB操作なし） |
| `src/lib/auth/auth.ts` | 完全 NextAuth config（Prisma adapter 込み、Node.js runtime 用） |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth API ハンドラ（GET/POST exposing） |
| `src/app/signin/page.tsx` | カスタムサインインページ（最小実装） |
| `scripts/migrate-assets-to-admin.ts` | 既存 Asset を admin に紐付ける一発スクリプト |
| `src/types/next-auth.d.ts` | Session 型拡張（user.id / user.plan を型レベルで追加） |

### 変更
| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | User/Account/Session/VerificationToken モデル追加 + Asset.user リレーション追加 |
| `middleware.ts` | Basic Auth ロジック削除、NextAuth `auth()` ラップで認証チェックに置換 |
| `src/lib/auth/get-current-user.ts` | スタブから NextAuth セッション読み取り実装に置換 + plan フィールド追加 |
| `package.json` | next-auth@beta + @auth/prisma-adapter 依存追加 |
| `.env.example` | AUTH_GOOGLE_ID/SECRET, AUTH_SECRET, ADMIN_EMAILS, ALLOWED_EMAILS 追記 |

### 廃止予定（Phase A.10 完了後）
| 環境変数 | 削除タイミング |
|---|---|
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | 本番動作確認後（リリース手順 §7 末尾） |

---

## Task 0: 安全措置（git tag + ブランチ作成）

**目的:** Phase A.9 状態を保護タグで残し、独立ブランチで開発。

- [ ] **Step 1: 現在の git 状態確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
git log --oneline -3
```

期待: working tree clean / 最新コミットが Phase A.9 マージコミット (`d261d43` または相当)

- [ ] **Step 2: phase-a9-stable タグ作成 + push**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git tag phase-a9-stable
git push origin phase-a9-stable
```

期待: タグ作成成功・GitHub にも push 完了

- [ ] **Step 3: feature ブランチ作成**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git checkout -b feat/auth-foundation
git branch --show-current
```

期待: `feat/auth-foundation`

- [ ] **Step 4: spec/plan を feature ブランチにコミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add docs/superpowers/specs/2026-04-26-auth-foundation-design.md docs/superpowers/plans/2026-04-26-auth-foundation.md
git commit -m "docs: add Phase A.10 auth foundation spec and plan

NextAuth.js v5 (Google SSO) + User table + plan column foundation
for SaaS readiness. Replaces Basic Auth."
```

---

## Task 1: 依存関係インストール

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: NextAuth.js v5 + Prisma adapter インストール**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm install next-auth@beta @auth/prisma-adapter
```

期待: `next-auth` (5.x.x-beta) と `@auth/prisma-adapter` が `package.json` の dependencies に追加

注意: `next-auth@beta` は v5 のことを指す。v4 (next-auth@4) は古いAPI。

- [ ] **Step 2: ビルド確認（Auth ライブラリだけ入れた状態）**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功（まだ NextAuth は使ってないので影響なし）

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add package.json package-lock.json
git commit -m "deps: add next-auth@beta and @auth/prisma-adapter

Phase A.10 prep: NextAuth.js v5 (Auth.js) for Google SSO replacement
of Basic Auth."
```

---

## Task 2: Prisma スキーマ更新 + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/{timestamp}_add_auth_tables_and_user_relation/migration.sql`

- [ ] **Step 1: schema.prisma に User/Account/Session/VerificationToken 追加 + Asset リレーション**

`prisma/schema.prisma` の末尾（既存 Asset モデルの後）に以下を追記。同時に、既存 `Asset` モデルに `user` リレーションフィールドを追加する。

まず Asset モデルを以下に置き換え（既存フィールド維持、`user` リレーション追加のみ）:

```prisma
/// Phase A.7 Ironclad: 永続素材ライブラリ。商品画像・認証バッジ等を一度アップロードしたら
/// 以降のバナー生成で都度再アップロード不要に。Vercel Blob (Public) に実体保存。
/// Phase A.8 拡張: type='winning_banner' で勝ちバナー解析結果も保持する二層構造。
/// Phase A.10 拡張: User リレーション正式化。
model Asset {
  id          String   @id @default(cuid())
  /// 'product' | 'badge' | 'logo' | 'other' | 'winning_banner' (Phase A.8追加)
  type        String
  /// ユーザー表示名（例: "5 Point Detox", "GMP Quality"）
  name        String
  /// Vercel Blob の Public URL
  blobUrl     String
  /// 画像の MIME type (image/png, image/jpeg など)
  mimeType    String?
  /// Screen 1 のデフォルト選択対象か（最後に使ったものを自動選択するため）
  isPinned    Boolean  @default(false)

  /// Phase A.8: SaaS化見据え。Phase 1 は全 NULL で運用。
  userId            String?
  /// Phase A.10: User リレーション
  user              User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  /// Phase A.8: 勝ちバナー解析結果（プロンプト注入用の抽象タグのみ）
  analysisAbstract  Json?
  /// Phase A.8: 勝ちバナー解析結果（分析・デバッグ用の生抽出データ。外部APIには絶対送信禁止）
  analysisConcrete  Json?
  /// Phase A.8: 解析プロンプトのバージョン管理（将来プロンプト改善時の互換性用）
  analysisVersion   Int?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([type])
  @@index([createdAt])
  @@index([userId])
}
```

そしてファイル末尾に以下を追記:

```prisma
/// Phase A.10: NextAuth.js v5 + admin/plan 区別の基盤
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?

  /// Phase A.10: 'free' | 'starter' | 'pro' | 'admin'
  /// Phase A.11+ で機能 gate のキーとして使用
  plan          String    @default("free")

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  assets        Asset[]
}

/// NextAuth.js v5 Account テーブル（Provider別の OAuth トークン保存）
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

/// NextAuth.js v5 Session テーブル（DB session strategy）
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

/// NextAuth.js v5 VerificationToken テーブル（Magic Link 用、Phase A.10 では未使用だが必須）
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

- [ ] **Step 2: migration を生成・実行**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate dev --name add_auth_tables_and_user_relation
```

期待:
- `prisma/migrations/{timestamp}_add_auth_tables_and_user_relation/` ディレクトリ生成
- migration.sql に `CREATE TABLE "User"`, `CREATE TABLE "Account"`, `CREATE TABLE "Session"`, `CREATE TABLE "VerificationToken"` および Asset への外部キー追加
- Neon DB に migration 適用成功

- [ ] **Step 3: 生成された migration.sql 内容確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
ls prisma/migrations/ | tail -3
```

最新 migration ディレクトリの `migration.sql` を Read で確認。期待:
- 4つの CREATE TABLE 文（User/Account/Session/VerificationToken）
- ALTER TABLE "Asset" ADD CONSTRAINT で user リレーション追加
- 既存データへの破壊的変更なし

- [ ] **Step 4: Prisma Client 再生成**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma generate
```

期待: 「Generated Prisma Client」メッセージ。`User`, `Account`, `Session` が型として使えるようになる。

- [ ] **Step 5: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功（既存コードは新テーブル使ってないので影響なし）

- [ ] **Step 6: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add User/Account/Session/VerificationToken for NextAuth.js v5

Phase A.10 schema: NextAuth.js standard tables + User.plan column for
admin/free distinction. Asset.user relation added (existing userId column
unchanged). Migration is purely additive — no existing data impact."
```

---

## Task 3: NextAuth Session 型拡張

**Files:**
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: 型定義ファイル作成**

`src/types/next-auth.d.ts`:

```typescript
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Phase A.10: session.user に id と plan を追加。
   * NextAuth v5 のデフォルトには id がないので明示的に拡張する。
   */
  interface Session {
    user: {
      id: string;
      plan: string;
    } & DefaultSession['user'];
  }

  interface User {
    plan?: string;
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/types/next-auth.d.ts
git commit -m "feat(auth): extend NextAuth Session type with id and plan

TypeScript module augmentation so session.user.id and session.user.plan
are typed throughout the codebase."
```

---

## Task 4: Auth Config 作成（auth.config.ts）

**Files:**
- Create: `src/lib/auth/auth.config.ts`

**目的:** Edge runtime 互換 (DB 操作なし) の config。middleware が import する。

- [ ] **Step 1: auth.config.ts 作成**

`src/lib/auth/auth.config.ts`:

```typescript
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge runtime 互換 (DB 操作を含まない) NextAuth.js v5 config。
 * middleware と auth.ts の両方が import する。
 *
 * Phase A.10:
 * - Google OAuth Provider のみ
 * - signIn callback でホワイトリスト判定（ALLOWED_EMAILS）
 * - DB 操作（User upsert / plan 付与）は auth.ts 側の Prisma adapter に任せる
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    /**
     * ALLOWED_EMAILS 環境変数によるホワイトリスト制御。
     * 空文字 or 未設定 → 全公開（Phase A.15 で空にして公開）
     * カンマ区切り → リスト内のメアドのみログイン可
     */
    async signIn({ user }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // ALLOWED_EMAILS 空 → 全員許可（A.15 公開時の状態）
      if (allowed.length === 0) return true;

      // メアドがリストに含まれていれば許可
      if (user.email && allowed.includes(user.email)) return true;

      // それ以外は拒否
      return false;
    },
    /**
     * ルート保護用の authorized callback。middleware から呼ばれる。
     * auth(=session) があるかどうかだけ判定。詳細な path 別ルールは
     * middleware.ts 側で行う。
     */
    async authorized({ auth }) {
      return !!auth;
    },
  },
};
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/lib/auth/auth.config.ts
git commit -m "feat(auth): add edge-compatible NextAuth config

Defines Google provider, signIn whitelist callback (ALLOWED_EMAILS),
and authorized callback for middleware. No DB operations — safe to
import from edge runtime."
```

---

## Task 5: Auth Full Config 作成（auth.ts）

**Files:**
- Create: `src/lib/auth/auth.ts`

**目的:** Prisma adapter + DB session 込みの完全 config。Server-side helper (`auth()`, `signIn()`, `signOut()`, `handlers`) を export。

- [ ] **Step 1: auth.ts 作成**

`src/lib/auth/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { getPrisma } from '@/lib/prisma';
import { authConfig } from './auth.config';

const prisma = getPrisma();

/**
 * Phase A.10: NextAuth.js v5 完全 config。
 * Prisma adapter で User/Account/Session を DB 自動管理。
 * - session strategy: 'database' (Prisma adapter 使用時の標準)
 * - signIn 時に User row 自動作成 (adapter が処理)
 * - admin email を自動的に plan='admin' に昇格 (events.signIn フック)
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  callbacks: {
    ...authConfig.callbacks,
    /**
     * セッション読み取り時に User.plan を session.user.plan に注入。
     * これにより `getCurrentUser()` から plan が見えるようになる。
     */
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        // user は Prisma User row なので plan を直接読める
        // （TypeScript 型の都合で any キャスト）
        session.user.plan = (user as { plan?: string }).plan ?? 'free';
      }
      return session;
    },
  },
  events: {
    /**
     * 初回サインイン時 (User row 作成直後) に admin 自動昇格。
     * ADMIN_EMAILS env のリストに該当するメアドを admin に。
     */
    async signIn({ user, isNewUser }) {
      if (!user.email) return;
      const adminEmails = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (adminEmails.includes(user.email)) {
        // 既存 user でも plan が admin でなければ昇格
        await prisma.user.update({
          where: { email: user.email },
          data: { plan: 'admin' },
        });
      }
    },
  },
});
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/lib/auth/auth.ts
git commit -m "feat(auth): add full NextAuth config with Prisma adapter

DB session strategy + auto admin plan promotion via events.signIn.
session callback injects user.id and user.plan for downstream consumers."
```

---

## Task 6: NextAuth API Route Handler

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: ディレクトリ作成 + handler ファイル作成**

```bash
mkdir -p C:/Users/strkk/claude_pjt/banner-tsukurukun/src/app/api/auth/\[...nextauth\]
```

`src/app/api/auth/[...nextauth]/route.ts`:

```typescript
/**
 * NextAuth.js v5 API ハンドラ。
 * GET/POST を auth.ts の handlers にバインド。
 * /api/auth/signin, /api/auth/callback/google, /api/auth/session 等を提供。
 */
export { GET, POST } from '@/lib/auth/auth';
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功・`/api/auth/[...nextauth]` ルートが新規登録される

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/app/api/auth/
git commit -m "feat(auth): add NextAuth API route handler

Exposes /api/auth/* endpoints (signin, callback, session, etc.)."
```

---

## Task 7: カスタム Sign In ページ

**Files:**
- Create: `src/app/signin/page.tsx`

**目的:** デフォルトの NextAuth signin ページではなく、自分のスタイルで作る最小ページ。

- [ ] **Step 1: signin ページ作成**

`src/app/signin/page.tsx`:

```tsx
'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-teal-400">勝ちバナー</span>作る君
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            ブリーフを書くだけで勝ちバナーを17サイズ一括生成
          </p>
        </div>

        {error === 'AccessDenied' && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded p-3 border border-red-700/50">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              現在ベータ運用中です。アクセス権がある場合は管理者にお問い合わせください。
            </span>
          </div>
        )}

        {error && error !== 'AccessDenied' && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded p-3 border border-red-700/50">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>ログインエラーが発生しました。再度お試しください。({error})</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl })}
          className="w-full px-6 py-3 rounded-xl text-white font-bold bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 transition"
        >
          Google アカウントでログイン
        </button>

        <p className="text-[11px] text-slate-500">
          ログインすることで利用規約に同意したものとみなされます
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <SignInContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功・`/signin` ルートが新規登録される

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/app/signin/
git commit -m "feat(auth): add minimal custom sign-in page

Branded sign-in page at /signin with Google login button. Handles
AccessDenied error (whitelist rejection) with friendly message."
```

---

## Task 8: middleware.ts 刷新

**Files:**
- Modify: `middleware.ts`（全置換）

**目的:** Basic Auth ロジック完全削除 → NextAuth `auth()` ベースの認証に切替。`/lp01`, `/lp02` 等の public path も設定。

- [ ] **Step 1: middleware.ts を完全書き換え**

`middleware.ts` の**全内容**を以下に置き換え:

```typescript
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  '/signin',
  '/lp01',  // Phase A.15 で実装する LP（予約）
  '/lp02',
  '/lp03',
];

const PUBLIC_PATH_PREFIXES = [
  '/api/auth',  // NextAuth エンドポイント
  '/_next',
];

/**
 * Phase A.10: NextAuth.js v5 ベース認証 middleware。
 * 既存 Basic Auth は完全廃止。
 *
 * - /signin, /lp** はログイン不要
 * - /api/auth/** は NextAuth 自身のエンドポイントなので素通し
 * - それ以外は session 必須、未ログインなら /signin へリダイレクト
 *
 * ALLOWED_EMAILS のホワイトリスト判定は auth.config.ts の signIn callback 側。
 * ここでは単純に「セッションがあるかないか」のみチェック。
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // 完全一致 public パス
  if (PUBLIC_PATHS.includes(pathname)) {
    return;
  }

  // プレフィックス public パス
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return;
  }

  // 未ログイン → /signin にリダイレクト（callbackUrl で元の path を保持）
  if (!req.auth) {
    const signInUrl = new URL('/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return Response.redirect(signInUrl);
  }

  // ログイン済 → そのまま通す
  return;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add middleware.ts
git commit -m "feat(auth): replace Basic Auth middleware with NextAuth session check

Phase A.10: All paths require login except /signin, /lp01-03 (LP reserved
for Phase A.15), and /api/auth/*. Unauthenticated users redirect to
/signin with callbackUrl preserving the intended destination.

ALLOWED_EMAILS whitelist is enforced in auth.config.ts signIn callback,
not here — middleware only checks 'is there a session'."
```

---

## Task 9: getCurrentUser 実装更新

**Files:**
- Modify: `src/lib/auth/get-current-user.ts`

**目的:** スタブから NextAuth セッション読み取り実装に置換。plan フィールド追加。

- [ ] **Step 1: get-current-user.ts を完全書き換え**

`src/lib/auth/get-current-user.ts` の**全内容**を以下に置換:

```typescript
import { auth } from './auth';

/**
 * Phase A.10: NextAuth.js v5 セッションから現在のユーザーを取得。
 * Server Components / Route Handlers / Server Actions から呼ぶ。
 *
 * 未ログイン時は userId=null, plan='free' を返す。
 * middleware で /signin に飛ばされるため、認証必須 path では実質ログイン済み。
 *
 * Phase A.11+ で plan ベースの機能 gate に使用。
 */
export interface CurrentUser {
  /** ログイン済の Prisma User.id。未ログイン時は null。 */
  userId: string | null;
  /** ログイン済の email。未ログイン時は null。 */
  email: string | null;
  /** Phase A.10: 'free' | 'starter' | 'pro' | 'admin' */
  plan: string;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    return { userId: null, email: null, plan: 'free' };
  }
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    plan: session.user.plan ?? 'free',
  };
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功（既存呼び出し元 `winning-banners/route.ts` は新フィールド無視で動く）

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/lib/auth/get-current-user.ts
git commit -m "feat(auth): implement getCurrentUser with NextAuth session

Replaces Phase A.8 stub with real implementation. Returns userId,
email, and plan from session. Existing callers (winning-banners API)
keep working unchanged — they only use userId."
```

---

## Task 10: Migration Script 作成

**Files:**
- Create: `scripts/migrate-assets-to-admin.ts`

- [ ] **Step 1: ディレクトリ作成 + スクリプト作成**

```bash
ls C:/Users/strkk/claude_pjt/banner-tsukurukun/scripts/ 2>/dev/null || mkdir -p C:/Users/strkk/claude_pjt/banner-tsukurukun/scripts
```

`scripts/migrate-assets-to-admin.ts`:

```typescript
/**
 * Phase A.10 一発スクリプト: 既存 Asset (userId=null) を admin user に紐付ける。
 *
 * 実行タイミング:
 * 1. NextAuth デプロイ完了後
 * 2. admin が Google SSO で初回ログイン → User row 自動作成
 * 3. このスクリプト実行 → 既存 Asset 全件が admin に移行
 *
 * 実行方法:
 *   DATABASE_URL=<対象DBのURL> npx tsx scripts/migrate-assets-to-admin.ts
 *
 * 本番DBに実行する場合は DATABASE_URL を本番に向けて実行。
 * 二重実行は安全（userId IS NULL の条件なので、既に紐付け済みは対象外）。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmailsRaw = process.env.ADMIN_EMAILS ?? '';
  const adminEmail = adminEmailsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0];

  if (!adminEmail) {
    throw new Error(
      'ADMIN_EMAILS env not set. Required for identifying the admin user.',
    );
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    throw new Error(
      `Admin user not found for email "${adminEmail}". ` +
        `Please login first at /signin so the User row is created.`,
    );
  }

  console.log(`Admin user: ${admin.email} (id=${admin.id}, plan=${admin.plan})`);

  const targetCount = await prisma.asset.count({ where: { userId: null } });
  console.log(`Found ${targetCount} assets with userId=null`);

  if (targetCount === 0) {
    console.log('Nothing to migrate. Exiting.');
    return;
  }

  const result = await prisma.asset.updateMany({
    where: { userId: null },
    data: { userId: admin.id },
  });

  console.log(`✅ Migrated ${result.count} assets to admin (${admin.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  });
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功（scripts/ は build から除外されているはずだが確認）

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add scripts/migrate-assets-to-admin.ts
git commit -m "feat(scripts): add migrate-assets-to-admin one-shot script

Phase A.10 migration: Backfill Asset.userId for all NULL rows to point
to the admin user (identified by ADMIN_EMAILS env). Safe to re-run
(idempotent via WHERE userId IS NULL)."
```

---

## Task 11: 環境変数追加

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: .env.example に新規 env 追記**

`.env.example` の末尾に追記:

```
# Phase A.10: NextAuth.js v5
# Google OAuth credentials (Google Cloud Console で発行)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
# NextAuth セッション暗号化キー (npx auth secret で生成、32文字以上)
AUTH_SECRET=
# admin 自動付与（カンマ区切り）。最低1件は必須。
ADMIN_EMAILS=str.kk.co@gmail.com
# ベータ期間ホワイトリスト（カンマ区切り、空にすると全公開）
ALLOWED_EMAILS=str.kk.co@gmail.com
```

- [ ] **Step 2: ローカル .env にも追加（Step 12 で完成）**

ローカル `.env` には Google OAuth 取得後の作業で追加。今は .env.example のみ更新でOK。

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add .env.example
git commit -m "chore: document NextAuth env vars in .env.example

AUTH_GOOGLE_ID/SECRET, AUTH_SECRET, ADMIN_EMAILS, ALLOWED_EMAILS
required for Phase A.10. BASIC_AUTH_USER/PASSWORD remain temporarily
until Phase A.10 verification completes."
```

---

## Task 12: 小池さん作業 — Google OAuth credentials 取得

**Files:** なし（外部ツール作業）

**所要時間:** 約10分

- [ ] **Step 1: Google Cloud Console を開く**

[https://console.cloud.google.com/](https://console.cloud.google.com/) にアクセス。`str.kk.co@gmail.com` でログイン。

- [ ] **Step 2: プロジェクト選択 or 新規作成**

既存「banner-tsukurukun」プロジェクトがあれば選択。なければ新規作成（プロジェクト名: `banner-tsukurukun-prod`）。

- [ ] **Step 3: OAuth 同意画面の設定（初回のみ）**

左メニュー「APIとサービス」 → 「OAuth同意画面」:
- User Type: 「外部」を選択 → 作成
- アプリ名: `勝ちバナー作る君`
- ユーザーサポートメール: `str.kk.co@gmail.com`
- デベロッパー連絡先: `str.kk.co@gmail.com`
- スコープ: デフォルトのまま（email, profile, openid のみ）
- テストユーザー: `str.kk.co@gmail.com` 追加（公開ステータスが「テスト」の間はテストユーザーのみログイン可）
- 保存して続行

- [ ] **Step 4: OAuth 2.0 クライアント ID 作成**

左メニュー「認証情報」 → 「+ 認証情報を作成」 → 「OAuth クライアント ID」:
- アプリケーションの種類: 「ウェブ アプリケーション」
- 名前: `勝ちバナー作る君 Web Client`
- 承認済みの JavaScript 生成元:
  - `http://localhost:3000`
  - `https://autobanner.jp`
- 承認済みのリダイレクト URI:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://autobanner.jp/api/auth/callback/google`
- 「作成」クリック

- [ ] **Step 5: クライアント ID とシークレットを控える**

ポップアップに表示される:
- クライアント ID: `xxxxx.apps.googleusercontent.com`
- クライアント シークレット: `GOCSPX-xxxxx`

両方を Claude にコピペで共有してください（または直接 Vercel env に入れる）。

---

## Task 13: AUTH_SECRET 生成 + Vercel env 設定

**Files:** なし（CLI 作業）

- [ ] **Step 1: AUTH_SECRET 生成**

Claude が CLI 実行:
```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx auth secret
```

期待: ランダム文字列が生成され、`.env.local` に追記される（NextAuth が自動でやる）。出力された文字列を控える。

- [ ] **Step 2: Vercel env 5本追加（Production）**

Claude が CLI 実行（Phase A.8 で確認済の手順）:
```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
echo "<AUTH_GOOGLE_ID>" | npx vercel env add AUTH_GOOGLE_ID production
echo "<AUTH_GOOGLE_SECRET>" | npx vercel env add AUTH_GOOGLE_SECRET production
echo "<AUTH_SECRET>" | npx vercel env add AUTH_SECRET production
echo "str.kk.co@gmail.com" | npx vercel env add ADMIN_EMAILS production
echo "str.kk.co@gmail.com" | npx vercel env add ALLOWED_EMAILS production
```

期待: 5つの env が Vercel Production に追加される

- [ ] **Step 3: Development env にも同じ値を追加**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
echo "<AUTH_GOOGLE_ID>" | npx vercel env add AUTH_GOOGLE_ID development
echo "<AUTH_GOOGLE_SECRET>" | npx vercel env add AUTH_GOOGLE_SECRET development
echo "<AUTH_SECRET>" | npx vercel env add AUTH_SECRET development
echo "str.kk.co@gmail.com" | npx vercel env add ADMIN_EMAILS development
echo "str.kk.co@gmail.com" | npx vercel env add ALLOWED_EMAILS development
```

- [ ] **Step 4: Vercel env 確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx vercel env ls 2>&1 | grep -E "AUTH_|ADMIN_|ALLOWED_"
```

期待: 5つ × 2環境 = 10エントリが表示

- [ ] **Step 5: ローカル .env にも追加**

`.env` ファイル末尾に追記:
```
AUTH_GOOGLE_ID=<取得した値>
AUTH_GOOGLE_SECRET=<取得した値>
AUTH_SECRET=<生成した値>
ADMIN_EMAILS=str.kk.co@gmail.com
ALLOWED_EMAILS=str.kk.co@gmail.com
```

注意: `.env` は gitignore 対象。コミットされない。

---

## Task 14: ローカル動作確認

**Files:** なし（手動テスト）

- [ ] **Step 1: 開発サーバ起動**

別ターミナル（PowerShell）で:
```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run dev
```

期待: `http://localhost:3000` で起動、Basic Auth プロンプトが**出ない**

- [ ] **Step 2: 未ログインアクセス確認**

ブラウザで `http://localhost:3000` を開く（できれば**シークレットウィンドウ**で）。

期待: `/signin` ページにリダイレクト、Google ログインボタン表示

- [ ] **Step 3: Google ログイン実行**

「Google アカウントでログイン」ボタン押下 → Google 同意画面 → `str.kk.co@gmail.com` 選択

期待:
- リダイレクトしてアプリ画面（`/`）に遷移
- 既存のブリーフ入力 UI が表示される

- [ ] **Step 4: admin 付与確認**

別ターミナルで:
```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
DATABASE_URL=$(grep DATABASE_URL .env | cut -d'=' -f2-) npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.user.findUnique({ where: { email: 'str.kk.co@gmail.com' } }).then(u => { console.log(u); process.exit(0); });"
```

期待: User row が表示され、`plan: 'admin'` になっている

- [ ] **Step 5: 既存データへのアクセス確認**

ブラウザで STEP 1 → 「🏆 勝ちバナー参照」セクションを確認。

期待: **既存の勝ちバナーが見えない**（migration 未実行のため userId NULL のまま、ログインユーザー（admin）と紐付け未完了）

→ 次の Task 15 で migration 実行して解決する。

- [ ] **Step 6: ログアウト → 再ログイン確認**

ブラウザの cookie を消す or シークレットウィンドウ閉じて開き直す。`http://localhost:3000` → `/signin` にリダイレクト → 再度ログイン → セッション復活確認。

- [ ] **Step 7: ALLOWED_EMAILS 拒否確認（任意）**

`.env` の `ALLOWED_EMAILS=other@example.com` に書き換えて開発サーバ再起動。`str.kk.co@gmail.com` でログイン試行 → エラーページ「現在ベータ運用中です」表示確認。

確認後 `ALLOWED_EMAILS=str.kk.co@gmail.com` に戻して再起動。

---

## Task 15: ローカル migration script 動作確認

**Files:** なし（スクリプト実行）

- [ ] **Step 1: ローカルDBで migration script 実行**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx tsx scripts/migrate-assets-to-admin.ts
```

期待:
```
Admin user: str.kk.co@gmail.com (id=cxxxxx, plan=admin)
Found N assets with userId=null
✅ Migrated N assets to admin (cxxxxx)
```

注意: `.env` の DATABASE_URL を読む。`tsx` は dotenv 自動読み込み。

- [ ] **Step 2: 既存データアクセス再確認**

ブラウザで STEP 1 → 「🏆 勝ちバナー参照」セクション。

期待: **既存の勝ちバナーが復活して見える**

- [ ] **Step 3: STEP 1 → STEP 2 → STEP 3 の通常生成フロー確認**

1. STEP 1 入力 → 「次へ」
2. STEP 2 サジェスト生成 → 4スロット選択 → 「次へ」
3. STEP 3 で1サイズ生成

期待: 通常生成完了・既存と同じバナー出力

---

## Task 16: ローカル動作 OK 確認後にコミット

**目的:** ローカルで全機能動作確認した状態を確実にコミット。Task 4-9 までの実装変更が一括反映済みのはず。

- [ ] **Step 1: untracked / 未コミット差分の最終確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
```

期待: clean working tree（Task 0-11 で全部コミット済のはず）。差分があれば内容確認の上コミット。

---

## Task 17: 本番デプロイ

**目的:** feature ブランチを GitHub に push、preview 確認、main マージ、本番反映。

- [ ] **Step 1: ブランチを GitHub に push**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git push -u origin feat/auth-foundation
```

期待: push 成功。Vercel が自動でプレビュー deploy 開始。

- [ ] **Step 2: プレビュー URL を取得**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx vercel ls 2>/dev/null | head -5
```

最新の Preview 環境 URL（例: `https://banner-tsukurukun-xxxx-satoru-designs-projects.vercel.app`）を控える。

- [ ] **Step 3: プレビュー動作確認**

プレビュー URL を**シークレットウィンドウ**で開く:
1. `/signin` リダイレクト確認
2. Google ログイン → `str.kk.co@gmail.com` 選択
3. アプリ画面表示確認（**勝ちバナーは見えないはず**、本番DBには User row まだ未作成）
4. 一旦ここでストップ。本番ログイン → migration script 実行が次の手順。

- [ ] **Step 4: main にマージ**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git checkout main
git pull origin main
git merge --no-ff feat/auth-foundation -m "Merge: Phase A.10 auth foundation (NextAuth.js v5)

Replaces Basic Auth with Google SSO via NextAuth.js v5 + Prisma adapter.
Adds User/Account/Session/VerificationToken tables and User.plan column
('free' | 'starter' | 'pro' | 'admin' default 'free').

Login flow:
- /signin → Google OAuth → User row auto-created
- ADMIN_EMAILS match → plan auto-promoted to 'admin'
- ALLOWED_EMAILS whitelist enforces beta-period access control

Asset.user relation formalized (existing userId column unchanged).
Migration script (scripts/migrate-assets-to-admin.ts) backfills
existing assets to the admin user.

Rollback: git checkout phase-a9-stable + redeploy."
```

- [ ] **Step 5: main を push（本番反映トリガ）**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git push origin main
```

期待: Vercel が本番 deploy 自動開始（約30秒）

- [ ] **Step 6: 本番 deploy 完了確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx vercel ls 2>/dev/null | grep "Production" | head -2
```

期待: 直近の Production deploy が `● Ready`

- [ ] **Step 7: 本番マイグレーション適用確認**

Vercel build script は `prisma generate && next build` のみで `migrate deploy` を含まない。**Phase A.10 では新規テーブル4本追加なので、本番DB（=ローカルと同じNeon DB）には Task 2 で既に適用済み**。再実行不要。

確認:
```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate status
```

期待: 「Database schema is up to date!」

---

## Task 18: 本番初回ログイン + Asset 移行

**目的:** 本番でユーザー作成 + 既存 Asset 紐付け。

- [ ] **Step 1: 本番URL でログイン**

`https://autobanner.jp/` をシークレットウィンドウで開く。

期待: `/signin` リダイレクト → Google ログインボタン

- [ ] **Step 2: Google アカウント `str.kk.co@gmail.com` でログイン**

Google 同意画面 → アプリ画面遷移。

期待: アプリ画面表示・**勝ちバナーセクションは空（未移行のため）**

- [ ] **Step 3: 本番DB に対して migration script 実行**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx tsx scripts/migrate-assets-to-admin.ts
```

期待:
```
Admin user: str.kk.co@gmail.com (id=cxxxxx, plan=admin)
Found N assets with userId=null
✅ Migrated N assets to admin (cxxxxx)
```

注意: ローカル `.env` の DATABASE_URL は本番 Neon DB を指している（dev/prod 共通DBのため）。Phase A.8 と同じ前提。

- [ ] **Step 4: 本番動作確認**

ブラウザで `https://autobanner.jp/` → STEP 1:

期待:
- 既存の勝ちバナーが表示される
- 商品画像 / バッジ slots に既存データが見える
- STEP 1-3 の通常生成フロー完了する

- [ ] **Step 5: ALLOWED_EMAILS 拒否確認（任意・本番）**

別 Google アカウント（`koike.test@gmail.com` など、ALLOWED_EMAILS に含まれていないメアド）で `https://autobanner.jp/signin` ログイン試行。

期待: 「現在ベータ運用中です」エラーメッセージ表示。アプリ画面に進めない。

---

## Task 19: BASIC_AUTH 廃止

**目的:** 動作確認 OK 後、不要になった Basic Auth env を削除。

- [ ] **Step 1: Vercel env から Basic Auth env 削除**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx vercel env rm BASIC_AUTH_USER production --yes
npx vercel env rm BASIC_AUTH_PASSWORD production --yes
npx vercel env rm BASIC_AUTH_USER development --yes
npx vercel env rm BASIC_AUTH_PASSWORD development --yes
```

期待: 4エントリ削除成功

- [ ] **Step 2: Vercel に再デプロイトリガ**

env 削除後の確認のため empty commit + push:
```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git commit --allow-empty -m "chore: trigger redeploy after BASIC_AUTH env removal"
git push origin main
```

期待: 本番 deploy 完了後、Basic Auth env なしでも問題なくログインできる

- [ ] **Step 3: ローカル .env からも Basic Auth 削除（任意）**

`.env` の以下行を削除:
```
BASIC_AUTH_USER=koike
BASIC_AUTH_PASSWORD=banner2026
```

開発サーバ再起動して動作確認。

---

## Task 20: メモリ更新

**Files:**
- Modify: `C:/Users/strkk/.claude/projects/C--Users-strkk--claude/memory/project_banner_tsukurukun.md`

- [ ] **Step 1: Phase 履歴に A.10 追加**

`## Phase 履歴` セクションの末尾、Phase A.9 の後に以下追加:

```markdown
- **Phase A.10 完了（2026-04-26）** - 認証基盤刷新（NextAuth.js v5 + Google SSO） / branch `feat/auth-foundation` / タグ `phase-a9-stable`
  - Basic Auth 廃止 → Google OAuth ログイン
  - User / Account / Session / VerificationToken テーブル新設
  - User.plan カラム ('free' | 'starter' | 'pro' | 'admin') で SaaS基盤
  - 小池さん `str.kk.co@gmail.com` が admin 自動付与
  - ALLOWED_EMAILS env でベータ期間ホワイトリスト制
  - 既存 Asset 全件を admin に移行（migration script 実行済）
  - middleware: `/lp01〜lp03` を public 予約（Phase A.15 用）
```

- [ ] **Step 2: Basic 認証情報を「廃止」表記に更新**

冒頭の `**Basic認証:** koike / banner2026` 行を以下に置換:
```markdown
**認証:** Google SSO (NextAuth.js v5)。admin: str.kk.co@gmail.com。Basic Auth は Phase A.10 で廃止済。
```

- [ ] **Step 3: 環境変数セクション更新**

`## 環境変数（.env）` セクションを以下に更新:

```markdown
## 環境変数（.env）
- DATABASE_URL（Neon、dev/prod共通）
- GEMINI_API_KEY / GOOGLE_AI_STUDIO_API_KEY
- ANTHROPIC_API_KEY
- REPLICATE_API_TOKEN（FLUX）
- OPENAI_API_KEY（gpt-image-2、Business verification 済みアカウント必須）
- BLOB_READ_WRITE_TOKEN（Vercel Blob Public store）
- WINNING_BANNER_ENABLED（Phase A.8 機能ON/OFF）
- AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET（Phase A.10: Google OAuth）
- AUTH_SECRET（Phase A.10: NextAuth セッション暗号化）
- ADMIN_EMAILS（Phase A.10: admin 自動付与カンマ区切り）
- ALLOWED_EMAILS（Phase A.10: ホワイトリスト、空にすると全公開）
```

- [ ] **Step 4: 設計ドキュメントセクションに A.10 追加**

`## 設計ドキュメント` セクションに以下追加:

```markdown
- Phase A.10 Spec: `docs/superpowers/specs/2026-04-26-auth-foundation-design.md`
- Phase A.10 Plan: `docs/superpowers/plans/2026-04-26-auth-foundation.md`
```

---

## Self-Review

**1. Spec coverage:**
- §1 背景・目的 → Task 0-19 全体で実装
- §2 採用技術 → Task 1（依存追加）+ Task 4/5/6（NextAuth実装）
- §3 データモデル → Task 2（Prisma schema）
- §4 アクセス制御 → Task 4（auth.config）+ Task 5（events.signIn 自動昇格）+ Task 8（middleware）
- §5 環境変数 → Task 11（.env.example）+ Task 13（Vercel env 設定）
- §6 既存 Asset 紐付け → Task 10（script）+ Task 15/18（実行）
- §7 リリース手順 → Task 12（Google OAuth setup）+ Task 13（Vercel env）+ Task 17/18（deploy + 移行）
- §8 ロールバック → Task 0（phase-a9-stable タグ）で完了
- §9 スコープ外 → Phase A.11+ に明記
- §10 テスト戦略 → Task 14（local）+ Task 18（prod）+ Task 18.5（whitelist）

**2. Placeholder scan:** "TBD" / "TODO" / "implement later" / 抽象的な「適切に」 — なし。全コードは完全提示、コマンドも具体。

**3. Type consistency:**
- `CurrentUser` interface (Task 9) は Phase A.8 stub と互換性ある形で plan/email を追加
- `authConfig` (Task 4) と完全 config (Task 5) で `signIn` callback と `authorized` callback の型整合性 OK
- `session.user.id` / `session.user.plan` は Task 3 で型拡張済、Task 5 callback 内で代入、Task 9 で読取 → 一気通貫

OK, 整合済。

---

## 完了の定義

以下が全て満たされたら本プランを「完了」とみなす:
- Task 0〜20 すべて完了
- 本番 `https://autobanner.jp/` で Google SSO ログイン成功
- 既存勝ちバナー / 商品画像 / バッジが引き続き利用可能
- ALLOWED_EMAILS 外メアドでアクセス拒否確認
- BASIC_AUTH_USER / PASSWORD env 削除済み
- メモリファイルに Phase A.10 完了記録
