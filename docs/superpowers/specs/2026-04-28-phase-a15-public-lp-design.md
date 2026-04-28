# Phase A.15: 公開 LP（autobanner.jp/lp01, /lp02）+ Plan C 問合せフォーム 設計書

**作成日:** 2026-04-28
**ステータス:** ブレインストーミング完了 / 実装プラン未作成（A.14 完了後に作成）
**前提:** Phase A.12 live mode 完了 + Phase A.14 完了
**配置場所:** `docs/superpowers/specs/2026-04-28-phase-a15-public-lp-design.md`

---

## 1. 背景・目的

事業計画書 v2 の Phase A.15。これまでベータ運用（whitelist `ALLOWED_EMAILS`）で構築してきた「勝ちバナー作る君」を**世間に公開**するための LP を制作する。

### 1.1 戦略的価値

1. **集客チャネル獲得**: Meta 広告 / 個人発信（X/note）からの誘導先を作る
2. **A/B テスト基盤**: `/lp01`（機能訴求）と `/lp02`（時短訴求）を並走させ、転換率データを集める
3. **Plan C（個別商談）動線**: 大手・代理店の個別契約案件を取り込む問合せフォーム
4. **PMF 達成への加速**: Beta 100 名（FRIENDS コード使い切り）→ Public で 1,200 リード/年（事業計画 v2 目標）の入り口

### 1.2 公開の前提条件

- ✅ Phase A.12 live mode 完了（実カードで購入できる）
- ✅ Phase A.14 完了（Free 段階制限 + Pro メータード）= プラン区分の意味が完成
- ✅ KYC 完了（株式会社4th Avenue Lab・身分証明書審査）
- ⏳ ALLOWED_EMAILS の whitelist 解除 → 全公開化

---

## 2. スコープ定義

### 2.1 含むもの（A.15）
- **`/lp01` 公開ページ**（機能訴求型ヒーロー）
- **`/lp02` 公開ページ**（時短訴求型ヒーロー）
- **`/contact` 問合せページ**（Plan C 個別商談用、Formspree 連携）
- **共通セクション部品**（Hero / Problem / Solution / Features / Pricing / FAQ / CTA）を共通化
- **計測タグ統合**: GA4（既存？要確認）+ Microsoft Clarity
- **OGP / 構造化データ**（SEO + SNS シェア対応）
- **middleware 公開化**: `/lp01`, `/lp02`, `/contact` を whitelist 不要に（既存対応済 `/lp**`）
- **A/B 振り分け SOP**: 広告の出稿先 URL で /lp01 と /lp02 を振り分け（コード側で振り分けロジックは持たない）

### 2.2 含まないもの
- ALLOWED_EMAILS の解除（運用判断、別途実施）
- LP からの新規ユーザー登録フローの強化（既存 Google SSO 流入）
- 多言語化（日本語のみ、英語版は B フェーズ）
- ブログ記事・SEO 記事制作（コンテンツマーケは別の打ち手）

### 2.3 完了基準
1. `https://autobanner.jp/lp01` と `/lp02` が公開アクセス可能（whitelist なしで閲覧）
2. 各 LP のヒーロー → 料金表 → CTA（無料で試す or Pro にする）の動線が機能
3. 「無料で試す」CTA → Google SSO → ベータ運用と同じ生成フロー
4. 「Pro にする」CTA → Stripe Checkout 直接遷移（`?promo=FRIENDS` 等のパラメータ対応）
5. `/contact` フォーム → Formspree 受信 → satoru@4thavenuelab.net にメール
6. GA4 で /lp01 vs /lp02 の流入数 / CTR / 転換率を計測可能
7. Microsoft Clarity で heatmap + session replay 確認可能

---

## 3. 主要設計判断（autonomous 決定）

