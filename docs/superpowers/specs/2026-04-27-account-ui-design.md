# Phase A.11.0-A.11.2: アカウント基盤 + ヘッダー + マイページ 設計書

**作成日:** 2026-04-27
**ステータス:** ブレインストーミング完了 / 実装プラン作成前
**前提:** Phase A.10（NextAuth.js v5 + Google SSO）本番動作確認済み
**配置場所:** `docs/superpowers/specs/2026-04-27-account-ui-design.md`

---

## 1. 背景・目的

事業計画書 v2 で定義した Phase A.11 拡張版（Plan model + 機能gate + 使用回数 + クレジット可視化 + デバイスグループ + AI解説タグ + Brand Kit基本 + ヘッダーUI）を、実装単位で 3 つのスプリントに分割する。本 spec はそのうち最初の 3 スプリント（A.11.0〜A.11.2）を扱う。

### 1.1 ユーザー要望（明示)

- 現在ログイン中であることが明確にわかるようにする
- 選択中のプランがトップページのマイアカウントアイコンの横に表示される
- アカウントアイコンは Google のものを利用
- アイコンクリックでマイページに遷移
  - ユーザー名 / 利用開始年月日 / 現在選択中のプランと利用状況 / プランのアップ・ダウングレードボタン / 「一般的に必要な機能」

### 1.2 本 spec のスコープ

- **Phase A.11.0**: User schema 拡張 + Session callback 拡張（DB基盤、UI変化なし）
- **Phase A.11.1**: 共有 Header コンポーネント実装（ironclad ページに反映 + 新ルートでも再利用可能）
- **Phase A.11.2**: `/account` マイアカウントページ（プロフィール / プラン / セキュリティ）

### 1.3 本 spec のスコープ外（次フェーズ）

- Stripe 連携全般 → Phase A.12
- 機能 gate（`assertCanGenerate` 等の上限チェック）→ Phase A.11.3
- Brand Kit / AI解説タグ → Phase A.11.3〜A.11.4
- Generation 履歴 / 再生成 / お気に入り → Phase A.11.5
- アカウント論理削除・即時削除 → 運営側手動対応（mailto 経由）
- E2E テストフレーム導入 → 別途検討

---

## 2. アーキテクチャ全体像

```
[A.11.0 DB]                  [A.11.1 UI: Header]               [A.11.2 UI: My Page]
────────────────             ────────────────────             ────────────────────
User schema 拡張       →     共有 Header.tsx 新設       →    /account ルート新設
Session callback 拡張        既存 ironclad ページに導入        プロフィール（編集可）
getCurrentUser() 拡張        UserMenu / PlanPill 切出           プラン（情報＋使用状況）
usage helper 実装            未ログイン挙動                    セキュリティ（削除依頼）
/api/ironclad-generate
  への組込
```

### 2.1 後続フェーズへの接続点（穴を空けておく）

- `User.stripeCustomerId` / `stripeSubscriptionId` カラムを A.11.0 で空 NULL で追加 → Phase A.12 着手時に schema 変更不要
- 「アップグレード」ボタンは `<UpgradeModal />` で「準備中」表示 → A.12 着手時にここを書き換える 1 箇所
- マイページの「請求」セクションは今回未実装 → A.13 で Stripe Customer Portal リンクを追加する形で拡張
- `usage helper` を A.11.0 で `/api/ironclad-generate` に組込 → A.11.3 の機能 gate でこの値を読むだけで完結

---

## 3. Phase A.11.0: DB Schema + Session 拡張

