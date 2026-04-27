# Phase A.11.5: 生成履歴 + お気に入り + プラン別ロック方式 設計書

**作成日:** 2026-04-27
**ステータス:** ブレインストーミング完了 / 実装プラン作成前
**前提:** Phase A.11.0-A.11.3（DB schema + Header + /account + 機能 gate）本番動作確認済み
**配置場所:** `docs/superpowers/specs/2026-04-27-history-favorites-design.md`

---

## 1. 背景・目的

事業計画書 v2 で予告した Phase A.11.5（履歴 + 再生成 + お気に入り + Plan 別保存ポリシー）を実装する。本フェーズの戦略的価値：

1. **再利用性**: 過去のバナーが資産化、勝ちパターン研究の基盤
2. **ARPU 上昇**: プラン別ロック方式で **Loss aversion** 心理を最大化（Free → Pro 転換率を 9% → 12-15% へ）
3. **Phase A.12 (Stripe) の前提**: 課金で開放される機能差を先に作り込む

### 1.1 ブレストで確定した戦略変更（重要）

事業計画 v2 §2.1 の旧仕様：
- Free: 30 日経過で履歴自動削除
- Starter: 90 日経過で削除
- 画像 DL 期間: 7/30/永続
- 削除予告メール: Resend + Vercel Cron

→ **ブレスト結果、全廃止。代わりに「カウントベースロック方式」採用**：
- データは Free/Starter も**永続保持**（消さない）
- 直近 N 件のみアクセス可、それ以前はロック表示（クリックで Pro 訴求）
- お気に入り画像のあるセッションはロック対象外（Starter の 5 枚救済枠）

**理由**: ロック方式の方が loss aversion が強い（消えていない、見えてるのに開けないの心理）。実装も簡素（Cron / メール基盤不要）。

---

## 2. プラン仕様（最終版）

| | **Free ¥0** | **Starter ¥3,980** | **Pro ¥14,800** | **Plan C** |
|---|---|---|---|---|
| 履歴 アクセス可能件数 | **直近 10** | **直近 30** | **無制限** | 無制限 |
| 履歴 データ保持 | 永続（11件目以降ロック）| 永続（31件目以降ロック）| 永続（全件アクセス可）| 永続 |
| 画像 DL（ロック以外） | 永続 DL 可 | 永続 DL 可 | 全件永続 DL | 全件永続 DL |
| お気に入り | **不可**（Pro 訴求モーダル）| **5 枚**（ロック救済可）| 無制限 | 無制限 |
| 一括 ZIP DL | 不可（Pro 訴求）| 不可（Pro 訴求）| **全件 ZIP DL** | ZIP + クライアント別 |

### 2.1 「お気に入り = ロック救済」の仕組み

ロック判定はセッション単位（直近 N 件外がロック対象）。ただし **画像 (★) お気に入りが 1 つでも含まれるセッションはロック対象外**。

例：Starter で 35 セッション保有 + 古い 5 セッションのうち 3 セッションに ★ あり：
- 直近 30 = アクセス可
- 古 5 のうち ★ 含む 3 = アンロック
- 古 5 のうち ★ なし 2 = ロック

これにより「お気に入り = 救済枠」として実用価値が出る（Starter は最大 5 枚 = 最大 5 セッション救済可）。

---

## 3. データモデル

### 3.1 新規テーブル

```prisma
model Generation {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// ブリーフ + selections + 使用 asset id 群を JSON でスナップショット保存
  briefSnapshot   Json

  createdAt       DateTime  @default(now())

  images          GenerationImage[]

  @@index([userId, createdAt])
}

model GenerationImage {
  id                String    @id @default(cuid())
  generationId     String
  generation       Generation @relation(fields: [generationId], references: [id], onDelete: Cascade)

  /// 'Instagram (1080x1080)' 等
  size              String
  /// Vercel Blob Public URL
  blobUrl           String
  /// 'gpt-image' 'flux' 等
  provider          String
  /// model, fallback flag 等
  providerMetadata  Json?

  /// ★お気に入り
  isFavorite        Boolean   @default(false)
  /// お気に入り化された日時（プラン制限カウント用）
  favoritedAt       DateTime?

  createdAt         DateTime  @default(now())

  @@index([generationId])
  @@index([isFavorite, favoritedAt])
}
```