| Q | 論点 | 決定 |
|---|---|---|
| Q1 | LP 構成 | **8 セクション固定**: Hero / Problem / Solution / Features / Comparison / Pricing / FAQ / Final CTA |
| Q2 | A/B 訴求軸 | `/lp01` = **機能訴求**（17 サイズ一括生成 / 勝ちバナー学習）/ `/lp02` = **時短訴求**（テンプレ作成 0 時間 / 1 ブリーフで 17 サイズ） |
| Q3 | 共通コピー | メインキャッチ「**テンプレを作る時間、もう要りません**」（事業計画 spec 継承）/ サブ「8 割 AI + 2 割あなた、で勝ちバナーを 17 サイズ一括」 |
| Q4 | デザイン方針 | **既存 autobanner.jp（ダーク + emerald）継承**。Hero は大きい h1 + 動画/画像、視覚インパクト強調 |
| Q5 | 料金表 | **3 列固定**（Free / Starter / Pro）+ 下部に小さく Plan C 個別商談リンク。Pro を中央 + 「人気」バッジ |
| Q6 | CTA 配置 | **3 箇所**: Hero / Pricing / Final CTA。3 通りとも「無料で試す」（Free 体験）+ 「Pro にする」（Checkout） |
| Q7 | 顧客の声 | **Beta 期間中（ローンチ初期）は省略**。実績データが溜まり次第、Comparison セクションに「実際の事例」として追加（B フェーズ） |
| Q8 | 計測 | **GA4 + Microsoft Clarity の 2 本立て**。Stripe Conversion はサブ（A.14 後に有効化検討） |
| Q9 | A/B 振り分け方式 | **広告の出稿先 URL を使い分けるだけ**（lp01 と lp02 は別ページ）。コード側で random は持たない（計測がシンプル） |
| Q10 | 問合せフォーム | **既存 Formspree (`xaqaazaz`) 流用**（4thavenuelab.net 用と同じ）。専用 ID は当面不要 |
| Q11 | OGP 画像 | **共通 1 枚**（autobanner ロゴ + 「テンプレを作る時間、もう要りません」のグラフィック） |
| Q12 | 動画素材 | **MVP は静止画のみ**。動画は B フェーズで追加（撮影 / 編集コスト先送り） |
| Q13 | フッター | **会社情報 + プライバシーポリシー + 利用規約 + 問合せ + Twitter**（最小限） |
| Q14 | レスポンシブ | **モバイルファースト**。Hero は SP で縦積み、PC で 2 カラム |
| Q15 | アクセシビリティ | WAI-ARIA ラベル + キーボード操作 + コントラスト比 4.5:1 確保 |

---

## 4. ページ構成詳細

### 4.1 共通セクション（部品化）

| セクション | 内容 |
|---|---|
| **Hero** | ヒーローコピー + サブコピー + メイン CTA + 視覚要素（バナー出力例 4-5 枚並列） |
| **Problem** | 「こんな経験ありませんか?」3 ペイン: テンプレ作成 / サイズ違いの依頼追加 / 検証データなし |
| **Solution** | 4 ステップ図解: ① ブリーフ書く ② AI 生成 ③ 微調整 ④ 17 サイズ一括 DL |
| **Features** | 機能カード 6 個: 17 サイズ / 勝ちバナー学習 / Brand Kit / プロンプト閲覧 / 履歴管理 / お気に入り |
| **Comparison** | 3 列比較表: 外注（コスト・時間）/ 内製テンプレ（柔軟性なし）/ 勝ちバナー作る君（◎） |
| **Pricing** | Free / Starter / Pro 3 列カード + Plan C 個別商談リンク。Pro に「人気」バッジ |
| **FAQ** | アコーディオン 8〜10 問: 解約 / 商用利用 / クレカ以外の決済 / 他社サービスとの違い 等 |
| **Final CTA** | 「今すぐ無料で試す」大きいボタン + Pro Checkout サブボタン |

### 4.2 /lp01 ヒーロー（機能訴求）

```
ヒーロー H1: 1 ブリーフで、17 サイズ一括生成
ヒーロー H2: 勝ちバナーを学習する AI が、ECサイトのバナー制作時間を 1/10 に
CTA1: 今すぐ無料で試す（3 セッション無料）
CTA2: Pro にする ¥14,800/月
視覚要素: 17 サイズの実バナー出力例をマトリクス表示（縦長 / 横長 / 正方形）
```

### 4.3 /lp02 ヒーロー（時短訴求）

```
ヒーロー H1: テンプレを作る時間、もう要りません
ヒーロー H2: ブリーフ → 完成まで 90 秒。あなたは戦略に集中できます
CTA1: 今すぐ無料で試す（3 セッション無料）
CTA2: Pro にする ¥14,800/月
視覚要素: 「Before（テンプレ手作業 6 時間）/ After（90 秒）」のビフォアフター比較
```

### 4.4 /contact ページ（Plan C 個別商談）

```
H1: 大規模ご利用 / 代理店契約のご相談
リード文: 月 100 回を超えるご利用 / 代理店契約・複数名利用 / カスタム機能などのご要望はこちら
フォーム項目（Formspree 経由）:
- お名前（必須）
- メールアドレス（必須）
- 会社名（任意）
- 月の生成想定回数（プルダウン: 〜100 / 100-500 / 500-1000 / 1000+）
- ご相談内容（テキストエリア、必須）
- プライバシーポリシー同意（チェック必須）
送信先: satoru@4thavenuelab.net（Formspree xaqaazaz 経由）
```