### 3.1 User テーブル追加カラム

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?              // Google 提供の name（既存）
  email         String    @unique    // 既存
  emailVerified DateTime?            // 既存
  image         String?              // Google アバターURL（既存）
  plan          String    @default("free")  // 既存

  // 🆕 Phase A.11.0 で追加
  nameOverride          String?       // ユーザー編集後の表示名（NULL なら name を使う）
  planStartedAt         DateTime?     // 現在プランの開始日
  planExpiresAt         DateTime?     // 有料プラン期限（free/admin は NULL）
  stripeCustomerId      String?  @unique  // A.12 で利用、今は NULL
  stripeSubscriptionId  String?  @unique  // 同上
  usageCount            Int       @default(0)   // 当月使用回数（lazy reset）
  usageResetAt          DateTime?     // 次回リセット日時（NULL なら初回アクセス時にセット）

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  assets        Asset[]

  @@index([stripeCustomerId])
}
```

### 3.2 設計判断

- `nameOverride`: NULL = Google 名そのまま使用、入力あり = それを優先表示。表示時の優先順位は `user.nameOverride ?? user.name ?? "ユーザー"`。この計算は `getCurrentUser()` 内で 1 回行い、`CurrentUser.displayName` として返す（呼び出し側で重複計算しない）
- `planStartedAt`: 既存ユーザーは migration 時に `createdAt` を初期値として埋める
- `usageResetAt`: NULL なら「最初の生成時にセット」する lazy 初期化、cron 不要
- `stripeCustomerId / SubscriptionId`: ユニーク制約で Stripe 重複登録を物理的に防ぐ
- `usageLimit` は DB に持たず plan からマッピング関数で導出（プラン定義変更時に 1 箇所修正で済む）。マッピングは `src/lib/plans/limits.ts` に集約

### 3.3 Migration 戦略

1. `pnpm prisma migrate dev --name phase_a11_0_user_extensions` でローカル migration ファイル生成
2. 既存ユーザー初期値埋め込み（同 migration ファイル内に SQL 追記）:
   ```sql
   UPDATE "User" SET "planStartedAt" = "createdAt" WHERE "planStartedAt" IS NULL;
   ```
3. Vercel/Neon 本番反映: `prisma migrate deploy` を Vercel ビルド時に実行（既存運用と同じ）

### 3.4 ロールバック計画

- `phase-a10-stable` git tag を起点にしたブランチ（`feat/phase-a11-account-ui`）で作業
- 問題発生時はタグ起点に戻す
- Schema は追加のみ（既存カラム削除なし）なのでアプリ側コード旧バージョンとも互換

### 3.5 Session / JWT 拡張

`src/lib/auth/auth.ts` の jwt callback に追加フィールドを載せる：

```ts
async jwt({ token, user, trigger }) {
  if (user) {
    token.id = user.id;
    // 既存 admin 判定ロジックは維持
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const isAdmin = !!user.email && adminEmails.includes(user.email);
    token.plan = isAdmin ? 'admin' : ((user as { plan?: string }).plan ?? 'free');
    // 🆕 追加
    token.nameOverride = (user as any).nameOverride ?? null;
    token.planStartedAt = (user as any).planStartedAt ?? null;
    token.planExpiresAt = (user as any).planExpiresAt ?? null;
    token.usageCount = (user as any).usageCount ?? 0;
    token.usageResetAt = (user as any).usageResetAt ?? null;
  } else if (trigger === 'update' && token.email) {
    const dbUser = await prisma.user.findUnique({ where: { email: token.email as string } });
    if (dbUser) {
      token.plan = dbUser.plan;
      token.nameOverride = dbUser.nameOverride;
      token.planStartedAt = dbUser.planStartedAt;
      token.planExpiresAt = dbUser.planExpiresAt;
      token.usageCount = dbUser.usageCount;
      token.usageResetAt = dbUser.usageResetAt;
    }
  }
  return token;
}

