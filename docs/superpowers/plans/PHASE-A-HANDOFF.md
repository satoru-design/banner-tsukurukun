# Phase A ハンドオフメモ（2026-04-21 時点）

ブランチ `feature/phase-a-image-dual` を小池さんが戻ってから再開できる状態に整えたメモ。

## 完了した Task（7 コミット）

| Task | Commit | 内容 |
|---|---|---|
| A0 + A1 | `6bb90ab` | baseline ディレクトリ・capture-baseline.md 作成、旧 fix-_/patch-_/update_/scratch_/test-anthropic/restore.js/migrate-frontend.js を `_archive/` へ退避、旧 `src/app/api/analyze/route.ts` も退避 |
| A2 | `4bc2f12` | page.tsx（777 行）を Step1Input / Step2Angles / Step3Editor + banner-state.ts に分割（ロジック変更なし、451 行に縮小） |
| A3 | `ed52051` | `src/lib/image-providers/` に Imagen 4 Ultra / FLUX 1.1 pro の共通インターフェース実装＋フォールバックルーター、スモークテストスクリプト |
| A4 | `31760d5` | `/api/generate-image` を `generateWithFallback` 経由の薄いルーターに書き換え |
| A5 | `d44263f` | Step3 の画像生成ボタン直前に ModelSelector 配置、fallback 警告表示 |
| A6 | `892eb4a` | Prisma Banner モデルに `imageModel` カラム追加、save-banner route と handleSaveList で永続化 |
| A8 | `3e51121` | `middleware.ts` で Basic Auth（環境変数未設定時は素通し） |

全コミットで `npm run build` 成功確認済み。GitHub に push 済み（https://github.com/satoru-design/banner-tsukurukun/tree/feature/phase-a-image-dual）。

## 残 Task（小池さん戻り次第）

### 🟡 A7: SQLite → Neon Postgres 移行

**小池さんのアクション必要**:
1. https://console.neon.tech でプロジェクト `banner-tsukurukun-v2` 作成（Region: Asia Pacific / Tokyo）
2. 接続文字列をコピーして `.env.local` に `DATABASE_URL=postgresql://...` として貼り付け

その後、私（Claude）側で：
- `prisma/schema.prisma` の provider を `postgresql` に変更
- 既存 SQLite マイグレーション + `dev.db` を `_archive/prisma-sqlite-migrations/` に退避
- `npx prisma migrate dev --name init_postgres` で Postgres 用初期マイグレーション生成
- 動作確認 → コミット

### 🟡 A9: Phase A 完了レビュー（実機評価）

**小池さんのアクション必要**:

#### 1. ローカル環境変数の準備
`.env.local` に以下を追加（無ければ新規作成）：

```env
GEMINI_API_KEY=（既存の Gemini/AI Studio 鍵）
REPLICATE_API_TOKEN=（Replicate の API トークン）
GOOGLE_AI_STUDIO_API_KEY=（Imagen 4 Ultra 用、Gemini と別契約の場合。同一ならコピペでOK）
DATABASE_URL=（A7 で取得した Neon 接続文字列）
BASIC_AUTH_USER=koike
BASIC_AUTH_PASSWORD=（任意のパスワード）
```

#### 2. ベースライン録画（Before キャプチャ）
`scripts/capture-baseline.md` の手順を参照。3 本の LP × 4 アングル × 1 枚 = 12 枚を `docs/baselines/2026-04-21-before-phase-a/` に保存。

※ **これは Phase A の変更を反映する前に取る必要がある**ため、実はもう遅い（A5 でモデルが切り替わっているため）。実際には現状のコードを使って **Imagen 4 / FLUX それぞれで After キャプチャを取り、Before は過去 Vercel 版（Gemini Flash 時代）の画像を記憶ベースで比較するか、あるいは A3〜A5 を reverts せずに比較基準を「Flash が出していた低画質」の口頭記憶で置き換える**のが現実的。

→ もし厳密な Before キャプチャを取りたければ、いったん `git checkout main` で Flash 時代のコードに戻り 12 枚取ってからブランチに戻れば可能。指示があれば私がやる。

#### 3. After キャプチャ
`feature/phase-a-image-dual` ブランチに戻り、同じ LP × 4 アングル × **2 モデル** = 24 枚を `docs/baselines/2026-04-21-after-phase-a/` に保存。

#### 4. 比較レポート
`docs/baselines/2026-04-21-comparison.md` を埋める（テンプレはプランに記載）。

#### 5. 私が実行する自動化部分
- `red-team` エージェントによるプラン・実装のレビュー → `docs/reviews/2026-04-21-phase-a-red-team.md`
- `superpowers:code-reviewer` による仕様照合 → `docs/reviews/2026-04-21-phase-a-code-review.md`
- `simplify` skill で冗長コード掃除
- PR 作成・Vercel Preview 確認・main マージ・`phase-a-complete` タグ

## Phase A で tech-architect subagents が挙げた既知の観察事項

1. **ビルド時 "API key should be set when using the Gemini API" 警告**
   - 原因: `src/app/api/analyze-lp/route.ts` 等の既存ルートがモジュールトップで `new GoogleGenAI({ apiKey: '' })` を行っている
   - 影響: 実行時は問題なし。ビルドログがノイジー
   - 対応: 要すれば将来的に遅延初期化にリファクタ（Phase A 範囲外）

2. **Vercel Hobby の maxDuration = 60s 制限**
   - A4 で `maxDuration = 60` を宣言済みだが、FLUX は生成+画像 DL の 2 段で 60s に収まらないケースが理論上ある
   - A9 の実機テストで実測確認、超える場合は Vercel Pro への課金か非同期化を検討

3. **fallback 表示の同一モデル表示問題**
   - ModelSelector で切替後、state 更新タイミングで「imagen4 失敗のため imagen4 にフォールバック」と見える瞬間がある
   - 実害なし、認識ミスだけ注意

4. **Basic Auth の部分設定問題**
   - `BASIC_AUTH_USER` と `BASIC_AUTH_PASSWORD` 片方だけセットだと認証が素通しになる
   - 本番デプロイ時は両方セットを忘れない

5. **`.env.example` の gitignore 問題**
   - `.gitignore` に `.env*` が入っているため `.env.example` も無視される
   - A3 コミット時に `-f` で強制追加済み。将来的に `.gitignore` に `!.env.example` を追加したほうが運用しやすい

## 次セッション再開時のチェックリスト

- [ ] `.env.local` が全変数セットされているか確認
- [ ] Neon プロジェクトが作成済みで `DATABASE_URL` が有効か
- [ ] `feature/phase-a-image-dual` ブランチにいるか（`git branch --show-current`）
- [ ] `npm install` 完了済みか
- [ ] `npm run build` が通るか

すべて OK なら A7 → A9 を再開。
