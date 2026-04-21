# Phase A.5 コードレビュー（仕様書・プラン照合）

- レビュー日: 2026-04-21
- ブランチ: `feature/phase-a5-ad-quality`（7 commits: 410ff78 〜 03aeae1）
- 仕様: `docs/superpowers/specs/2026-04-21-phase-a5-ad-quality.md`
- プラン: `docs/superpowers/plans/2026-04-21-phase-a5-ad-quality.md`

## 総評

7 タスクの主要要件（8 アングル生成、PriceBadge 5 形状、CTA 5 種、renderRichText emphasisRatio、ANGLE_KEYWORDS 注入、4×2 グリッド、Prisma 拡張）は**ほぼプラン通りに実装**され、コピーペーストレベルでプラン記載コードと一致する。ただし「宣言したが未使用」のユーティリティと、仕様書にのみ記載された補正ロジックが抜けている。critical な仕様漏れは 3 件。

---

## 1. 仕様との乖離（未実装・不足）

1. **【Critical】§3.4 ターゲット層補正が完全未実装**  
   仕様では `inferred_target_demographic` を見て 30 代以下 +0.5x、50 代以上 -0.5x、BtoB -0.5x と emphasis_ratio を補正するロジックが必要だが、`page.tsx` / `banner-state.ts` / `generate-copy` のいずれにも痕跡なし（grep で 0 件）。プランにも記述がないため「プラン側の脱落」が原因と推定。

2. **【Critical】§3.2 `computeDefaultBadgePosition` が宣言のみで呼び出しゼロ**  
   `banner-state.ts:136` にエクスポートされているが、`page.tsx` の `selectAngle` ではバッジの position 補正を行わず、Gemini 返却値をそのまま `setActiveBadge(vAny.priceBadge ?? null)` している。「人物位置 × アングル型から推奨位置を自動配置」という仕様核心が機能していない。

3. **【Critical】§3.3 `autoSelectCta(category, urgency)` が宣言のみで未使用**  
   Gemini が返す `ctaTemplate.id` をそのまま信用する実装になっており、LP 解析で得た `productCategory` と `urgency` を用いた「商材 × 緊急度マトリクス自動選定」のフォールバック経路が存在しない。`analyze-lp` は `productCategory` を返すのに誰も読んでいない。

4. **【Important】§3.2 フォールバック（アングル別定型文）未実装**  
   LP から価格抽出失敗時に `numeric→初回限定¥{number}` `fear→今だけ50%OFF` 等の定型文で補う仕様（§6 のエラーハンドリング表にも記載）があるが、実装なし。Gemini が null を返したら常に非表示になる。

5. **【Important】§3.3 ホバー仕様「緊急度 high で animate-pulse」**  
   仕様は「緊急度が high のときだけ pulse」。実装では `cta-red-urgent` クラスに静的に `animate-pulse` が入っているため、`urgency=low` で赤テンプレを選んだときも常時脈動する。html2canvas 書き出しでの揺れも未対策（プラン末尾の「既知の判断ポイント 2」で保留と明記されていたが未対応のままマージ待ち）。

6. **【Important】§6 エラーハンドリング 3 件が未実装**  
   - 「Gemini が 8 個未満返す → 欠けたアングル ID を検出し benefit 生成ロジックで補填」：補填処理なし、8 未満でもそのまま表示。  
   - 「`priceBadge` 不正スキーマ → null フォールバック」：shape バリデーション不在、未知 shape なら `BADGE_STYLES[shape] ?? BADGE_STYLES['circle-red']` で形状は吸収されるがスキーマ検証はしていない。  
   - 「`ctaTemplate` 未知 ID → cta-orange-arrow フォールバック」：`CtaButton` 側に ?? があり OK。ただし `Step3Editor` の `setActiveCtaTemplateId` には任意 ID がそのまま入る。