async session({ session, token }) {
  if (session.user && token) {
    session.user.id = (token.id as string) ?? '';
    session.user.plan = (token.plan as string) ?? 'free';
    // 🆕 追加
    session.user.nameOverride = (token.nameOverride as string | null) ?? null;
    session.user.planStartedAt = (token.planStartedAt as string | null) ?? null;
    session.user.planExpiresAt = (token.planExpiresAt as string | null) ?? null;
    session.user.usageCount = (token.usageCount as number) ?? 0;
    session.user.usageResetAt = (token.usageResetAt as string | null) ?? null;
  }
  return session;
}
```

`src/types/next-auth.d.ts` で Session 型を拡張：

```ts
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      plan: string;
      nameOverride: string | null;
      planStartedAt: string | null;
      planExpiresAt: string | null;
      usageCount: number;
      usageResetAt: string | null;
    };
  }
}
```

### 3.6 getCurrentUser() 拡張

```ts
// src/lib/auth/get-current-user.ts
export interface CurrentUser {
  userId: string | null;
  email: string | null;
  plan: string;
  // 🆕 追加
  displayName: string;          // nameOverride ?? name ?? "ユーザー"
  image: string | null;          // Google アバター
  planStartedAt: Date | null;
  planExpiresAt: Date | null;
  usageCount: number;
  usageLimit: number;            // plan から導出
  usageResetAt: Date | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      userId: null, email: null, plan: 'free',
      displayName: 'ゲスト', image: null,
      planStartedAt: null, planExpiresAt: null,
      usageCount: 0, usageLimit: 0, usageResetAt: null,
    };
  }
  const u = session.user;
  return {
    userId: u.id,
    email: u.email ?? null,
    plan: u.plan ?? 'free',
    displayName: u.nameOverride ?? u.name ?? 'ユーザー',
    image: u.image ?? null,
    planStartedAt: u.planStartedAt ? new Date(u.planStartedAt) : null,
    planExpiresAt: u.planExpiresAt ? new Date(u.planExpiresAt) : null,
    usageCount: u.usageCount ?? 0,
    usageLimit: getUsageLimit(u.plan ?? 'free'),
    usageResetAt: u.usageResetAt ? new Date(u.usageResetAt) : null,
  };
}
```

### 3.7 プラン制限マッピング

```ts
// src/lib/plans/limits.ts
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

### 3.8 使用回数カウントアップ + Lazy Reset

```ts
// src/lib/plans/usage.ts
import { getPrisma } from '@/lib/prisma';

const prisma = getPrisma();

function nextMonthStart(now: Date): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function incrementUsage(userId: string): Promise<void> {
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  if (user.usageResetAt && now >= user.usageResetAt) {
    // 期限切れ: リセットして今回分を 1 にセット
    await prisma.user.update({
      where: { id: userId },
      data: { usageCount: 1, usageResetAt: nextMonthStart(now) },
    });
  } else {
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

### 3.9 既存 API への組込

`/api/ironclad-generate/route.ts` の成功パス末尾で `await incrementUsage(userId)` を呼ぶ。失敗時は呼ばない（実生成が成功した時だけカウント）。

---

## 4. Phase A.11.1: 共有 Header コンポーネント

### 4.1 ファイル配置

```
src/components/layout/
├── Header.tsx              # 共有 Header（Server Component）
├── UserMenu.tsx            # アバター + ドロップダウン（Client Component）
└── PlanPill.tsx            # プラン Pill 単体（再利用想定）
```

### 4.2 Header API

```tsx
interface HeaderProps {
  /** ヘッダー右側に差し込むスロット（StepIndicator 等のページ固有UI） */
  rightSlot?: React.ReactNode;
}

export async function Header({ rightSlot }: HeaderProps) {
  const user = await getCurrentUser();
  // ... markup
}
```

Server Component で実装。クライアント JS 不要 = 初期表示が速い + セッション情報を SSR で取得済み。

### 4.3 マークアップ構造

```tsx
<header className="border-b border-slate-800 px-6 py-4 sticky top-0 bg-neutral-950 z-40">
  <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
    <Link href="/" className="text-xl font-bold tracking-tight">
      <span className="text-teal-400">勝ちバナー</span>作る君
    </Link>
    <div className="flex-1 flex justify-center">{rightSlot}</div>
    <div className="flex items-center gap-3">
      <PlanPill plan={user.plan} />
      <UserMenu user={user} />
    </div>
  </div>
