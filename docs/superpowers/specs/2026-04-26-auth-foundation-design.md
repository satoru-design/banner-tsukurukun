# Phase A.10: 認証基盤刷新 設計書

**作成日:** 2026-04-26
**ステータス:** ブレインストーミング完了 / 実装プラン作成前
**前提:** Phase A.9（コピースキップ機能）本番動作確認済み
**配置場所:** `docs/superpowers/specs/2026-04-26-auth-foundation-design.md`

---

## 1. 背景・目的

現状の Basic Auth（`koike` / `banner2026`）では SaaS 顧客対応不可。Phase A.10 で **NextAuth.js v5（Google SSO）** に全面切替し、User テーブルを新設して `plan` カラムで admin/free 区別の基盤を作る。Phase A.11 以降の plan/usage gate ロジックの土台。

---

## 2. 採用技術

- **NextAuth.js v5（Auth.js）** + Prisma adapter
- Google OAuth Provider
- Vercel deploy + Neon Postgres + Prisma 7

理由:
- 完全無料 OSS、Vercel と相性最強
- Prisma adapter 公式提供 → User/Account/Session を DB 自動管理
- Google SSO は env 設定 5 分で動く
- Phase A.11 で User テーブルを自由拡張可能（Stripe customerId 等）

---

## 3. データモデル（Prisma 追加）

