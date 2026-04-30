# Phase A.15: 公開 LP 実装プラン

**作成日:** 2026-04-30
**Spec:** [docs/superpowers/specs/2026-04-28-phase-a15-public-lp-design.md](../specs/2026-04-28-phase-a15-public-lp-design.md)

**Goal:** `/lp01`（機能訴求）/ `/lp02`（時短訴求）/ `/contact`（Plan C 問合せ）を公開。共通 8 セクションを部品化、Hero のみ A/B 化。GA4 + Clarity は env 駆動でグレースフル。

**Test 方針:** プロジェクトはテストフレーム未導入。各タスクは「TypeScript ビルド + 手動表示確認」で検証。

---

## ファイル構成マップ

### 新規作成

| ファイル | 役割 |
|---|---|
| `src/components/lp/LpHeader.tsx` | LP 共通ヘッダー（ロゴ + signin 導線） |
| `src/components/lp/ProblemSection.tsx` | 「こんな経験ありませんか?」3 ペイン |
| `src/components/lp/SolutionSection.tsx` | 4 ステップ図解 |
| `src/components/lp/FeaturesSection.tsx` | 機能カード 6 個 |
| `src/components/lp/ComparisonSection.tsx` | 3 列比較表 |
| `src/components/lp/PricingSection.tsx` | Free/Starter/Pro + Plan C リンク |
| `src/components/lp/FaqSection.tsx` | アコーディオン 8 問 |
| `src/components/lp/FinalCta.tsx` | 最後の CTA ブロック |
| `src/components/lp/LpFooter.tsx` | 会社情報・規約・問合せフッター |
| `src/components/lp/LpAnalytics.tsx` | GA4 + Clarity スクリプト挿入（env 駆動） |
| `src/components/lp/LpHero.tsx` | Hero 共通レイアウト（タイトル/サブ/CTA を props） |
| `src/app/lp01/page.tsx` | /lp01（機能訴求）ページ |
| `src/app/lp02/page.tsx` | /lp02（時短訴求）ページ |
| `src/app/contact/page.tsx` | /contact ページ |
| `src/app/contact/ContactForm.tsx` | Formspree 連携クライアントコンポーネント |
| `src/app/lp01/layout.tsx` | LP 専用 layout（auth セッション不要、analytics 注入） |
| `src/app/lp02/layout.tsx` | 同上 |
| `src/app/contact/layout.tsx` | 同上 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `src/middleware.ts` | `/contact` を PUBLIC_PATHS に追加 |
| `src/app/layout.tsx` | OGP メタタグ追加 |

---

## CP1: 共通基盤

### Task 1: feature ブランチ + 共通 LP コンテナ

- [ ] `git checkout -b feat/phase-a15-public-lp`
- [ ] `LpHeader.tsx` / `LpFooter.tsx` 作成
- [ ] `LpHero.tsx` 作成（props: h1, h2, ctaPrimary, ctaSecondary, visualSlot）
- [ ] ビルド確認 + コミット

### Task 2: Problem / Solution セクション

- [ ] `ProblemSection.tsx`（3 ペイン: テンプレ作成 / サイズ違い / 検証なし）
- [ ] `SolutionSection.tsx`（4 ステップ）
- [ ] ビルド + コミット

### Task 3: Features / Comparison セクション

- [ ] `FeaturesSection.tsx`（6 機能カード）
- [ ] `ComparisonSection.tsx`（外注 / 内製 / 勝ちバナー作る君）
- [ ] ビルド + コミット

### Task 4: Pricing セクション

- [ ] `PricingSection.tsx`: Free / Starter / Pro 3 カード
- [ ] CheckoutButton 統合（Pro/Starter）
- [ ] Free は `/signin` 誘導
- [ ] Plan C 個別商談 → `/contact` リンク
- [ ] ビルド + コミット

### Task 5: FAQ + FinalCta

- [ ] `FaqSection.tsx`: アコーディオン 8 問（解約 / 商用利用 / 決済 / 他社比較 / 等）
- [ ] `FinalCta.tsx`: 大きい無料 CTA + Pro サブ
- [ ] ビルド + コミット

### Task 6: LpAnalytics

- [ ] `LpAnalytics.tsx`: GA4 + Clarity スクリプト
- [ ] env: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_CLARITY_PROJECT_ID`（未設定時は no-op）
- [ ] `next/script strategy="afterInteractive"` で読込
- [ ] ビルド + コミット

---

## CP2: /lp01 ページ

### Task 7: /lp01 ページ + layout

- [ ] `src/app/lp01/layout.tsx`（OGP / analytics）
- [ ] `src/app/lp01/page.tsx`（機能訴求 Hero + 共通セクション組み立て）
- [ ] H1: "1 ブリーフで、17 サイズ一括生成"
- [ ] H2: "勝ちバナーを学習する AI が、ECサイトのバナー制作時間を 1/10 に"
- [ ] CTA: "今すぐ無料で試す（3 セッション無料）" / "Pro にする ¥14,800/月"
- [ ] ビルド + 手動表示確認 + コミット

---

## CP3: /lp02 ページ

### Task 8: /lp02 ページ + layout

- [ ] `src/app/lp02/layout.tsx`
- [ ] `src/app/lp02/page.tsx`（時短訴求 Hero + 共通セクション）
- [ ] H1: "テンプレを作る時間、もう要りません"
- [ ] H2: "ブリーフ → 完成まで 90 秒。あなたは戦略に集中できます"
- [ ] ビルド + 手動表示確認 + コミット

---

## CP4: /contact ページ

### Task 9: /contact + Formspree 連携

- [ ] `src/app/contact/layout.tsx`
- [ ] `src/app/contact/page.tsx`
- [ ] `src/app/contact/ContactForm.tsx`: 名前 / メール / 会社 / 月想定回数 / 相談内容 / 規約同意
- [ ] Formspree POST: `https://formspree.io/f/xaqaazaz`
- [ ] middleware に `/contact` 追加
- [ ] ビルド + コミット

---

## CP5: OGP + メタタグ

### Task 10: OGP メタタグ追加

- [ ] `src/app/layout.tsx` に OGP / Twitter Card メタ追加
- [ ] OGP 画像は当面プレースホルダ（`/og-image.png`）パス指定のみ。実画像は後日。
- [ ] 構造化データ（Schema.org SoftwareApplication）追加
- [ ] ビルド + コミット

---

## CP6: マージ + デプロイ

### Task 11: main マージ + tag

- [ ] 最終ビルド
- [ ] main マージ + tag `phase-a15-complete`
- [ ] push
- [ ] memory 更新

---

総タスク数: 11
