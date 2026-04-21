# Phase A.5 Red Team Review

- 日付: 2026-04-21
- 対象ブランチ: feature/phase-a5-ad-quality (main..HEAD の 7 コミット)
- レビュアー: red-team (WorldClassExecutiveOS)
- 対象資料:
  - docs/superpowers/specs/2026-04-21-phase-a5-ad-quality.md
  - docs/superpowers/plans/2026-04-21-phase-a5-ad-quality.md
  - src/lib/banner-state.ts / src/lib/cta-templates.ts / src/lib/prompts/angle-keywords.ts
  - src/components/canvas/{PriceBadge,CtaButton}.tsx
  - src/app/api/{analyze-lp,generate-copy,save-banner}/route.ts
  - src/app/page.tsx / src/components/steps/{Step2Angles,Step3Editor}.tsx
  - prisma/schema.prisma

---

## 1. 致命的リスク (failure rate 30%+, 損害大)

### C1. CTA が 2 個描画される（必ず起きる UX 破綻）
- 再現: Step3 条件画面で hasCta=yes のまま背景生成 → enterEditor が editorTexts に `id: 'cta-btn'` を push（src/app/page.tsx L385-392）。一方、Step3Editor.tsx L427-442 は `activeCtaText` が truthy なら新 CtaButton overlay を常に描画する。activeCtaText の初期値は `'今すぐ購入'`（page.tsx L135）なので selectAngle を経由しない手動フローでも必ず truthy。
- 結果: 画面下部にオレンジ角丸 Rnd の旧 CTA と、中央下に新テンプレ CTA が同時表示。html2canvas で両方キャプチャ → 2 ボタンが映った失敗バナー。AB テスト母集団を汚染。
- 推奨修正: overlay 側を hasCta==='no' || activeCtaText が null のとき非表示にし、かつ editorTexts の cta-btn push を Phase A.5 では完全に削除する（CTA は overlay に一本化）。

### C2. priceBadge.text を emphasisNumber で split する処理が壊れる
- 再現: Gemini が `{"text":"初回限定 ¥980","emphasisNumber":"980"}` を返した場合 PriceBadge.tsx L29 の `badge.text.split('980')` は `["初回限定 ¥", ""]`。ここまでは OK。しかし 「¥980」「980円」「980（カンマ入り 9,800）」「二重出現（980円の 980名限定）」「emphasisNumber が text に現れない（全角¥980 に対し半角 980 を返す）」では split 結果が [text] 単一要素になり、数字部分の `<span text-[32px]>980</span>` は常に「980」と固定描画されるが before/after の表示が崩壊。
- 結果: 「初回限定 ¥9,800」で emphasisNumber='9800' を返されるとバッジが「初回限定 ¥9,800」のまま分割できず 14px で描画、期待した 32px ジャンプが消える。あるいは全角半角ズレで空の before のみ描画される。
- 推奨修正: emphasisNumber を text から正規表現で数字抽出し直し（`/[0-9,]+/`）、split に依存しないフォールバック（数字部分だけ別 span、前後は残り文字列を再構築）を採用。さらに「emphasisNumber が text に含まれない」ケースを検知してログ+プレーン表示にフォールバック。

### C3. 既存 Banner レコード（Phase A.5 前）は問題ないが、CTA overlay の「将来の過去バナー再編集」では壊れる
- 再現: GET /api/save-banner (save-banner/route.ts L58) は priceBadge を String のまま返す。今は「過去の生成」ダッシュボード未実装なので UI には届かないが、Phase B で再編集画面が出来たとき JSON.parse 忘れで `activeBadge` に文字列が入り、`badge.shape` で型エラー。また activeCtaText の初期値 '今すぐ購入' が強制的に入るので、過去レコードの ctaText=null を上書き保存すると履歴が書き換わる。
- 結果: Phase B 接続時に App クラッシュ or 履歴データの破壊。
- 推奨修正: 今のうちに save-banner GET で priceBadge を parse して返す方針を確定。activeCtaText 初期値を空文字にし、overlay 表示条件を厳密化。さらに Prisma migration を dev 環境で適用したか履歴（prisma/migrations/配下）を確認。Neon 本番適用手順を README にメモ。