</header>
```

### 4.4 PlanPill コンポーネント

```tsx
const PLAN_STYLES: Record<string, { label: string; className: string }> = {
  free:    { label: 'Free',    className: 'bg-slate-700 text-slate-200' },
  starter: { label: 'Starter', className: 'bg-teal-600 text-white' },
  pro:     { label: 'Pro',     className: 'bg-amber-500 text-amber-950' },
  admin:   { label: 'Admin',   className: 'bg-purple-600 text-white' },
};

export function PlanPill({ plan }: { plan: string }) {
  const style = PLAN_STYLES[plan] ?? PLAN_STYLES.free;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}
```

未知の plan 値は free にフォールバック（DB に異常値混入時の防御）。

### 4.5 UserMenu（アバター + ドロップダウン）

**ログイン時の挙動**:
- アバター画像: 素の `<img src={user.image} width={28} height={28} className="rounded-full" />` を使用（next/image は使わない。28x28 サイズで最適化メリット小、`next.config.ts` の `remotePatterns` 設定不要にして実装をシンプルに保つ）
- 画像 fetch 失敗時は `<img>` の `onError` で lucide-react の `<UserCircle />` グレーアイコンに切替
- アバタークリックで開閉、外側クリック / ESC で閉じる
- ARIA: `aria-haspopup="menu" aria-expanded`, ドロップダウン本体は `role="menu"`, 各項目は `role="menuitem"`

ドロップダウン構造:

```
┌──────────────────────────┐
│  小池 慧                 │  ← font-semibold
│  str.kk.co@gmail.com    │  ← text-xs text-slate-400
│  [Pro]                   │  ← PlanPill 流用
├──────────────────────────┤
│ 👤 マイアカウント         │  ← Link href="/account"
│ 💳 プラン変更             │  ← Link href="/account#plan"
├──────────────────────────┤
│ ↪ サインアウト            │  ← signOut() 呼び出し
└──────────────────────────┘
```

**未ログイン時の挙動**:
- `<Link href="/signin"><UserCircle className="w-7 h-7 text-slate-500" /></Link>`
- ドロップダウンなし、クリック → `/signin` 直行
- PlanPill は `Free` 表示

### 4.6 既存 ironclad ページへの統合

`src/app/page.tsx` の現状ヘッダー部分（90〜103行目）を削除し、新コンポーネントに置換：

```tsx
import { Header } from '@/components/layout/Header';

// 変更後
<Header rightSlot={<StepIndicatorRow current={step} />} />
```

`StepIndicatorRow` は ironclad ページ内で定義する小コンポーネント（既存 `StepIndicator` を 3 つ並べる役割）。

### 4.7 モバイル対応（最低限）

- max-w-5xl は維持、画面幅 < 640px では:
  - StepIndicator はラベル省略してナンバーのみ（`1 → 2 → 3`）
  - メール表示はドロップダウン内のみ
  - ロゴはフル表示維持
- `flex-wrap` は使わず横スクロール許容（マイページ用 PC 前提なので）

### 4.8 Next.js 設定

このフェーズでは `next.config.ts` 変更不要（4.5 で `<img>` 採用のため `remotePatterns` 設定不要）。将来 `next/image` を本格導入する場合は別途検討。

---

## 5. Phase A.11.2: マイアカウントページ（`/account`）

### 5.1 ファイル配置

```
src/app/account/
├── page.tsx                # マイアカウント本体（Server Component）
├── PlanSection.tsx         # プラン情報＋使用状況＋アップグレードボタン
├── ProfileSection.tsx      # プロフィール編集（Client Component, インライン編集）
├── SecuritySection.tsx     # サインアウト + 削除依頼
└── UpgradeModal.tsx        # 「準備中」モーダル（Client Component）

src/app/api/account/
└── name/route.ts           # PUT: nameOverride 更新
```

### 5.2 ルートと認証

- `/account` は middleware で認証必須（既存 middleware の対象範囲内）
- 未ログイン時は middleware が `/signin?callbackUrl=/account` に飛ばす（既存挙動）
- `page.tsx` 内でも保険として `redirect('/signin?callbackUrl=/account')` を実行

### 5.3 ページレイアウト

```tsx
// src/app/account/page.tsx (Server Component)
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user.userId) redirect('/signin?callbackUrl=/account');

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