### 3.2 設計判断

- **`briefSnapshot` は JSON**：ブリーフのスキーマは A.11 で安定したが将来変わる可能性あり、リレーション化より柔軟性優先
- **画像は Vercel Blob、URL のみ DB 保持**: DB 軽量化、base64 直保存しない
- **Blob path 構造**: `generations/<userId>/<generationId>/<size>.png` → ユーザー削除時に prefix 一括削除可能
- **deleteAt / downloadUntil 列は持たない**: ロック方式に統一したため不要
- **isFavorite + favoritedAt**: プラン別上限カウント時は createdAt ではなく favoritedAt で並べる（直近 5 枚を残す挙動）

---

## 4. アーキテクチャ全体像

```
[A.11.5 DB]                  [A.11.5 ストレージ]            [A.11.5 UI]
Generation テーブル          Vercel Blob                    /history ページ新設
GenerationImage 子テーブル   generations/<userId>/         一覧 + 詳細 + ロック表示
favorites + favoritedAt       <generationId>/<size>.png      お気に入りトグル

[A.11.5 ロック判定]          [A.11.5 既存統合]              [A.11.5 再生成]
Lazy 計算（API レスポンス内）  /api/ironclad-generate         同条件 → Step 3 直行
- 直近 N 件 → access OK        成功時に Generation 作成      編集して → Step 1 戻り
- ★含むセッション → access OK   + Blob upload                  両方提供
- それ以外 → locked, blobUrl
  を空文字でマスク
```

---

## 5. UI 設計

### 5.1 `/history` 一覧ページ

```
┌─────────────────────────────────────────────────────────────┐
│ ヘッダー: ロゴ / Step / Pro 12/100 / アバター(▼)              │
├─────────────────────────────────────────────────────────────┤
│  履歴                                              [+ 新規作成] │
│  ──────────────────────────────────────────────────────     │
│  [全て] [★お気に入りのみ]                                     │
│                                                              │
│  ── アクセス可能 (直近 10) ──                                  │
│  ┌─────────────────────────────────┐                       │
│  │ 2026-04-27 10:49                                       │  │
│  │ 5 Point Detox / 40代女性 / 購入CVR最大化                │  │
│  │ [□][□][□] 3 サイズ                                     │  │
│  │ [一括ZIP DL] [再生成▼] [削除]                           │  │
│  └─────────────────────────────────┘                       │
│  ┌── 9 セッション続く ──┐                                    │
│                                                              │
│  ── 🔒 ロック中（Free/Starter のみ表示）──                    │
│  ┌─────────────────────────────────┐                       │
│  │ 🔒 2026-03-15                                          │  │
│  │ 5 Point Detox / 40代女性 / ...                         │  │
│  │ [▓▓ blur(8px) ▓▓] (鍵オーバーレイ)                     │  │
│  └─────────────────────────────────┘                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🔒 他 5 件ロック中。Pro プランで全件アクセス可能          │ │
│  │                                  [アップグレード]       │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**ロック行の表示量**（Q-β 確定: b+c）：
- 日付 ✅
- ブリーフタイトル（商材 / ターゲット / 目的）✅
- サムネ → CSS `filter: blur(8px)` + 鍵アイコンオーバーレイ ✅
- アクションボタン ❌
- フッターに「他 N 件ロック中」バナー（c）

ロック行クリック → Pro 訴求モーダル：

```
🔒 このバナーは Pro プランで開放できます

Free プランは直近 10 セッションのみアクセス可能です。
Pro プラン (¥14,800/月) で全履歴・全画像にアクセス・DL できます。