---

## 5. 計測設計

### 5.1 GA4 イベント

| イベント名 | 発火タイミング | パラメータ |
|---|---|---|
| `page_view` | LP 表示時（標準） | page_path, lp_variant (lp01/lp02) |
| `cta_click_free` | 「無料で試す」CTA クリック | section (hero/pricing/final), lp_variant |
| `cta_click_pro` | 「Pro にする」CTA クリック | section, lp_variant |
| `cta_click_starter` | 「Starter にする」CTA クリック | section, lp_variant |
| `pricing_view` | Pricing セクション 50% 以上スクロール | lp_variant |
| `faq_open` | FAQ アコーディオン展開 | question_id |
| `contact_submit` | /contact フォーム送信成功 | lp_source（参照元） |

### 5.2 Microsoft Clarity

- セッション再生 + heatmap 自動取得
- LP のスクロール率 / クリック率を可視化
- LP 別 funnel 分析

### 5.3 Stripe Conversion（任意・A.14 後）

- Stripe Dashboard の「Conversion」機能で Checkout 完了までのトラッキング

---

## 6. ファイル/モジュール構成

### 6.1 新規作成

```
src/app/lp01/
├── page.tsx                       # /lp01 server component
├── Lp01Hero.tsx                   # /lp01 専用 hero
└── layout.tsx                     # （オプション）LP 専用 layout で auth スキップ

src/app/lp02/
├── page.tsx                       # /lp02 server component
└── Lp02Hero.tsx                   # /lp02 専用 hero

src/app/contact/
├── page.tsx                       # /contact server component
└── ContactForm.tsx                # Formspree 連携 client component

src/components/lp/
├── ProblemSection.tsx
├── SolutionSection.tsx
├── FeaturesSection.tsx
├── ComparisonSection.tsx
├── PricingSection.tsx             # Free/Starter/Pro 3 カード + CheckoutButton 統合
├── FaqSection.tsx
├── FinalCta.tsx
├── LpFooter.tsx
└── LpAnalytics.tsx                # GA4 + Clarity スクリプト挿入
```

### 6.2 変更

| ファイル | 変更内容 |
|---|---|
| `src/middleware.ts` | `/lp01`, `/lp02`, `/contact`, `/api/contact` を PUBLIC_PATHS に確認（既存 /lp** プレフィックスでカバー済の可能性あり、要確認） |
| `src/app/layout.tsx` | OGP メタタグ + GA4 / Clarity スクリプト注入（条件付きで LP のみ） |
| `package.json` | （必要なら）`@vercel/analytics` または GA4 用 SDK 追加 |

### 6.3 環境変数

```
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CLARITY_PROJECT_ID=xxxxxxxxxx
FORMSPREE_FORM_ID=xaqaazaz   # 既存、確認のみ
```

GA4 / Clarity の ID は事前に取得（GA4 はもしかしたら既存？要確認）。

---

## 7. デザイントークン

既存 autobanner.jp に合わせる:

| 要素 | 値 |
|---|---|
| 背景 | `#0F172A`（slate-900）|
| 主アクセント | `#10B981`（emerald-500）|
| サブアクセント | `#F59E0B`（amber-500、CTA 強調用）|
| テキスト主 | `#F8FAFC`（slate-50）|
| テキスト副 | `#94A3B8`（slate-400）|
| ボーダー | `#1E293B`（slate-800）|
| ロゴ font | （既存サイトに合わせる）|

---

## 8. 実装順序（CP 分割・概要）

実装プランは別途作成（A.14 完了後）。概要:

### CP1: 共通部品（1.5 日）
- ProblemSection / SolutionSection / FeaturesSection / ComparisonSection / FaqSection / FinalCta / LpFooter
- PricingSection（Free/Starter/Pro 3 カード + CheckoutButton 統合）

### CP2: /lp01 ページ（0.5 日）
- Lp01Hero（機能訴求コピー）+ 共通部品の組み立て

### CP3: /lp02 ページ（0.5 日）
- Lp02Hero（時短訴求コピー）+ 共通部品の組み立て

### CP4: /contact ページ + Formspree 連携（0.5 日）
- ContactForm + Formspree POST

### CP5: 計測 + OGP（0.5 日）
- LpAnalytics（GA4 + Clarity）注入
- OGP 画像作成 + メタタグ

### CP6: 公開準備 + ALLOWED_EMAILS 解除判断（0.5 日）
- middleware 確認
- 本番デプロイ + Lighthouse スコア確認
- ALLOWED_EMAILS 解除（運用判断）

