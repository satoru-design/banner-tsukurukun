# Asset Library のユーザー別分離 + ラベル変更

**Date:** 2026-05-02
**Status:** Draft
**Author:** Satoru Koike (with Claude)

## 1. 目的

現状、`autobanner.jp` の Step 1 で全ユーザーに seed asset（5 Point Detox / GMP Quality / Australian Government Department of Health）が見えており、初回ログインしたユーザーにも自動選択されてしまう。顧客から「この素材を選択解除する操作も知らないまま使ってしまう」という問い合わせが入った。

本来 seed は「動作確認しやすいよう admin だけが使うもの」であり、一般ユーザーには空のコンテナで初回体験させ、2 回目以降は本人がアップした画像が自動選択される状態にしたい。あわせて UI ラベルの誤解（「認証バッジ」だと公的認証に限定される印象）を解消する。

## 2. ゴール

| # | 要件 | 達成条件 |
|---|------|----------|
| G1 | 初回ユーザーは Asset コンテナが空 | ログイン直後の Step 1 で `productAsset / badge1Asset / badge2Asset` が `null`、グリッドに「まだ素材がありません」と表示される |
| G2 | 2 回目以降のユーザーは前回アップ画像が自動選択 | 自分が過去にアップした最新 asset (product / badge) が `setProductAsset` / `setBadge1Asset` / `setBadge2Asset` に反映される |
| G3 | admin (`plan === 'admin'`) には seed asset が常時見える | `userId` が NULL の既存 seed と admin 自身がアップした asset が混在表示・選択可能 |
| G4 | UI ラベルを「認証・権威バッジ」に変更 | Step 1 の見出し 2 箇所が `🏅 認証・権威バッジ 1（任意）` / `🏆 認証・権威バッジ 2（任意）` に変わる |
| G5 | 副次的に asset の所有権分離が完了 | 他ユーザーの asset が GET で見えず、DELETE / PATCH もできない |

## 3. 非ゴール（YAGNI）

- 既存 seed asset (userId=NULL) を admin user の id へ backfill する migration は今回はやらない（C 案）。後日必要になれば一発スクリプトで足せる。
- Asset を「全社員共有」「team 共有」に拡張する仕組みは作らない。
- isPinned 機構の改修はしない（既存挙動を維持）。

## 4. アーキテクチャ

### 4.1 認可レイヤ（API）

`src/app/api/assets/route.ts` と `src/app/api/assets/[id]/route.ts` を以下に変更する。

**GET `/api/assets?type=...`**

```ts
const session = await auth();
if (!session?.user?.id) return 401;

const isAdmin = session.user.plan === 'admin';
const userFilter = isAdmin
  ? { OR: [{ userId: session.user.id }, { userId: null }] }  // admin は seed も見える
  : { userId: session.user.id };                              // 一般は自分のみ

const where = {
  ...(typeParam && isValidType(typeParam) ? { type: typeParam } : {}),
  ...userFilter,
};

const assets = await prisma.asset.findMany({
  where,
  orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
});
```

**POST `/api/assets`**

```ts
const session = await auth();
if (!session?.user?.id) return 401;

const created = await prisma.asset.create({
  data: { type, name, blobUrl, mimeType: mime, userId: session.user.id },
});
```

**DELETE / PATCH `/api/assets/[id]`**

```ts
const session = await auth();
if (!session?.user?.id) return 401;

const asset = await prisma.asset.findUnique({ where: { id } });
if (!asset) return 404;

const isAdmin = session.user.plan === 'admin';
const isOwner = asset.userId === session.user.id;
const isAdminOnSeed = isAdmin && asset.userId === null;

if (!isOwner && !isAdminOnSeed) return 403;
// 以降は既存処理
```

### 4.2 UI レイヤ（変更なし、ただしテキスト 2 箇所）

`src/components/ironclad/IroncladBriefForm.tsx`:

```diff
-        label="🏅 認証バッジ 1（任意）"
+        label="🏅 認証・権威バッジ 1（任意）"
...
-        label="🏆 認証バッジ 2（任意）"
+        label="🏆 認証・権威バッジ 2（任意）"
```

### 4.3 自動選択ロジック（変更なし）