[アップグレードのご相談] (mailto)  [閉じる]
```

### 5.2 履歴詳細 (`/history/[id]`)

- ブリーフ全体表示（パターン / 商材 / ターゲット / 目的 / コピー 4 種 / デザイン要件 4 種 / CTA / トーン / 注意）
- 全サイズ画像をグリッド表示
- 各画像に **★ お気に入りトグル**（Free disabled / Starter 5枚使用後 disabled）
- 各画像に **個別 DL** + **削除** ボタン
- ページ末尾に「同条件で再生成」「ブリーフを編集して再生成」2 ボタン
- 自分の userId のもの以外は 403

### 5.3 ヘッダードロップダウン拡張

`UserMenu` に「履歴」項目追加：

```
👤 マイアカウント
📜 履歴               ← 新規追加
💳 プラン変更
─────────────
↪ サインアウト
```

### 5.4 /account への「履歴」セクション追加

`/account` ページの 4 セクション目として（プロフィール / プラン / **履歴** / セキュリティ）：

```
履歴
─────────────
最新の生成: 2026-04-27 10:49（5 Point Detox / 40代女性）
履歴件数: 12 件（うち ロック中 2 件）   ← Free/Starter のみ表示
[すべての履歴を見る →]                   ← /history
```

履歴 0 件の場合：「まだ履歴がありません。バナーを生成してみましょう」

### 5.5 Step 3 完成画面のトースト

ironclad ページ Step 3 で生成成功時：

```
✓ 履歴に保存しました   [履歴を見る]   ✕
```

5 秒で自動フェードアウト。「履歴を見る」クリックで /history へ。これで「いつのまにか保存される」ことのユーザー認知を確保。

### 5.6 再生成 UX（Q8: C 採用）

- **同条件で再生成**: 履歴詳細から `?regenerate=<id>` クエリで `/?regenerate=...` へ → Step 3 直行 → 自動 generateAll() 開始
- **編集して再生成**: `?prefill=<id>` で `/?prefill=...&step=1` へ → Step 1 で brief / selections / 素材選択を pre-fill

---

## 6. API 設計

### 6.1 新規エンドポイント

| Method | Path | 用途 | 認証 | プラン制限 |
|---|---|---|---|---|
| GET | `/api/history` | 一覧（ページング、ロック判定込み） | session 必須 | - |
| GET | `/api/history/[id]` | 詳細 | session 必須 | ロック対象は 403 |
| DELETE | `/api/history/[id]` | 削除 | session 必須 | 自分の row のみ |
| POST | `/api/history/[id]/regenerate` | 同条件再生成 | session 必須 | usageLimit gate |
| PUT | `/api/history/image/[imageId]/favorite` | お気に入りトグル | session 必須 | プラン別上限 |
| GET | `/api/history/[id]/zip` | ZIP DL 用 URL リスト返却 | session 必須 | Pro+ のみ |

### 6.2 一覧 API のレスポンス

```ts
// GET /api/history?cursor=<id>&limit=20
{
  sessions: [
    {
      id: 'cuid',
      createdAt: '2026-04-27T10:49:18Z',
      brief: { product, target, purpose, pattern },
      images: [
        { id: 'cuid', size: 'Instagram (1080x1080)', blobUrl, isFavorite: true }
      ],
      locked: false,        // Pro+ は常に false
      hasFavorite: true,    // ★ 含まれるか
    }
  ],
  nextCursor: 'cuid' | null,
  lockedCount: 5,           // Free/Starter のみ非ゼロ
  plan: 'free',
}
```

### 6.3 ロック判定ロジック

```ts
// 擬似コード
const accessLimit = getHistoryAccessLimit(plan);  // free=10 / starter=30 / pro=Infinity / admin=Infinity
const sessions = await prisma.generation.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  include: { images: true },
});

const result = sessions.map((s, idx) => {
  const hasFavorite = s.images.some(img => img.isFavorite);
  const withinLimit = idx < accessLimit;
  const locked = !withinLimit && !hasFavorite;
  return {
    ...s,
    locked,
    // ロック時は images の blobUrl を空文字でマスク（漏洩防止）
    images: locked ? s.images.map(i => ({ ...i, blobUrl: '' })) : s.images,
  };
});
```

### 6.4 ironclad-generate の変更

`POST /api/ironclad-generate` 成功時に Generation を作成・画像を Vercel Blob にアップロード：

```ts
// 既存ロジック後
const result = await generateWithFallback(...);
await incrementUsage(currentUser.userId);

// Phase A.11.5: 履歴保存
let generation = await prisma.generation.findFirst({
  where: {
    userId: currentUser.userId,
    briefSnapshot: { equals: briefSnapshot },
    createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },  // 過去 5 分以内 = 同セッション
  },
});
if (!generation) {
  generation = await prisma.generation.create({
    data: { userId: currentUser.userId, briefSnapshot },
  });
}