**累計工数: 4 営業日**

---

## 9. リスクと緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| ALLOWED_EMAILS 解除でスパムサインアップ | DB 肥大 + 課金漏れリスク | 解除前に NextAuth に email 検証強制 / IP rate-limit 検討 |
| LP のコピー誤読（過剰な期待） | 解約率上昇 | コピーは「3 セッション無料で試せます」を最前面、Pro 訴求は控えめに |
| LP 計測タグ追加で初期表示遅延 | LCP 悪化 | GA4 / Clarity を `next/script strategy="afterInteractive"` で読込 |
| /contact フォームのスパム | 運営工数増 | Formspree の hCaptcha 統合（標準機能） |
| OGP 画像の品質低 | SNS シェア時の見え方悪 | LP デザイン完了後に Figma で OGP 専用画像を作成（1200x630px） |
| /lp01 と /lp02 のコピー齟齬 | A/B 比較の妥当性低下 | 共通セクション（Problem 以下）は完全同一、Hero のみ A/B 化 |

### 9.1 ロールバック手順

- **L1（即座）**: middleware の PUBLIC_PATHS から `/lp01`, `/lp02` 削除 → 認証必須化
- **L2（数分）**: feature ブランチ revert merge
- **L3**: tag `phase-a14-complete` に巻き戻し

---

## 10. SEO / OGP

### 10.1 メタタグ（共通）

```html
<title>勝ちバナー作る君 — 1 ブリーフで 17 サイズ一括生成（autobanner.jp）</title>
<meta name="description" content="EC サイトのバナー制作時間を 1/10 に。AI が勝ちバナーを学習し、17 サイズを 90 秒で一括生成します。3 セッション無料体験。" />
<meta property="og:title" content="勝ちバナー作る君 — テンプレを作る時間、もう要りません" />
<meta property="og:description" content="ブリーフ → 17 サイズ一括生成。1/10 の時間で勝ちバナーを作れる AI ツール。" />
<meta property="og:image" content="https://autobanner.jp/og-image.png" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://autobanner.jp/" />
<meta name="twitter:card" content="summary_large_image" />
```

### 10.2 構造化データ（Schema.org）

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "勝ちバナー作る君",
  "description": "AI バナー一括生成ツール",
  "applicationCategory": "DesignApplication",
  "operatingSystem": "Web",
  "offers": [
    { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "JPY" },
    { "@type": "Offer", "name": "Starter", "price": "3980", "priceCurrency": "JPY" },
    { "@type": "Offer", "name": "Pro", "price": "14800", "priceCurrency": "JPY" }
  ]
}
```

---

## 11. 公開後の運用

### 11.1 監視ダッシュボード（A.15 内では作らない、別 Phase）
- GA4 で /lp01 vs /lp02 転換率比較（週次）
- Clarity で heatmap 確認（月次）
- Stripe Dashboard で MRR 推移（週次）

### 11.2 改善サイクル
- 2 週間ごとに転換率データレビュー → 負けている方の Hero コピーを差し替え
- 3 ヶ月で勝ち負けが固定化したら一方を停止 → 別の訴求軸（例: ROI 訴求 /lp03）を追加

### 11.3 Plan C 問合せ対応 SOP
- 問合せ受信 → 24h 以内に返信（自動化なし、手動）
- 月 5 件以上の問合せが定常化したら Notion or Trello で案件管理

---

## 12. 参考リンク

- 事業計画 spec v2: `docs/superpowers/specs/2026-04-26-business-plan.md`
- 前 Phase（A.12）: `docs/superpowers/specs/2026-04-28-phase-a12-billing-design.md`
- 前 Phase（A.14）: `docs/superpowers/specs/2026-04-28-phase-a14-metered-billing-design.md`
- Formspree（既存 ID `xaqaazaz`）: 4thavenuelab.net 設定で流用
- Microsoft Clarity 公式: https://clarity.microsoft.com/
- GA4 公式: https://analytics.google.com/

---

## 13. 次フェーズへの接続

A.15 完了後の選択肢:

- **B.1（薬機法 AI スコア）**: Pro 限定キラー機能。LP に「薬機法 OK」訴求を追加 → 健康食品 EC 顧客獲得
- **B.2（インペインティング）**: ユーザーが部分的に修正できる機能。LP の「8 割 AI + 2 割あなた」訴求の根拠強化
- **別事業（薬機法 AI チェッカー）**: INK YOU UP 配下で別ドメイン展開
- **海外展開（多言語化）**: B/C 両フェーズ後の中長期検討