`src/app/page.tsx:144-169` の `autoSelectLatest()` は**そのまま**。API のレスポンスが userId フィルタ済みになるだけで、

- 初回ユーザー: `assets.length === 0` → 何も自動選択されない → G1 達成
- 2 回目ユーザー: 自分の最新 asset が `assets[0]` に来る → 自動選択される → G2 達成
- admin: 自分の asset + seed (userId=null) が更新日時順で混ざる → seed も含めて自動選択候補 → G3 達成

## 5. データフロー

```
[Step 1 マウント]
    ↓
page.tsx autoSelectLatest()
    ↓ GET /api/assets?type=product / ?type=badge
    ↓
API: auth() → session.user.id 取得
    ↓
Prisma.asset.findMany({ where: { userId: session.user.id, type } })
  + admin の場合は userId: null も OR 追加
    ↓
[初回ユーザー] []  → setProductAsset 呼ばれない → 空のまま
[2回目ユーザー] [自分の最新, ...]  → assets[0] を自動選択
[admin] [自分のもの..., seed bottle_1, seed badge_gmp, seed badge_australia]
                       → 自分の最新（あれば）or seed が自動選択
```

## 6. セッション拡張

`session.user.plan` が型レベルで取れるかは `src/lib/auth/auth.ts` の callbacks 設定に依存する。実装時に `next-auth` 型拡張を確認し、必要なら `session.user.plan` を session callback で添付する。既存の `getCurrentUser()` 経由で plan が返っているので、サーバー側 API でも同じ経路で参照できるはず（実装時に再確認）。

## 7. テスト計画

### 7.1 手動テスト（Vercel Preview）

| ケース | 操作 | 期待 |
|--------|------|------|
| T1 | 新規ユーザーで Google ログイン | Step 1 の 3 コンテナがすべて空。「まだ素材がありません」表示 |
| T2 | T1 ユーザーが商品画像を 1 枚アップ → ステップ進行 → トップに戻る | アップした 1 枚が自動選択されている |
| T3 | T2 ユーザーが badge を 2 枚アップ → トップに戻る | badge1 = 最新、badge2 = 2 番目に最新が自動選択 |
| T4 | admin (str.kk.co@gmail.com) でログイン | seed 3 枚が見え、product / badge1 / badge2 に自動選択される |
| T5 | 一般ユーザー A で B の asset id を直接 GET | 401 or 自分の一覧に B の asset が含まれない |
| T6 | 一般ユーザー A で B の asset id を DELETE | 403 |
| T7 | admin が seed (userId=null) を DELETE | 200（admin だけは seed を消せる：ハウスキーピング用） |
| T8 | 任意のユーザーで Step 1 を見る | ラベル「認証・権威バッジ 1 / 2」になっている |

### 7.2 ロールバック計画

- API ファイル 2 つと UI ファイル 1 つの変更のみ。git revert 一発で戻せる。
- Schema / DB 変更なし。
- Vercel Blob への影響なし。

## 8. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| `session.user.plan` が型 / runtime で取れない | admin が seed を見られない | 実装時に `auth.ts` callbacks を確認。必要なら DB 直問い（`prisma.user.findUnique`）にフォールバック |
| 既存ユーザーの古いデータ（userId=NULL の Asset で本人がアップしたもの）が見えなくなる | UX 悪化 | 現状 seed 3 枚以外は userId=NULL の Asset は無いはず（Phase A.10 以降 POST されたものは userId 付き）。リリース前に `SELECT count(*) FROM "Asset" WHERE "userId" IS NULL` で確認 |
| admin が誤って seed を消す | seed 喪失 | 既存 DELETE 確認モーダルがそのまま機能。バックアップは Vercel Blob 側に残る |

## 9. 実装スコープ

変更ファイルは以下 3 つのみ:

1. `src/app/api/assets/route.ts` — GET / POST に auth + userId フィルタ
2. `src/app/api/assets/[id]/route.ts` — DELETE / PATCH に auth + 所有権チェック
3. `src/components/ironclad/IroncladBriefForm.tsx` — ラベル 2 箇所

## 10. リリース手順

1. Preview にデプロイ
2. T1〜T8 を手動確認
3. 本番リリース（`main` へ merge）
4. 顧客からの問い合わせ元 user に「修正済みです」と返信