// 画像を Vercel Blob にアップロード
const blob = await put(
  `generations/${currentUser.userId}/${generation.id}/${size}.png`,
  Buffer.from(result.base64.split(',')[1], 'base64'),
  { access: 'public', contentType: 'image/png' }
);

await prisma.generationImage.create({
  data: {
    generationId: generation.id,
    size, blobUrl: blob.url,
    provider: result.providerId,
    providerMetadata: result.providerMetadata,
  },
});

return NextResponse.json({ ..., generationId: generation.id });
```

### 6.5 削除 API

`DELETE /api/history/[id]`:
- DB から Generation cascade 削除（`onDelete: Cascade` で GenerationImage 自動削除）
- Vercel Blob から prefix `generations/<userId>/<id>/` で list → delete 一括処理
- 自分の userId 以外は 403

### 6.6 お気に入り API

`PUT /api/history/image/[imageId]/favorite`:
- Body: `{ isFavorite: boolean }`
- プラン制限：
  - Free: 常に 403（お気に入り使用不可）
  - Starter: 既に 5 枚お気に入り済 + 新規 ★ → 429
  - Pro+: 制限なし
- 成功時 `favoritedAt = now()` 更新

### 6.7 ZIP DL API

`GET /api/history/[id]/zip`:
- Pro+ のみ（Starter 以下は 403）
- 画像 URL リストを返却、ZIP 化はクライアント (jszip)
- レスポンス: `{ images: [{ size, blobUrl, filename }] }`

---

## 7. 検証戦略（手動 E2E）

プロジェクトはテストフレーム未導入。各タスクは「TypeScript ビルド通過 + 手動確認」で検証。

### 7.1 Phase A.11.5 検証チェックリスト

**履歴保存（自動）**
- [ ] バナー生成 → /history に新セッションが追加
- [ ] マルチサイズ生成 3 サイズ → 1 セッション内に 3 画像登録
- [ ] Vercel Blob に `generations/<userId>/<id>/<size>.png` で保存
- [ ] Step 3 完成画面に「履歴に保存しました」トースト表示

**履歴一覧（Free / Pro 切替）**
- [ ] Free: 11 セッション目を生成 → 1〜10 通常表示、11 番目（最古）はロック表示
- [ ] ロック行クリック → Pro 訴求モーダル
- [ ] フッターに「他 1 件ロック中」バナー
- [ ] DB は 11 件全保持（消えていない）
- [ ] Pro: 全件アクセス可、ロック表示・フッターバナーなし

**履歴一覧（Starter）**
- [ ] 31 セッション目以降がロック対象
- [ ] お気に入り画像があるセッション → ロック対象外で表示

**履歴詳細**
- [ ] /history/[id] で全画像グリッド表示
- [ ] ロック対象 ID 直接アクセス → 403
- [ ] 自分以外の userId の id にアクセス → 403

**再生成（同条件）**
- [ ] 「同条件で再生成」→ /?regenerate=... → Step 3 自動 → 自動生成
- [ ] 新画像は元と異なる（AI 揺らぎ）+ 同セッションに追加（5 分以内）or 新セッション

**再生成（編集）**
- [ ] 「ブリーフを編集して再生成」→ Step 1 戻り、フォーム pre-fill
- [ ] 商材変更 → Step 3 で新セッション作成

**お気に入り**
- [ ] Free: ★ ボタン disabled、クリック → Pro 訴求モーダル
- [ ] Starter: 5 枚目まで OK、6 枚目で「上限到達」モーダル
- [ ] Pro: 無制限
- [ ] お気に入り化 → ロック対象外（Starter で 31 件目以降のセッションで確認）

**ZIP DL**
- [ ] Free/Starter: ボタン disabled
- [ ] Pro: クリック → クライアント側 jszip 生成 → DL（`<商材名>_<日時>.zip`）

**削除**
- [ ] 履歴詳細「削除」→ 確認ダイアログ → DB + Blob 完全削除
- [ ] 一覧から消える

**ヘッダー導線**
- [ ] アバタークリック → ドロップダウンに「履歴」項目
- [ ] クリック → /history

**/account 履歴セクション**
- [ ] 履歴 0 件: 「まだ履歴がありません」
- [ ] 履歴 12 件 + ロック 2 件: サマリ表示「履歴件数: 12 件（うち ロック中 2 件）」
- [ ] 「すべての履歴を見る」リンクで /history

**プラン変更時の動的反映**
- [ ] DB で Free → Pro に変更 → /account 訪問 → SessionSyncer 走行 → ヘッダー Pill / 履歴ロック判定が同期

**TypeScript ビルド**
- [ ] `npm run build` がエラーなく通る

### 7.2 リスクとロールバック

| リスク | 対策 |
|---|---|
| Vercel Blob ストレージ無制限増加 | Phase 2 で「Free 50 セッション上限 + 古い順自動削除」検討。MVP では永続保持で監視 |
| Generation 生成中に Blob put 失敗 | DB トランザクションで一貫性保証、失敗時はエラーレスポンス（OpenAI 課金は incrementUsage の前なら回避可） |
| ロック判定の race condition | Lazy 計算なので不整合は次回アクセス時に自然解消 |
| 削除時の Blob 残骸 | prefix 一括削除（list → delete）、失敗時はログ |
| お気に入り 5 枚超過 | API で count + 1 > 5 なら 429、UI は事前 disabled |
| 既存 ironclad-generate を変更する破壊的変更 | feature ブランチで段階的に検証、main マージ前に手動テスト |

---

## 8. 完了の定義

以下が満たされたら本 spec は完了：

1. バナー生成成功時、自動的に履歴 (Generation) として保存される
2. /history で一覧・詳細・削除・再生成・お気に入り操作ができる
3. プラン別ロック表示（Free=10, Starter=30, Pro=∞）が正しく機能する
4. ロック行クリックで Pro 訴求モーダル
5. お気に入り画像があるセッションはロック対象外
6. Pro+ で一括 ZIP DL 動作（クライアント完結）
7. ヘッダードロップダウン + /account + Step 3 完成トーストの 3 経路から /history 到達可
8. プラン変更（手動 DB 更新）→ /account 訪問で SessionSyncer 走行 → ロック判定が同期
9. `npm run build` 通過、本番 Vercel で動作確認済み

---

## 9. スコープ外（明示）

- **削除予告メール**: ロック方式に統一したため不要
- **Vercel Cron**: 同上、自動削除なし
- **クライアント別グルーピング**: Plan C 用、エンプラ引き合い時に実装
- **履歴の検索・フィルタ**: 簡易フィルタ「全て / お気に入り」のみ MVP、高度検索は後回し
- **履歴のタグ付け**: 同上
- **公開リンク共有**: 後回し
- **時間ベース DL 期限**: 全廃（ロック方式に統一）

---

## 付録 A: 議論経緯（Q&A サマリ）

| 議題 | 結論 |
|---|---|
| 履歴の保存単位 | Q1: A 「1 ブリーフ = 1 セッション」 |
| 保存タイミング | Q2: A 自動保存 + 削除 UI 提供 |
| 削除実装方式 | Q3: A Lazy delete のみ（→ 後にロック方式に変更で不要化） |
| 削除予告メール | Q4: a Resend MVP（→ 後にロック方式に変更で不要化） |
| 一括 ZIP DL | Q5: A クライアント完結 (jszip) |
| クライアント別グルーピング | Q6: C 後回し（エンプラ引き合い時）|
| 履歴ページ配置 | Q7: A 専用 /history（+ ヘッダー + /account 経由）|
| 再生成 UX | Q8: C 同条件 + 編集 両方 |
| お気に入り単位 | Q9: A 画像単位 |
| メール送信プロバイダ | Q10: a Resend（→ ロック方式で不要化） |
| 戦略変更：時間削除 → ロック方式 | Q-α: C ロック統一、DL 期限廃止 |
| ロック表示の見せ方 | Q-β: b+c 部分情報 + 件数バナー |
| Free 生成回数 整合性 | 案1 採用「3/月 + ロック 10 件」（5ヶ月で 11 件目以降ロック）|
| 履歴アクセス導線 | ヘッダー + /account + Step 3 トースト の 3 経路 |
