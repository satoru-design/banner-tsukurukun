# Phase A コードレビュー報告（仕様・プラン照合）

- 作成日: 2026-04-21
- レビュー対象ブランチ: `feature/phase-a-image-dual`（10 コミット、main 分岐後の差分 51 ファイル / +1967 -502）
- 仕様: `docs/superpowers/specs/2026-04-21-banner-tsukurukun-v2-design.md`
- プラン: `docs/superpowers/plans/2026-04-21-phase-a-image-dual.md`

---

## 0. 仕様カバレッジ（Task A0〜A9）

| Task | 状態 | 備考 |
|---|---|---|
| A0 ベースライン録画準備 | 一部実装 | `scripts/capture-baseline.md` と `docs/baselines/2026-04-21-before-phase-a/` の下地はあり。Step3 の 12 枚キャプチャ自体は人間作業で未実施（HANDOFF 記載通り） |
| A1 レガシー退避 | 完全実装 | 24 本の fix/patch/update/scratch/test-anthropic/restore/migrate-frontend と `src/app/api/analyze/route.ts` が `_archive/` 配下へ移動、`_archive/README.md` あり |
| A2 page.tsx 分割 | 完全実装 | 777 行 → 473 行。`Step1Input` / `Step2Angles` / `Step3Editor` / `banner-state.ts` に分離。ロジック不変 |
| A3 画像プロバイダ抽象 | 完全実装（1 箇所意図的逸脱） | `types.ts` / `imagen4.ts` / `flux.ts` / `index.ts` を仕様通り実装。**Imagen4 側の `seed` 受け渡しを落としている**（smoke test で AI Studio が未対応のため、コメント済み） |
| A4 /api/generate-image ルーター化 | 完全実装 | `generateWithFallback` 経由、`VALID_PROVIDERS` / `VALID_RATIOS` の入力バリデーションあり。プランのコードとほぼ一字一句一致 |
| A5 ModelSelector UI | 完全実装 | Step3 条件画面に配置、fallback 警告表示あり |
| A6 `imageModel` カラム追加 | 完全実装 | schema / migration / save-banner route / handleSaveList いずれも反映。`imageModel: lastProviderUsed ?? imageModel` の優先順もプラン通り |
| A7 Neon Postgres 移行 | 完全実装 | provider=postgresql、20260421012127_init_postgres マイグレーション生成済み、旧 SQLite 遺物は `_archive/prisma-sqlite-migrations/` に退避 |
| A8 Basic Auth middleware | 完全実装 | プラン記載のコードと完全一致、PUBLIC_PATHS 除外、env 未設定時素通しも仕様通り |
| A9 完了レビュー（24 枚生成 + 比較） | 未実装 | 人間作業（HANDOFF 記載通り）。Blocker ではない |

**仕様外追加**：`docs/superpowers/plans/PHASE-A-HANDOFF.md`（引継ぎメモ）と `prisma.config.ts`（A7 の url 解決）。どちらも運用上合理的。

---

## 1. 仕様との乖離

1. **A0 Before キャプチャ 12 枚の実撮影が未完**（仕様 §7 / プラン Task A0 Step 3）。ディレクトリと手順書だけ用意。HANDOFF に「A3〜A5 適用済みの現状では取れない、記憶ベースで代替」との記述あり。→ **Blocker ではない**が、`capture-baseline.md` の「Phase A 着手前」手順は事実上期限切れ。A9 レビュー時に注釈を入れるべき。
2. **A3 Step 1 で Imagen 4 Ultra 実装に `seed` 引数を渡していない**（仕様 §3 の `ImageProvider` インターフェース例は `seed?: number` を含む）。型定義・FLUX 側は維持、Imagen4 側のみ未送信。smoke test で Google AI Studio が非対応と判明したための **意図的逸脱**（`imagen4.ts` L31-32 にコメント、`fix(A3)` コミットで理由明示）。→ 仕様本文に「seed 必須」の記述はないため許容範囲だが、`providerMetadata.seed` に呼び出し側の値がそのまま記録される（使われていないのに）点は誤解を招く。
3. **A9 Step 1（24 枚生成）、Step 2（比較レポート）、Step 3（red-team）、Step 7（Vercel Preview 確認）、Step 8（phase-a-complete タグ）が未実施**。人間作業前提で正常、Blocker ではない。

---

## 2. プラン記載コードとの整合