各セクション間は `space-y-12`（48px）、見出しは `text-lg font-semibold border-b border-slate-800 pb-2`。

### 5.4 ProfileSection

```
┌─ プロフィール ─────────────────────────┐
│  [👤画像]  小池 慧 ✏                  │
│                                         │
│  メールアドレス                         │
│  str.kk.co@gmail.com (変更不可)         │
│                                         │
│  利用開始日                             │
│  2026-04-15                             │
└─────────────────────────────────────────┘
```

**インライン編集挙動**:
- 表示時: `名前 + ✏ アイコン`、✏ クリックで `<input>` に切替
- input フォーカス + Enter で保存（PUT `/api/account/name`）/ ESC でキャンセル
- 保存中はスピナー表示、エラーは行下に赤字
- 楽観更新せず、API 成功で UI 更新（一致性優先）
- バリデーション: 1〜50文字、空白のみ NG

API 仕様:
```
PUT /api/account/name
Body: { name: string }
- 空文字 → User.nameOverride = NULL（Google 名に戻す）
- 1〜50文字 → User.nameOverride = name
- 51文字以上 or 空白のみ → 400 Bad Request
- session 必須、自分の User row のみ更新可
```

### 5.5 PlanSection

```
┌─ プラン ───────────────────────────────────────┐  id="plan"
│                                                 │
│  現在のプラン      [Pro]                        │
│  利用開始日       2026-04-15                    │
│  次回更新日       2026-05-15  ※有料時のみ      │
│                                                 │
│  今月の使用状況                                 │
│  ▓▓▓▓▓▓░░░░░░░░░░  12 / 100 回                │
│  リセット日: 2026-05-01                         │
│                                                 │
│  [アップグレード]  [ダウングレード]            │
└─────────────────────────────────────────────────┘
```

**設計判断**:
- プログレスバー: Tailwind の `<div>` 重ね合わせ。`(usageCount / usageLimit) * 100%` で width 計算
- 80%超で teal → amber、100% で red に色変化
- admin ユーザーは「無制限」と表示（プログレスバーは描画しない）
- 「次回更新日」: `planExpiresAt` が NULL なら非表示
- アップグレード/ダウングレードボタン: 押下で `<UpgradeModal />` 表示

### 5.6 UpgradeModal（準備中）

```tsx
// src/app/account/UpgradeModal.tsx (Client Component)
function UpgradeModal({ open, onClose, type }: { open: boolean; onClose: () => void; type: 'upgrade' | 'downgrade' }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <h2>プラン変更機能、まもなく公開予定です</h2>
      <p>
        Stripe 決済対応中（Phase A.12）。完成までしばらくお待ちください。
        メールでお知らせをご希望の方は、
        <a href="mailto:str.kk.co@gmail.com">こちら</a> までご一報ください。
      </p>
      <button onClick={onClose}>閉じる</button>
    </Dialog>
  );
}
```

**意図**: 機能はある（押せる）が今は使えない感を演出 + メアド連絡の窓口を残す。Phase A.12 着手時にここを Stripe Checkout 呼び出しに書き換え。

### 5.7 SecuritySection

```
┌─ セキュリティ ─────────────────────────────────┐
│                                                 │
│  サインアウト                                   │
│  すべてのデバイスからサインアウトします          │
│  [サインアウト]                                 │
│                                                 │
│  アカウント削除依頼                             │
│  アカウント情報と素材を削除する場合は           │
│  運営にメールでご連絡ください                   │
│  [削除を依頼する]                               │
└─────────────────────────────────────────────────┘
```

**設計判断**:
- サインアウトボタン: NextAuth の `signOut({ callbackUrl: '/signin' })` を呼ぶ Client Component
- 削除依頼ボタン: `mailto:` リンクで運営宛にメール起動
  - 宛先: `str.kk.co@gmail.com`（運営代表メアド）
  - 件名: `[勝ちバナー作る君] アカウント削除依頼: <user.email>`
  - 本文ひな型: `アカウント削除を依頼します。\n\nメール: <user.email>\nユーザーID: <user.id>\n\n削除理由（任意）: \n`
  - mailto エンコードは `encodeURIComponent` で適切に処理