```prisma
// NextAuth.js v5 標準テーブル + Phase A.10 拡張
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

model Account {
  id                       String  @id @default(cuid())
  userId                   String
  type                     String
  provider                 String
  providerAccountId        String
  refresh_token            String? @db.Text
  access_token             String? @db.Text
  expires_at               Int?
  token_type               String?
  scope                    String?
  id_token                 String? @db.Text
  session_state            String?

  user                     User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**Asset への変更:**
- 既存 `userId String?` をそのまま使用
- `user User? @relation(fields: [userId], references: [id])` 追加（Phase A.8 で仕込み済の userId カラムを正式リレーション化）

**Migration 名:** `add_auth_tables_and_user_relation`

---

## 4. アクセス制御ロジック

### 4.1 ログイン時の plan 自動付与
```
NextAuth signIn callback:
- email ∈ ADMIN_EMAILS env (例: str.kk.co@gmail.com) → plan='admin'
- それ以外 → plan='free' (default)
```

### 4.2 ログイン許可（ホワイトリスト制）
```
NextAuth signIn callback:
- ALLOWED_EMAILS env が空 → 誰でもログイン可（A.15 公開時の状態）
- ALLOWED_EMAILS env が設定あり、email がリストに含まれる → ログイン可
- それ以外 → return false → エラーページ /signin?error=AccessDenied
```

### 4.3 ルート保護（middleware 刷新）

```
公開パス（無認証OK）:
- /api/auth/*       (NextAuth エンドポイント)
- /_next/*          (Next.js 内部)
- /favicon.ico
- /signin           (NextAuth サインインページ)
- /lp01, /lp02, ... (Phase A.15 で実装する LP・予約)

認証必須:
- それ以外（/, /api/winning-banners 等のアプリ全体）
- 未ログインなら → /signin にリダイレクト
```

---

## 5. 環境変数

### 追加
```env
# Google OAuth (Google Cloud Console で発行)
AUTH_GOOGLE_ID=xxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-xxx

# NextAuth.js セッション暗号化キー (npx auth secret で生成)
AUTH_SECRET=（32文字以上のランダム文字列）

# admin 自動付与（カンマ区切り、複数可）
ADMIN_EMAILS=str.kk.co@gmail.com

# ベータ期間ホワイトリスト（カンマ区切り、空にすると全公開）
ALLOWED_EMAILS=str.kk.co@gmail.com
```

### 削除
```env
# Phase A.10 で廃止
BASIC_AUTH_USER  ← 削除
BASIC_AUTH_PASSWORD  ← 削除
```

### 適用先
- Vercel: Production / Preview / Development すべて
- ローカル `.env`

---

## 6. 既存 Asset の admin 紐付け（Migration）

```typescript
// scripts/migrate-assets-to-admin.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(',')[0]?.trim();

async function main() {
  if (!ADMIN_EMAIL) {
    throw new Error('ADMIN_EMAILS env not set');
  }
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(
      `Admin user not found. Login first via /signin with ${ADMIN_EMAIL}.`,
    );
  }

  const result = await prisma.asset.updateMany({
    where: { userId: null },
    data: { userId: admin.id },
  });

  console.log(`Migrated ${result.count} assets to admin (${admin.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

実行タイミング:
1. デプロイ完了後
2. 小池さん初回ログインで User row 作成
3. ローカルで `DATABASE_URL=<本番URL> npx tsx scripts/migrate-assets-to-admin.ts` 実行
4. 1度だけ実行・以後不要

---

## 7. リリース手順（手順書）

### 7.1 事前準備（小池さん作業・約10分）
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成 or 既存選択
2. 「APIとサービス」→「認証情報」→「OAuth 2.0 クライアント ID」を作成
3. Authorized redirect URIs に以下追加:
   - `http://localhost:3000/api/auth/callback/google` (開発用)
   - `https://autobanner.jp/api/auth/callback/google` (本番用)
4. AUTH_GOOGLE_ID と AUTH_GOOGLE_SECRET を取得・控える

### 7.2 自動セットアップ（Claude実行・約10分）
1. NextAuth.js v5 + Prisma adapter インストール
2. `auth.ts` / `auth.config.ts` 作成
3. `src/app/api/auth/[...nextauth]/route.ts` 作成
4. middleware.ts を SSO 版に書き換え
5. Prisma schema 更新 + migration
6. `getCurrentUser()` を NextAuth セッションから読み取る実装に変更
7. ローカルビルド確認

### 7.3 デプロイ（小池さん + Claude）
1. Vercel env 追加（小池さん作業 or Claude が CLI 経由）
   - AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET, ADMIN_EMAILS, ALLOWED_EMAILS
   - Phase A.10 完了まで BASIC_AUTH_USER / PASSWORD は残す（保険）
2. main マージ・push
3. Vercel 自動デプロイ完了待ち

### 7.4 初回ログイン + 移行（小池さん作業）
1. `https://autobanner.jp/signin` でログインボタン押下
2. Google アカウント `str.kk.co@gmail.com` 選択
3. ログイン成功後、admin プランが自動付与されることを Vercel Logs で確認
4. ローカルで `DATABASE_URL=<本番> npx tsx scripts/migrate-assets-to-admin.ts` 実行
5. アプリ画面で既存勝ちバナーが見える確認
6. STEP 1-3 の通常生成が動作確認
7. すべて OK なら Vercel env から `BASIC_AUTH_USER` / `PASSWORD` 削除

---

## 8. ロールバック

| レベル | 操作 | 所要時間 | 効果 |
|---|---|---|---|
| **L1** | `ALLOWED_EMAILS` を厳格化 | 即座 | 招かれざる客のログインを即停止 |
| **L2** | Vercel env で BASIC_AUTH_USER/PASSWORD 復活 + middleware を git revert | 1-2分 | Basic Auth 復活、SSO 機能停止 |
| **L3** | `git checkout phase-a9-stable` + redeploy | 数分 | Phase A.9 状態に完全復帰 |

着手前に `git tag phase-a9-stable` を切る → いつでも戻れる保険。

---

## 9. スコープ外（Phase A.11+ で対応）

| 機能 | Phase |
|---|---|
| Plan に応じた機能 gate（プロンプト閲覧・サイズ選択・勝ちバナー添付） | A.11 |
| 使用回数カウント（`currentMonthUsageCount`, `lifetimeFreeSessionsUsed`） | A.11 |
| 月初リセットロジック | A.11 |
| Stripe customerId 紐付け | A.12 |
| カスタムサインインページデザイン | A.13 |
| ユーザー個別の Asset library 分離 UI | A.13 |

Phase A.10 では「**認証フロー**」と「**plan カラム**」のみ確実に動かす。

---

## 10. テスト戦略

### 10.1 ローカルテスト
1. `.env` に AUTH_GOOGLE_ID/SECRET/AUTH_SECRET/ADMIN_EMAILS/ALLOWED_EMAILS 追加
2. `npm run dev` 起動
3. `http://localhost:3000` にアクセス → `/signin` リダイレクト確認
4. Google ログイン → admin 自動付与・既存挙動継続確認

### 10.2 本番テスト
1. デプロイ完了後 `https://autobanner.jp/` アクセス → サインインページ表示
2. Google ログイン → admin 自動付与
3. 既存勝ちバナー一覧表示 → migration 動作確認
4. STEP 1-3 通常生成 OK
5. ログアウト → 再ログイン → セッション保持

### 10.3 セキュリティ確認
1. ALLOWED_EMAILS 外のメアドでログイン試行 → エラーページ表示
2. ALLOWED_EMAILS 内の別メアドでログイン → plan='free' で User 作成
3. シークレットウィンドウでアクセス → /signin リダイレクト

---

## 11. 完了の定義

以下が満たされたら Phase A.10「完了」と判定:
- 小池さんが Google SSO でログイン成功・plan='admin' 確認
- 既存 Asset 全件が admin に紐付け完了
- Basic Auth 環境変数が削除済み（中間状態として保持しても可）
- ALLOWED_EMAILS 外メアドでアクセス拒否確認
- STEP 1-3 通常生成フロー動作確認
- ローカル/本番両方で動作確認

---

## 12. 残リスク・注意点

| リスク | 影響 | 緩和策 |
|---|---|---|
| Google OAuth credentials 設定ミス（redirect URI 等） | ログイン失敗 | 開発・本番両方の URL を redirect URI に追加。エラーは Vercel Logs に出る |
| AUTH_SECRET 未設定 | NextAuth 初期化失敗 | `npx auth secret` で生成、Vercel env に必ず追加 |
| Migration 順序ミス（ログイン前にスクリプト実行） | admin user not found エラー | 手順書に「ログイン後実行」明記、スクリプトも親切エラー出力 |
| User table 追加で既存 Prisma client が古い | ビルド失敗 | `npx prisma generate` を migration 後に必ず実行（既存パターン） |
| ALLOWED_EMAILS 漏れで自分が締め出される | 自分がログインできない | デプロイ前に env 確認、最低 admin メアドが含まれることを2重確認 |

---

## 付録 A: 設計判断の経緯（Q&A サマリ）

| Q | 採用案 | 理由 |
|---|---|---|
| Q1 認証ライブラリ | NextAuth.js v5 | 無料・Prisma 統合・Vercel 相性最強 |
| Q2 Phase スコープ | B（認証 + admin フラグ） | DB に admin/free 区別の基盤を仕込みつつ機能 gate は A.11 へ |
| Q3 既存 Asset 移行 | A（migration スクリプト） | クリーン・以後 NULL レコードゼロ |
| Q4 ログイン許可 | A（ホワイトリスト制 ALLOWED_EMAILS） | ベータ期間中の安全性 + A.15 で env 削除のみで全公開可能 |