---

## 2. 重大リスク (failure rate 10-30%)

### M1. Gemini が 8 アングル中 1-2 個しか返さないケースで UI 崩壊
- 現状 generate-copy/route.ts にはフォールバック実装がない（spec 6 章で「欠けたアングルは benefit 生成ロジックで補填」と書かれているが未実装）。Step2Angles は配列をそのまま map する。3 個だけ返ると 4×2 グリッドが 3 マスに縮む。
- 推奨: Response parse 後に `AngleId` 8 種の keyed Map を作り、欠損を検出してクライアント側 alert、もしくは placeholder カード（grey disabled）を挿入する。

### M2. validateAndFixMarkTag の正規表現で漢字範囲漏れ
- L166 の `/^([ぁ-んァ-ヶ一-龠]{2,5})/` は CJK Unified Ideographs Extension A/B、JIS 第 3・第 4 水準の常用外漢字（髙、﨑 等）や「々」「〆」を拾わない。氏名・屋号訴求で頻出。また英字商品名（「PROTEIN」「GLP-1」）で始まるコピーは全く強調されない。
- 推奨: 正規表現を `/^([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9々〆ー]{2,6})/u` にし、`u` フラグ必須。

### M3. `animate-pulse` が html2canvas でキャプチャされる
- cta-red-urgent の className に `animate-pulse` 残存。html2canvas は SVG/CSS animation のフレームを非決定的にキャプチャし、opacity が 0.5〜1.0 のランダム状態で焼き付く。広告素材の一貫性が失われ、印刷/入稿 NG。
- 推奨: Step3Editor.tsx のダウンロードボタン内で `document.body.classList.add('no-anim')` を付け、global CSS で `.no-anim * { animation: none !important; }` を追加。キャプチャ直後に解除。または CTA_TEMPLATES の high-urgent を `animate-pulse` 抜きに変更し、動的強調は hover のみに限定。

---

## 3. 改善推奨 (failure rate 5-10% or 中程度)

### I1. `priceBadge.position` が 3:4 / Stories（1080×1920）canvas で大きすぎる
- BADGE_STYLES の `circle-red` / `circle-gold` は固定 120×120px。1920px 縦キャンバスで overlay margin が w*0.04=43px なので、top-right/bottom-right 時は十分収まる。しかし center-right + emphasisNumber=3 桁 (`¥29,800`) の場合、text-[32px] の内容が 120px 円内で溢れる（約 130px 要）。CSS overflow:hidden でクリップ→ 数字が途切れる。
- 推奨: PriceBadge に `minWidth` 指定＋`whitespace-nowrap` + dynamic sizing（文字数で width 伸縮）。

### I2. ジャンプ率 3x が 20 字 main_copy で画面から溢れる
- renderRichText で `<mark>` 部のみ 1.5em。20 字 * 0.8em + 5 字 * 1.5em ≈ 23.5em。fontSize 60px（page.tsx L374 初期値）× 23.5 = 1410px。Instagram 1080px 幅で確実にはみ出す。display:inline-block で改行されるが main-text の flex-grow + whitespace-pre-wrap が干渉して不規則折返し。
- 推奨: main_copy は既に 20 字制限 + `<mark>` 1 語のみだが、3x 時は fontSize を 60→48px に自動縮小、もしくは textStyle.fontSize を emphasisRatio 連動にする。

