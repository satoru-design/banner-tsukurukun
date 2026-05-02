# Asset Library のユーザー別分離 + ラベル変更 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**作成日:** 2026-05-02
**Spec:** [docs/superpowers/specs/2026-05-02-asset-library-user-isolation-design.md](../specs/2026-05-02-asset-library-user-isolation-design.md)

**Goal:** `/api/assets` 系 3 エンドポイントに「ログイン必須 + userId フィルタ + admin の seed 例外」を追加し、初回ログインユーザーには空のコンテナ、2 回目以降は本人がアップした最新画像が自動選択される状態にする。あわせて Step 1 の UI ラベル「認証バッジ」を「認証・権威バッジ」に変更する。

**Architecture:** Asset テーブルには既に `userId String?` がある（schema 確認済）。API 側で `await auth()` から `session.user.id` / `session.user.plan` を取り出し、Prisma の `where` 句でフィルタするだけで完了。DB schema 変更なし、既存 seed (userId=NULL) は触らない（admin だけが OR 句で見える）。`page.tsx:144-169` の `autoSelectLatest()` ロジックは既存のまま流用。

**Tech Stack:** Next.js 16 (App Router), NextAuth v5 (`auth()` from `@/lib/auth/auth`), Prisma 7, TypeScript

**Test 方針:** プロジェクトはテストフレーム未導入。各タスクは「TypeScript ビルド成功 + 手動表示確認」で検証。最終確認は Vercel Preview 上で T1〜T8 を実機テスト。

---

## ファイル構成マップ

### 変更

| ファイル | 変更内容 |
|---|---|
| `src/app/api/assets/route.ts` | GET / POST に `await auth()` + userId フィルタ / userId 強制セット |
| `src/app/api/assets/[id]/route.ts` | DELETE / PATCH に `await auth()` + 所有権チェック（admin は seed もバイパス） |
| `src/components/ironclad/IroncladBriefForm.tsx` | ラベル 2 箇所「認証バッジ」→「認証・権威バッジ」 |

### 新規作成

なし。

---

## CP1: API のユーザー分離

### Task 1: `/api/assets` GET / POST に auth + userId フィルタを追加

**Files:**
- Modify: `src/app/api/assets/route.ts`

- [ ] **Step 1: 既存ファイルを開いて全体を確認する**

Run: `cat src/app/api/assets/route.ts`

確認ポイント:
- `auth` import が無いこと
- `prisma.asset.findMany` に userId フィルタが無いこと
- `prisma.asset.create` の data に userId が無いこと

- [ ] **Step 2: ファイル全体を以下の内容で置換する**