### 5.8 マイページ用 API

| API | Method | 用途 | 認証 |
|---|---|---|---|
| `/api/account/name` | PUT | nameOverride 更新 | session 必須 |

`/api/account/me` は今回スコープでは作らない（Server Component で SSR 取得すれば足りる）。後で「クライアント側で再取得したい」ニーズが出たら追加。

### 5.9 エラー処理

- 認証切れ（session 期限）: `getCurrentUser()` の戻り値で `userId === null` になる → middleware が `/signin` にリダイレクト（既に対応済）
- API エラー（名前更新失敗等）: フォーム下に赤字でメッセージ表示、再試行可能
- 画像取得失敗: `<UserCircle />` フォールバックで継続表示
- DB エラー: ページ全体は `error.tsx` でラップ（既存 Next.js 標準）

---

## 6. 検証戦略（手動 E2E）

プロジェクトはテストフレームワーク未導入のため、各タスクは「TypeScript ビルド通過 + 段階手動確認」で検証する。Phase A.10 と同じ方式。

### 6.1 Phase A.11.0 検証チェックリスト

- [ ] `pnpm prisma migrate dev` 成功 → schema 反映確認
- [ ] migration 内の SQL（`UPDATE "User" SET "planStartedAt" = "createdAt"`）が既存ユーザーに適用される
- [ ] 既存 admin ユーザーで signin → `getCurrentUser()` が新フィールド全て正しい型で返る
- [ ] `/api/ironclad-generate` 成功時に `usageCount` が +1 される（DB 直接確認）
- [ ] 翌月相当の日時を手動で `usageResetAt` に書き換えて生成 → `usageCount` が 1 にリセットされる
- [ ] TypeScript ビルド `pnpm build` がエラーなく通る

### 6.2 Phase A.11.1 検証チェックリスト

- [ ] ironclad ページのヘッダーが共有 Header に置換される（StepIndicator 動作維持）
- [ ] アバター画像が Google プロフィール画像で表示される
- [ ] アバタークリック → ドロップダウン展開 → 「マイアカウント」「プラン変更」「サインアウト」表示
- [ ] サインアウト動作 → `/signin` へリダイレクト
- [ ] 未ログイン状態でグレーアバター表示・クリックで `/signin` 遷移
- [ ] PlanPill が `admin` で紫、`free` でグレー、`pro` でゴールド表示
- [ ] スマホ幅（375px）で StepIndicator が崩れず数字のみ表示
- [ ] TypeScript ビルド `pnpm build` がエラーなく通る

### 6.3 Phase A.11.2 検証チェックリスト

- [ ] `/account` 直アクセス（未ログイン）→ `/signin?callbackUrl=/account` へ
- [ ] ログイン後 `/account` 表示、3 セクション全て描画
- [ ] プロフィール: ✏ クリックで input 切替、Enter で保存、画面リロード後も反映継続
- [ ] プロフィール: 51文字超 / 空白のみ で 400 エラー、UI に赤字表示
- [ ] プロフィール: 空文字保存で `nameOverride` が NULL に戻り、Google 名表示に戻る
- [ ] プラン: 利用開始日 / 次回更新日 / プログレスバーが正しい値で表示
- [ ] プラン: admin ユーザーで「無制限」表示、プログレスバー非描画
- [ ] アップグレード/ダウングレードボタン → 「準備中」モーダル表示、閉じるボタンで閉じる
- [ ] サインアウトボタン → `/signin` へ
- [ ] 削除依頼ボタン → `mailto:` でメーラー起動、宛先・件名・本文に必要情報入る
- [ ] TypeScript ビルド `pnpm build` がエラーなく通る

---

## 7. リスクとロールバック