### I3. 8 アングル生成で Gemini 2.5 Pro のコスト 3 倍 + レイテンシ悪化
- 出力 tokens が 4 → 8 件なので約 2-3x。Gemini 2.5 Pro の料金は pro 系で高価格帯。1 回 5-8 円×日次 50 回 = 月 ¥10,000〜15,000。分析の 1% CTR 改善で回収できるが、現状 responseMimeType=application/json のリトライ失敗時に全捨てなのでリスク高。
- 推奨: 8 アングル生成を「抽象 4 + 具体 4 の 2 バッチ並列リクエスト」に分割。失敗時は片側のみ fallback。lpText.slice(0,15000) を 8000 まで削ってもコスト -30%。

---

## 4. 今すぐ直すべきこと（優先度順）

### P1. CTA 2 重描画の撲滅（致命度: 最高、所要: 15 分）
ファイル: src/app/page.tsx / src/components/steps/Step3Editor.tsx

修正 1 - page.tsx enterEditor の cta-btn push を削除:
```tsx
// L385-392 を削除（旧 Rnd CTA は Phase A.5 で廃止）
// if (hasCta === 'yes') { initialElements.push({ id: 'cta-btn', ... }) }
```

修正 2 - Step3Editor.tsx overlay を hasCta フラグで制御:
```tsx
// L427
{props.activeCtaText && props.hasCta !== 'no' && (
```
Props に `hasCta` を必ず渡し、activeCtaText 初期値を page.tsx L135 で空文字 `''` にする。

### P2. priceBadge.text 分割ロジックの堅牢化（致命度: 高、所要: 30 分）
ファイル: src/components/canvas/PriceBadge.tsx

```tsx
if (badge.emphasisNumber) {
  const idx = badge.text.indexOf(badge.emphasisNumber);
  if (idx === -1) {
    // fallback: emphasisNumber が text に無い → 数字自動抽出
    const m = badge.text.match(/([0-9,]+)/);
    if (!m) return <div className={base} style={style}><span>{badge.text}</span></div>;
    const [num] = m;
    const before = badge.text.slice(0, m.index);
    const after = badge.text.slice((m.index ?? 0) + num.length);
    return (/* before 14px + num 32px + after 14px */);
  }
  const before = badge.text.slice(0, idx);
  const after = badge.text.slice(idx + badge.emphasisNumber.length);
  // ... 既存描画
}
```

### P3. animate-pulse をキャプチャ時に停止（致命度: 中、所要: 10 分）
ファイル: src/components/steps/Step3Editor.tsx / src/app/globals.css

`.capture-mode *, .capture-mode *::before, .capture-mode *::after { animation: none !important; transition: none !important; }`
ダウンロードボタン onClick 内で `canvasRef.current.classList.add('capture-mode')` → html2canvas 完了後 remove。handleSaveList も同様。

---

## 付録: Gemini 出力のスキーマ検証が未実装（設計書 6 章のフォールバック表と差分）
- `priceBadge` 不正 shape: BADGE_STYLES で nullish coalescing により circle-red に fallback（実装済）。
- `ctaTemplate.id` 未知: CTA_TEMPLATES で cta-orange-arrow fallback（実装済）。
- アングル ID 重複: 検出未実装 → Task 1 で Gemini 側に「同 angle_id は 1 回のみ」を明記、サーバ側で dedupe する。
- `<mark>` 0 個/2 個以上: validateAndFixMarkTag で対応済（ただし M2 の漢字範囲問題あり）。
- emphasisRatio 未指定: 初期値 '2x' で fallback（実装済）。

---

## 判定
- Phase A.5 のコアコンセプト（8 アングル + 価格バッジ + CTA テンプレ + ジャンプ率）は実装されており、AB テスト投入の価値はある。
- ただし上記 P1/P2/P3 を直さず本番投入すると、初日に「CTA が 2 個」「バッジの数字が途切れる」「ダウンロード画像がフレームごとに違う」のクレームが発生する確率 80%+。
- 推奨: P1-P3 を 1 時間で fix → red-team 再レビュー → 手動受入 24 枚 → main merge。