```ts
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { uploadAssetImage } from '@/lib/assets/blob-client';
import { auth } from '@/lib/auth/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VALID_TYPES = ['product', 'badge', 'logo', 'other'] as const;
type AssetType = (typeof VALID_TYPES)[number];

function isValidType(t: string): t is AssetType {
  return (VALID_TYPES as readonly string[]).includes(t);
}

/**
 * GET /api/assets?type=product|badge|logo|other
 * 自分の Asset のみ返す。admin は userId=NULL の seed も合流。
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type');
    const isAdmin = session.user.plan === 'admin';

    const userScope = isAdmin
      ? { OR: [{ userId: session.user.id }, { userId: null }] }
      : { userId: session.user.id };

    const where = {
      ...(typeParam && isValidType(typeParam) ? { type: typeParam } : {}),
      ...userScope,
    };

    const prisma = getPrisma();
    const assets = await prisma.asset.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json({ assets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Assets GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/assets
 * multipart/form-data: file, type, name
 * → Vercel Blob にアップロード → Asset レコード作成（userId は session から強制セット）
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const type = String(formData.get('type') ?? '');
    const name = String(formData.get('name') ?? '').trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!isValidType(type)) {
      return NextResponse.json(
        { error: `type must be one of ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const mime = file.type || 'image/png';
    const blobUrl = await uploadAssetImage(type, file.name || 'asset.png', bytes, mime);

    const prisma = getPrisma();
    const created = await prisma.asset.create({
      data: {
        type,
        name,
        blobUrl,
        mimeType: mime,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ asset: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Assets POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: TypeScript ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラー 0

もしエラーが出る場合、よくある原因:
- `session.user.plan` が型で見えない → `src/types/next-auth.d.ts` を確認。既に `plan: string` が定義されているはず（auth.ts:79 で代入しているため）。

- [ ] **Step 4: Lint 確認**

Run: `npm run lint`
Expected: エラー 0

- [ ] **Step 5: コミット**

```bash
git add src/app/api/assets/route.ts
git commit -m "feat(assets): require auth + filter GET/POST by session userId

- 一般ユーザーは自分の userId に紐付く Asset のみ取得
- admin (plan='admin') は userId=NULL の seed も OR 合流
- POST 時に Asset.userId を session から強制セット

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `/api/assets/[id]` DELETE / PATCH に所有権チェック追加

**Files:**
- Modify: `src/app/api/assets/[id]/route.ts`

- [ ] **Step 1: 既存ファイルを確認**

Run: `cat src/app/api/assets/\[id\]/route.ts`

確認ポイント:
- `auth` import が無いこと
- 所有権チェックが無いこと（findUnique → そのまま delete/update している）

- [ ] **Step 2: ファイル全体を以下の内容で置換する**

```ts
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { deleteAssetBlob } from '@/lib/assets/blob-client';
import { auth } from '@/lib/auth/auth';

export const runtime = 'nodejs';

/**
 * Asset への書き込み権を判定する。
 * - 所有者本人は常に OK
 * - admin は userId=NULL の seed もバイパスで OK
 */
function canMutate(asset: { userId: string | null }, sessionUserId: string, isAdmin: boolean): boolean {
  if (asset.userId === sessionUserId) return true;
  if (isAdmin && asset.userId === null) return true;
  return false;
}

/**
 * DELETE /api/assets/[id]
 * 自分の Asset のみ削除可能。admin は seed (userId=NULL) も削除可能。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prisma = getPrisma();
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const isAdmin = session.user.plan === 'admin';
    if (!canMutate(asset, session.user.id, isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
      await deleteAssetBlob(asset.blobUrl);
    } catch (blobErr) {
      console.warn('Failed to delete blob (continuing):', blobErr);
    }

    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Asset DELETE error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/assets/[id]
 * body: { name?, isPinned? }
 * 自分の Asset のみ更新可能。admin は seed (userId=NULL) も更新可能。
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as { name?: string; isPinned?: boolean };

    const data: { name?: string; isPinned?: boolean } = {};
    if (typeof body.name === 'string') data.name = body.name.trim();
    if (typeof body.isPinned === 'boolean') data.isPinned = body.isPinned;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const prisma = getPrisma();
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const isAdmin = session.user.plan === 'admin';
    if (!canMutate(asset, session.user.id, isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.asset.update({ where: { id }, data });
    return NextResponse.json({ asset: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Asset PATCH error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: TypeScript ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 4: Lint 確認**

Run: `npm run lint`
Expected: エラー 0

- [ ] **Step 5: コミット**

```bash
git add src/app/api/assets/\[id\]/route.ts
git commit -m "feat(assets): require auth + ownership check on DELETE/PATCH

- 自分の Asset のみ削除・更新可能
- admin (plan='admin') は userId=NULL の seed もバイパスで操作可能
- 他人の Asset への DELETE/PATCH は 403 を返す

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## CP2: UI ラベル変更

### Task 3: 「認証バッジ」→「認証・権威バッジ」に変更

**Files:**
- Modify: `src/components/ironclad/IroncladBriefForm.tsx:399, 406`

- [ ] **Step 1: 該当行を確認**

Run: `grep -n '認証バッジ' src/components/ironclad/IroncladBriefForm.tsx`
Expected:
```
399:        label="🏅 認証バッジ 1（任意）"
406:        label="🏆 認証バッジ 2（任意）"
```

- [ ] **Step 2: 1 行目を変更**

`src/components/ironclad/IroncladBriefForm.tsx:399`

変更前:
```tsx
        label="🏅 認証バッジ 1（任意）"
```

変更後:
```tsx
        label="🏅 認証・権威バッジ 1（任意）"
```

- [ ] **Step 3: 2 行目を変更**

`src/components/ironclad/IroncladBriefForm.tsx:406`

変更前:
```tsx
        label="🏆 認証バッジ 2（任意）"
```

変更後:
```tsx
        label="🏆 認証・権威バッジ 2（任意）"
```

- [ ] **Step 4: 取り残しがないか確認**

Run: `grep -rn '認証バッジ' src/`

期待: ヒット 0 件（少なくとも UI 文言として残っていない）。
注意: コメント・Spec docs 等にヒットしても無視（このタスクは Step 1 の UI ラベル変更のみが対象）。

- [ ] **Step 5: TypeScript ビルド + Lint 確認**

Run: `npx tsc --noEmit && npm run lint`
Expected: エラー 0

- [ ] **Step 6: コミット**

```bash
git add src/components/ironclad/IroncladBriefForm.tsx
git commit -m "ui: rename 認証バッジ to 認証・権威バッジ on Step 1

公的認証だけでなく権威付け素材全般を含む意図を明確化。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## CP3: ローカル動作確認

### Task 4: ローカル dev で本番 DB に対する事前確認

**目的:** リリース前に、現状 `userId IS NULL` の Asset が seed 3 枚以外に存在しないことを確認する（spec §8 リスク欄）。

- [ ] **Step 1: 本番 Neon DB に対して Asset の userId NULL 件数を確認**

Run:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const all = await p.asset.findMany({
    where: { userId: null },
    select: { id: true, type: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('userId=NULL の Asset 件数:', all.length);
  console.table(all);
  await p.\$disconnect();
})();
"
```

期待出力:
```
userId=NULL の Asset 件数: 3
┌─────────┬──────────────────────┬─────────┬───────────────────┬─...
│ (index) │ id                   │ type    │ name              │
├─────────┼──────────────────────┼─────────┼───────────────────┼─...
│    0    │ '...'                │ 'product' │ '5 Point Detox'  │
│    1    │ '...'                │ 'badge' │ 'GMP Quality'     │
│    2    │ '...'                │ 'badge' │ 'Australian Government' │
└─────────┴──────────────────────┴─────────┴───────────────────┴─...
```

判断ロジック:
- 件数が **3 件かつ全て seed** → そのままリリース OK
- 件数が **4 件以上** → seed 以外に「過去ユーザーがアップしたが userId が紐付いていない孤立 Asset」が存在する。**この場合は Task 5 の事前 backfill を実行**してからリリース
- 件数が **0〜2 件** → seed が消えている可能性。まず admin 環境で seed を再アップしてからリリース

- [ ] **Step 2: dev サーバー起動**

Run: `npm run dev`

- [ ] **Step 3: ブラウザで http://localhost:3000 を開き、未ログイン状態で `/api/assets?type=product` を直接叩く**

Run（別ターミナル）: `curl -i http://localhost:3000/api/assets?type=product`
Expected: `HTTP/1.1 401 Unauthorized` + `{"error":"Unauthorized"}`

- [ ] **Step 4: Google ログインしたあと、ブラウザの DevTools Network タブで `/api/assets?type=product` のレスポンスを確認**

期待:
- 一般ユーザー（自身は未アップ）: `{"assets": []}`
- admin (str.kk.co@gmail.com): `{"assets": [...3 件以上...]}` で seed が含まれる

- [ ] **Step 5: dev サーバー停止 + メモ**

確認結果を会話 or PR description に書く（リスク chunk が現実化していないかの確証として）。

---

### Task 5: （条件付き）userId=NULL の孤立 Asset を admin に backfill

**実施条件:** Task 4 Step 1 で seed 3 枚以外の `userId=NULL` Asset が見つかった場合のみ実行する。0 件 or 3 件ぴったりなら **このタスクはスキップ**。

**Files:**
- Create: `scripts/migrate-orphan-assets-to-admin.mjs`（既存 `scripts/migrate-assets-to-admin.ts` と紛らわしいので新規作成 + 実行後に削除）

- [ ] **Step 1: スクリプト作成**

`scripts/migrate-orphan-assets-to-admin.mjs`:

```js
#!/usr/bin/env node
/**
 * 一回限り。userId=NULL の seed 以外の孤立 Asset を admin user の id へ紐付ける。
 * 実行前に必ず Task 4 Step 1 で対象を確認すること。
 */
import { PrismaClient } from '@prisma/client';

const SEED_NAMES = ['5 Point Detox', 'GMP Quality', 'Australian Government'];

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL_FOR_BACKFILL;
  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL_FOR_BACKFILL env が未設定');
  }
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) throw new Error(`admin user が見つからない: ${adminEmail}`);

  const orphans = await prisma.asset.findMany({
    where: {
      userId: null,
      NOT: { name: { in: SEED_NAMES } },
    },
  });

  console.log(`backfill 対象: ${orphans.length} 件`);
  console.table(orphans.map((a) => ({ id: a.id, type: a.type, name: a.name })));

  if (orphans.length === 0) {
    console.log('対象なし。終了。');
    return;
  }

  const confirm = process.argv.includes('--apply');
  if (!confirm) {
    console.log('--apply を付けて再実行すると DB 更新を実行します（dry-run 終了）');
    return;
  }

  const result = await prisma.asset.updateMany({
    where: { id: { in: orphans.map((a) => a.id) } },
    data: { userId: admin.id },
  });
  console.log(`✅ updated ${result.count} 件を admin (${adminEmail}) に紐付け完了`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: dry-run**

Run: `ADMIN_EMAIL_FOR_BACKFILL=str.kk.co@gmail.com node scripts/migrate-orphan-assets-to-admin.mjs`
Expected: 対象件数と内訳が console.table で表示され、「--apply を付けて再実行」と出る

- [ ] **Step 3: 内容確認 → apply**

dry-run 出力を確認し、本当に admin に紐付けて良い Asset であることを目視確認した上で:

Run: `ADMIN_EMAIL_FOR_BACKFILL=str.kk.co@gmail.com node scripts/migrate-orphan-assets-to-admin.mjs --apply`
Expected: `✅ updated N 件を admin (str.kk.co@gmail.com) に紐付け完了`

- [ ] **Step 4: スクリプトを削除（一回限りスクリプトを残さない）**

Run: `rm scripts/migrate-orphan-assets-to-admin.mjs`

- [ ] **Step 5: コミット（スクリプト削除のみコミット。本番 DB 変更はコミット履歴に残らない）**

```bash
git add scripts/migrate-orphan-assets-to-admin.mjs
git commit -m "chore: backfill orphan assets to admin (one-shot, applied)

userId=NULL の孤立 Asset を admin に紐付け済み。スクリプトは applied 後に削除。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## CP4: Preview デプロイと実機検証

### Task 6: Vercel Preview デプロイで T1〜T8 を確認

- [ ] **Step 1: ブランチを push して Preview を発火**

Run:
```bash
git push -u origin HEAD
```
Expected: Vercel が自動で Preview デプロイを作成

- [ ] **Step 2: Preview URL を取得**

Run: `npx vercel ls --token "$(cat ~/.claude/secrets/vercel-token)" | head -3`
または: GitHub PR の Vercel ボット コメントから

- [ ] **Step 3: T1 〜 T8 を実機テスト**

Spec §7.1 のテスト表を実機で実行:

| ケース | 操作 | 期待結果 |
|--------|------|---------|
| T1 | 新規 Google ログイン | 商品画像 / 認証・権威バッジ 1 / 2 が空。「まだ素材がありません」 |
| T2 | 商品画像 1 枚アップ → Step 2 → トップに戻る | アップした 1 枚が自動選択 |
| T3 | badge 2 枚アップ → トップに戻る | badge1 = 最新、badge2 = 2 番目に最新 |
| T4 | str.kk.co@gmail.com でログイン | seed 3 枚が見え自動選択される |
| T5 | 一般ユーザー A で B の asset id を直接 GET | 一覧に B の asset が含まれない |
| T6 | 一般ユーザー A が B の asset id へ DELETE | 403 Forbidden |
| T7 | admin が seed (userId=null) を DELETE | 200 OK |
| T8 | Step 1 のラベル目視確認 | 「認証・権威バッジ 1 / 2」になっている |

T5 の検証手順例:
```bash
# 一般ユーザー A のセッション cookie でリクエスト
curl -i -H "Cookie: <A の next-auth セッション cookie>" \
  https://<preview-url>/api/assets?type=badge | jq '.assets[] | .id'
# B の asset id がレスポンスに含まれないこと
```

T6 の検証手順例:
```bash
curl -i -X DELETE -H "Cookie: <A の cookie>" \
  https://<preview-url>/api/assets/<B-asset-id>
# Expected: HTTP/1.1 403
```

- [ ] **Step 4: 全 T1〜T8 PASS したらメイン merge へ進む**

万が一 FAIL があった場合: 該当タスクへ戻って修正 + 再 push。

---

### Task 7: 本番 main へのマージとリリース

- [ ] **Step 1: PR 作成**

Run:
```bash
gh pr create --title "feat(assets): user isolation + label rename" --body "$(cat <<'EOF'
## Summary
- /api/assets 系 3 エンドポイントに認証 + userId フィルタを追加
- admin は userId=NULL の seed も OR 合流で見える
- Step 1 ラベル「認証バッジ」→「認証・権威バッジ」

## Why
顧客から「アップ前から既に他社の素材が選択されていて分かりにくい」と問い合わせ。
seed asset (5 Point Detox / GMP / Australian Government) が全ユーザーに自動選択されていた。

## Test plan
- [x] T1〜T8 を Vercel Preview で実機確認済（ローカル dev 含む）
- [x] tsc --noEmit / npm run lint クリーン

Spec: docs/superpowers/specs/2026-05-02-asset-library-user-isolation-design.md
Plan: docs/superpowers/plans/2026-05-02-asset-library-user-isolation.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: PR がグリーン（Vercel build OK）になることを確認**

- [ ] **Step 3: main にマージ**

Run: `gh pr merge --squash --delete-branch`
Expected: 本番デプロイがトリガー

- [ ] **Step 4: 本番反映後、admin と一般ユーザーで一度ずつログインし、T1 / T4 だけ最終確認**

- [ ] **Step 5: 顧客に「修正済み」と返信**

リリース後、問い合わせ元の顧客に「seed 素材は admin 専用に変更しました。今後は空のコンテナから始まります」と返信する。

---

## 依存関係まとめ

```
Task 1 (API GET/POST) ──┐
                        ├─→ Task 4 (ローカル確認) ─→ (Task 5 条件付き) ─→ Task 6 (Preview) ─→ Task 7 (本番)
Task 2 (API DELETE/PATCH) ┘
Task 3 (UI ラベル) ───────────────────────────────↗
```

Task 1〜3 は独立。任意順で進めて OK。Task 4 以降は Task 1〜3 完了後。

## ロールバック計画

- Schema / DB 変更なし（Task 5 を実行した場合のみ DB 更新あり、ただし userId 付与のみ）
- `git revert <merge-commit>` 一発で UI / API は元に戻る
- Task 5 を実行した場合のロールバックは「該当 Asset の userId を NULL に戻す」逆 SQL を手で当てる
- Vercel Blob 影響なし