| リスク | 対策 |
|---|---|
| Migration 失敗で本番 DB 破損 | `phase-a10-stable` git tag で起点保護 + Neon Postgres のポイントインタイム復元（最大7日） |
| Session callback 拡張で既存ログイン全切断 | 既存 free/admin ユーザーで先に手動検証 → 問題なければ deploy。JWT トークンは古い形式でも `?? null` フォールバックで対応 |
| usageCount のラッシュ更新で race condition | Prisma の `{ increment: 1 }` は SQL 原子操作、複数同時生成でも整合 |
| Header sticky で既存ページのスクロール挙動破壊 | bg-neutral-950 完全不透明、z-index は 40 で固定、検証時に各ページで挙動確認 |
| アバター画像 fetch 失敗 | `<img>` の `onError` で `<UserCircle />` フォールバック表示 |
| インライン編集中に session 切れ | API が 401 を返す → UI で「再ログインしてください」赤字表示 |

---

## 8. 実装順序とチェックポイント

```
A.11.0 (3日想定)
├── Day 1: schema + migration + Session callback 拡張
├── Day 2: getCurrentUser 拡張 + usage helper 実装 + API 組込
└── Day 3: 手動検証 + admin ユーザーで動作確認 → main マージ

A.11.1 (2日想定)
├── Day 1: Header / PlanPill / UserMenu 実装、ironclad ページ統合
└── Day 2: 未ログイン挙動 + モバイル + 検証 → main マージ

A.11.2 (3日想定)
├── Day 1: /account ルート + ProfileSection（インライン編集 + API）
├── Day 2: PlanSection + UpgradeModal + SecuritySection
└── Day 3: 検証 + 仕上げ → main マージ

合計: 約 8 日（予定 5〜8 日に収まる）
```

各フェーズの完了は別 PR として段階的にマージ。途中段階でも本番に出る形（部分的な完成度でも UI が破綻しない順序）。

---

## 9. 完了の定義（Phase A.11.0-A.11.2 全体）

以下が全て満たされたら本 spec は完了：

1. 既存・新規ユーザー全員が Google SSO ログイン後、ヘッダー右上に Google アバター + プラン Pill が表示される
2. アバタークリックでドロップダウン展開、マイアカウントへの導線が機能する
3. `/account` で プロフィール編集 / プラン情報 / 使用状況プログレスバー / サインアウト / 削除依頼 が動作する
4. `/api/ironclad-generate` 実行ごとに `usageCount` が +1 され、月初に lazy reset される
5. 全ての変更が `pnpm build` を通過し、本番 Vercel 環境で動作する
6. Phase A.12 着手時に schema 変更不要（`stripeCustomerId` 等が既に存在する状態）

---

## 付録 A: 議論経緯（Q&A サマリ）

| 議題 | 結論 |
|---|---|
| マイページのルート | `/account`（業界標準・GitHub/Stripe/Vercel 採用） |
| ヘッダー実装範囲 | 共有 Header コンポーネント新設 + 全ページで再利用 |
| 使用回数カウンタ | User テーブル直接カラム + lazy reset（cron 不要） |
| User 追加カラム範囲 | 全部今回（A.11.0 で）追加 + nameOverride も含める |
| マイページ構成 | 案1（単一ページ・3 セクション） |
| アップグレードボタン挙動 | a（「準備中」モーダル表示）|
| アカウント削除挙動 | iii（mailto で運営に削除依頼メール送信）|
| プラン Pill 配色 | Free=グレー / Starter=ティール / Pro=ゴールド / Admin=紫 |
| アバタークリック挙動 | ドロップダウン経由（1 クッション） |
| 未ログイン時のヘッダー | 含める（Free Pill + グレー人型アイコン）|
| 未ログイン時のアイコンクリック | A（`/signin` 直行） |
| 名前編集 UX | A（インライン編集） |
| モバイル対応 | B（最低限・StepIndicator 数字のみ等） |
| 使用回数 API 組込タイミング | a（A.11.0 で `/api/ironclad-generate` に組込） |
| 削除依頼 UI | mailto（API + Formspree は不採用、運営側手動受付）|