7. **【Suggestion】§3.2 `emphasisNumber` 分離表示の堅牢性**  
   `PriceBadge.tsx` は `badge.text.split(badge.emphasisNumber)` を使うが、`emphasisNumber` が `text` に含まれない場合 `before=text, after=undefined` となり `[32px]` に undefined 値が表示される（数字が出ない）。`includes` チェックが欲しい。

---

## 2. プランとの乖離（意図的 / 非意図的）

- 【非意図的】プラン Task 7 Step 1 の Prisma schema には `datasource db { provider, url = env("DATABASE_URL") }` が当然あるはずが、実ファイル（`prisma/schema.prisma`）には `url` 行が欠落。Neon 接続はおそらく `env` 直読みでなく別経路。現状動作しているなら OK だが、プラン記載の schema スニペットと差がある。
- 【非意図的】プラン Task 6 Step 3 の `analyze-lp` prompt 変更は「`Markdownブロックを含めず`」の全角/半角スペース差のみで仕様通り。ただし **プロンプトに `"productCategory"` を出力させているのに消費者ゼロ**（= §1 の 3 と同根）。
- 【意図的寄り】`Variation` 型（`page.tsx:27`）に `priceBadge` / `ctaTemplate` / `urgency` のうち `urgency` しか宣言されておらず、`selectAngle` 内で `as unknown as {...}` で強引にキャストしている。プラン Step 9 Props 追加は実施済みだが、**state 側の型が unknown 経由なので型安全性がない**。

---

## 3. 型・引数の不整合

1. **`Step2Angles.tsx:11` `priceBadge?: unknown`** と `page.tsx` 内部の `priceBadge: PriceBadge | null` が不整合。同じデータを二箇所で別型定義している。
2. **`banner-state.ts:49` `renderRichText` の引数 `emphasisRatio: EmphasisRatio` が関数本体より後の行（L86）で定義されている**。TypeScript の型エイリアスは hoist されるので実害はないが、可読性が悪くファイル頭でビルドエラーに見えるリスクあり。型定義ブロックを関数より前に移動すべき。
3. **`ANGLE_EMPHASIS_RATIO` が宣言のみで未使用**。Gemini が返す `emphasis_ratio` を信用する方針なら削除、バリデーションで使うなら参照を追加すべき。
4. **`CtaTemplate` interface（`banner-state.ts:118`）も未使用**。`Variation.ctaTemplate` は inline 型で、`CtaTemplate` は import されていない。

---

## 4. PR 提出前チェックリスト（優先度順）

1. **ターゲット層補正ロジックを実装**（§3.4）。`inferred_target_demographic` → `activeEmphasisRatio` に +/- 0.5x を反映する関数を `banner-state.ts` に追加し、`selectAngle` で適用。未実装なら仕様書に「Phase A.6 に後送」と明示して非ゴール化。
2. **`computeDefaultBadgePosition` / `autoSelectCta` を実接続**、または「Gemini 出力を優先し、フォールバック時のみ使用」の方針を明記してコメント追加。未接続のままでは dead code。
3. **CTA `animate-pulse` を urgency high のみに限定**（`CtaButton.tsx` で `className + (urgency==='high' ? ' animate-pulse':'')` に分岐、または template 側 class から pulse を除去）。html2canvas 対策も同時対応。
4. **`Variation` 型の統一**：`page.tsx` と `Step2Angles.tsx` の inline 型を `banner-state.ts` に集約し、`priceBadge: PriceBadge | null` / `ctaTemplate: CtaTemplate` / `strategy.angle_id: AngleId` を明示。`as unknown as` のキャストを削除。
5. **`PriceBadge.tsx` の `emphasisNumber` split ガード**追加 + Gemini 8 未満返却時のフォールバック（benefit 補填 or 再生成ボタン）のどちらかを最低限入れる。

---

## 備考

- プランに記載のないファイルの追加は `docs/baselines/2026-04-21-phase-a5/evaluation.md` と Prisma migration のみで、スコープ外の追加実装は検出なし。
- `provider-smoke` の png バイナリが 2 枚差分に入っているが、Task 5 Step 6 のスモークテストで上書きされたものと判断でき意図的。