| 対象 | 整合 | 意図的逸脱 | 非意図的 |
|---|---|---|---|
| `types.ts` | 一致 | なし | なし |
| `imagen4.ts` | 概ね一致 | `seed` を `config` に入れない（smoke test 起因、コメント済み） | `providerMetadata.seed` は従来通り残す（未使用値を記録） |
| `flux.ts` | 概ね一致 | `replicate.run()` 戻り値の解釈を SDK 1.x 系の `FileOutput.url()` 形式にも拡張（プランは string/array のみ想定） | なし。むしろ堅牢化 |
| `index.ts` | 完全一致 | なし | なし |
| `api/generate-image/route.ts` | 完全一致 | なし | なし |
| `ModelSelector.tsx` | 完全一致 | なし | なし |
| `middleware.ts` | 完全一致 | なし | なし |
| `schema.prisma` | 一致（`url` は `prisma.config.ts` 経由、Prisma 6 機能） | Prisma 公式の新スキームに追従。仕様§5 のサンプルとは形式が異なるが機能的に等価 | なし |

プラン記載コードと実コードの差分はほぼない。逸脱はすべて理由付きで記録されている。

---

## 3. 型・引数の不整合（具体例）

1. **`ModelSelector` の型がローカル定義**（`'imagen4' \| 'flux'` のリテラルユニオン）で、`ImageProviderId` 型を共有していない。`src/lib/image-providers/types.ts` で定義済みなので流用すべき。将来プロバイダが 3 種目に増えたとき取りこぼす。
2. **`Step3Editor` の `lastProviderUsed` が `string | null`** だが実際に入る値は `ImageProviderId`。`string` で受けているため、fallback 警告文の表示ロジックで型保証が失われている。`ImageProviderId | null` に締めるべき。
3. **`save-banner/route.ts` の `catch(e: any)`** が 2 箇所。プロジェクト全体で `unknown` 化している他のルートと揃っていない（A5 の generate-copy・generate-image は `unknown`）。A6 で触ったのに未修正なのは惜しい。
4. **`imagen4.ts` の `providerMetadata.seed`** に、使われていない `params.seed` を記録し続けている。呼び出し元が「seed 付きで生成された」と誤認する可能性。`undefined` に固定するか `note: 'seed not supported'` を残すほうが明確。
5. **`handleSaveList`（page.tsx L146）の `imageModel: lastProviderUsed ?? imageModel`** は型上は `string | null ?? 'imagen4'|'flux'` で `string` に広がる。Prisma の `imageModel String?` とは互換だが、`ImageProviderId` に narrow したい場合は `lastProviderUsed as ImageProviderId | null` で型保証を強める余地。

---

## 4. コミットメッセージ

Conventional commit 形式＋タスク番号プレフィックスが全コミットで守られている：

```
chore(A0+A1), refactor(A2), feat(A3), feat(A4), feat(A5),
feat(A6), feat(A7), feat(A8), fix(A3), docs
```

特段の是正点なし。

---

## 5. PR 提出前に直すべきこと（優先度順、5 項目以内）

1. **[Important] `ModelSelector` / `Step3Editor` の型を `ImageProviderId` に統一**（3 箇所: `ModelSelector.Props.value/onChange`、`Step3Editor.Props.imageModel/setImageModel/lastProviderUsed`、`page.tsx` の `useState`）。プロバイダ追加時のタイプセーフを確保。
2. **[Important] `imagen4.ts` の `providerMetadata.seed` を固定値/注釈に変更**。現状は未使用値を吐くので誤解を招く。`seedRequested: params.seed, seedApplied: false` 等に明示化する。
3. **[Suggestion] `save-banner/route.ts` の `catch(e: any)` を `catch(e: unknown)` に揃える**。A6 改変コミットに含めるべきだった整合。
4. **[Suggestion] `scripts/capture-baseline.md` に「Phase A 適用後は main checkout で Before を取り直す」注記を追記**。HANDOFF §A9 Step 2 の運用案をドキュメントに反映。
5. **[Suggestion] `.gitignore` に `!.env.example` を追加**（HANDOFF §5 で既知事項として挙がっている）。今後 `.env.example` 編集時の `-f` 強制追加を不要化。

いずれも Critical（PR ブロッカー）ではなく、**A9 の 24 枚生成と red-team レビュー完了が PR 前提条件**。A9 着手までに 1〜3 を処理し、4〜5 は PR 本文の TODO に格下げでも可。

---

## 総評

仕様・プランに対する忠実度はきわめて高い。プランコードをほぼそのまま写しつつ、smoke test で判明した現実（Imagen 4 seed 非対応、Replicate SDK 1.x の FileOutput 形式）に対して**理由付きで小幅に逸脱**しており、コミットメッセージも整っている。未完了タスクは人間作業依存で正常、blocker 化しているものはない。型の締めとドキュメントの注記を追加すれば Phase A は完了判定して問題ない。
