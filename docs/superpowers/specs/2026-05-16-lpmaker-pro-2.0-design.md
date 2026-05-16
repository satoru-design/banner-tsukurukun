# LP Maker Pro 2.0 設計書

**作成日:** 2026-05-16
**ステータス:** ブレインストーミング完了 / 実装プラン作成準備
**前提:** autobanner.jp Phase A.16 完了（lp01 改修 + In-LP Try 体験）
**配置場所:** `docs/superpowers/specs/2026-05-16-lpmaker-pro-2.0-design.md`
**関連プロダクト:** autobanner.jp（バックエンド完全共有）/ lpmaker-pro.com（旧資産・継承フロント）

---

## 0. エグゼクティブサマリ

旧 `lpmaker-pro.com` を正統進化させ、autobanner.jp のバックエンド（認証・課金・DB）を完全共有する新規 SaaS **「LP Maker Pro 2.0」** を構築する。

- **1行ポジショニング**: 「1 つのブリーフで、LP と広告 17 サイズが同時に生まれる。代理店とマーケターのための GTM ジェネレーター」
- **主ターゲット**: 広告代理店 LP プランナー / フリーランスマーケター / 事業会社インハウスマーケター
- **Phase 1 ローンチ**: 3 週間（D1〜D15）+ Launch Day（D17）
- **365 日目標 ARR**: ¥19.6M（中央シナリオ）/ LTV/CAC 約 80 倍
- **北極星指標**: LP-maker WAU = Brief 投入 → 公開完走したユニーク・ユーザー / 週
- **PMF 判定ライン**: 30 ユーザー有料 or W1 リテンション > 25%（autobanner.jp と同水準）

---

## 1. ブレスト確定事項（Q1〜Q9）

| Q | テーマ | 確定 |
|---|---|---|
| Q1 | プロダクト形態 | **A 統合**（autobanner.jp バックエンド共有・新ルート `/lp-maker` 追加） |
| Q2 | 入口フロー | **A Brief-first**（共通ブリーフから LP + 広告） |
| Q3 | LP 生成方式 | **A セクション組み合わせ型**（既存 11 LP コンポーネント資産活用） |
| Q4 | 公開・ホスティング | **B 段階的**（Phase 1 = サブパス公開 / Phase 2 = 独自ドメイン CNAME 対応 Pro 限定） |
| Q5 | 編集体験 | **B ライト編集 + ブロック単位 AI 再生成** |
| Q6 | 広告連携トリガー | **B 明示トリガー**（「広告も作る」ボタン） |
| Q7 | 課金 | **B LP 別カウント・全プラン開放**（Stripe Meter `lp_generation_overage` 新設） |
| Q8 | 画像調達 | **D 段階**（Phase 1 = ユーザー素材 + AI 生成 / Phase 2 = 勝ち LP 参照） |
| Q9 | ターゲット | **C LP マーケター / 代理店メイン**（autobanner.jp 既存層は副次） |
| 追加 | ブランド・ドメイン | **α lpmaker-pro.com 継承**（資産活用最大） |

---

## 2. プロダクト概要

### 2.1 ポジショニング

> **「Wix のようなテンプレ集ではない。広告運用者の勝ちパターンを構造化した LP エンジンである。」**

### 2.2 プロダクトの 3 つの本質

1. **Brief-first 一気通貫**: 商品名 / URL / ターゲット / オファーを一度入力すれば、LP も広告も同じ世界観で生成される（広告⇔LP メッセージ整合率 ≥85%）
2. **セクション組み合わせ型 LP**: autobanner.jp の既存 11 コンポーネント資産を活用、ライト編集 + ブロック単位 AI 再生成
3. **代理店オペレーションに刺さる**: 独自ドメイン CNAME（Pro）/ クライアント別管理 / クライアントレビュー導線（Phase 2-3）

### 2.3 ブランド・ドメイン構成

- **技術**: autobanner.jp と同一 Vercel プロジェクト・認証 / DB / 課金完全共有
- **フロント**: `lpmaker-pro.com` をフロント・Vercel rewrites で autobanner.jp 内部ルートに転送
- **autobanner.jp は明示クレジット**: 「広告生成エンジン」としてマーケター層への信頼担保
- **公開 LP**: Phase 1 = `lpmaker-pro.com/site/[user]/[slug]` / Phase 2 = 独自ドメイン CNAME

---

## 3. アーキテクチャ・データモデル

### 3.1 デプロイ構成

```
[lpmaker-pro.com]                    [autobanner.jp]
     │                                     │
     ├── /        : マーケサイト LP        ├── /         : 既存 autobanner.jp
     ├── /pricing : 料金                   ├── /ironclad : 既存バナー生成
     ├── /signin  : Vercel rewrite ──────► /api/auth/*
     └── /app/*   : Vercel rewrite ──────► /lp-maker/*
                                           ├── /api/lp/*        (新規 LP API)
                                           ├── /api/admin/batch-generate (既存)
                                           └── /site/[user]/[slug] : LP 公開 SSR
```

### 3.2 Prisma スキーマ追加分

```prisma
model LandingPage {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  slug            String   // URL用、user内ユニーク
  status          String   @default("draft")  // draft | published | archived
  title           String
  brief           Json     // IroncladMaterials 互換 + LP 固有フィールド
  sections        Json     // [{ type, order, enabled, props }] 配列
  publishedAt     DateTime?
  ogImageUrl      String?
  analyticsConfig Json?    // GTM/GA4/Pixel ID
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  generations     LandingPageGeneration[]
  domain          LandingPageDomain?
  linkedBanners   Generation[]  @relation("LpToBanner")

  @@unique([userId, slug])
  @@index([status, publishedAt])
}

model LandingPageGeneration {
  id              String   @id @default(cuid())
  landingPageId   String
  landingPage     LandingPage @relation(fields: [landingPageId], references: [id])
  sectionType     String   // hero, problem, solution, ...
  prompt          String   @db.Text
  output          Json     // 生成結果 (copy + meta)
  isPreview       Boolean  @default(false)  // Free プラン透かし用
  createdAt       DateTime @default(now())
}

model LandingPageDomain {
  // Phase 2 で追加。Vercel Domains API 連携。LandingPage と 1:1 FK CASCADE。
  id              String      @id @default(cuid())
  landingPageId   String      @unique
  landingPage     LandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  domain          String      @unique
  verifiedAt      DateTime?
  vercelDomainId  String?
}

// 既存 User モデルに追加
// currentMonthLpUsageCount  Int      @default(0)
// proLpOverageNoticeShownAt DateTime?
```

### 3.3 主要 API ルート

| メソッド | パス | 用途 |
|---|---|---|
| POST | `/api/lp/generate` | Brief から LP 初回生成（全セクション） |
| POST | `/api/lp/[id]/section/[type]/regenerate` | ブロック単位再生成（3 案返却） |
| PATCH | `/api/lp/[id]` | セクション ON/OFF・並べ替え・コピー編集 |
| POST | `/api/lp/[id]/publish` | 公開（slug 確定、OGP 生成、usage インクリメント、Stripe Meter 発火） |
| POST | `/api/lp/[id]/banner-handoff` | 「広告も作る」トリガー → `/ironclad?prefill=<lpId>` URL 返却 |
| GET | `/site/[user-slug]/[lp-slug]` | 公開 LP の SSR ページ（Edge Cache） |

### 3.4 AI モデル分担

| 用途 | モデル | 既存資産流用 |
|---|---|---|
| Brief 分析・LP 構成判断 | Gemini 2.5 Pro | `src/lib/winning-banner/analyze.ts` |
| セクション別コピー生成 | Gemini 2.5 Pro + `responseSchema` 構造化出力 | `/api/ironclad-suggest` パターン |
| KV / 背景画像生成 | gpt-image-2 | `src/lib/image-providers/openai.ts` |
| 勝ち LP 参照（Phase 2） | Gemini 2.5 Pro Vision 二層解析 | Phase A.8 winning-banner |

---

## 4. ユーザーフロー・主要画面

### 4.1 メインフロー

```
[1] /lp-maker (ダッシュボード)
   ▼
[2] /lp-maker/new (Brief 入力ウィザード・3ステップ)
   ├ STEP1 商材  : LP URL(自動分析) or 商材名 + ターゲット + オファー
   ├ STEP2 素材  : 商品画像/ロゴ/認証バッジ (任意・autobanner.jp Asset と共有)
   └ STEP3 構成  : AI 自動セクション選定（ユーザー選択なし・8セクション初期セット決定）
   ▼
[3] /lp-maker/[id]/generate (生成中・90秒〜3分)
   ▼
[4] /lp-maker/[id]/edit (プレビュー + 編集パネル併置)
   ├ 左ペイン : セクション一覧 (ON/OFF・D&D・「もう一案」)
   ├ 中央    : リアルタイムプレビュー
   └ 右ペイン : 選択ブロックのコピー編集 + 画像差替
   ▼
[5] /lp-maker/[id]/publish (公開設定モーダル)
   │  slug指定 / OGP編集 / GTM/GA4/Clarity/Pixel ID注入
   ▼
[6] 公開完了画面 → 「広告も作る」CTA
   ▼
[7] /ironclad?prefill=<lpId> (autobanner.jp バナー17サイズ生成)
   ▼
[8] 公開LP : lpmaker-pro.com/site/[user]/[slug]
```

### 4.2 編集画面の差別化ポイント

- 各セクション右上に「**もう一案 ↻**」ボタン
- クリック → 3 案を並列表示 → ワンクリック採用
- 採用前に Diff highlight（変更箇所をハイライト）
- 履歴は `LandingPageGeneration` テーブルに保存、巻き戻し可能

### 4.3 アナリティクス自動設定

- 公開設定モーダルで GTM ID / GA4 ID / Microsoft Clarity ID / Meta Pixel ID を入力
- 公開 LP に `<Script>` afterInteractive で自動注入（autobanner.jp `src/app/layout.tsx` パターン流用）
- デフォルト計測: `lp_view` / `lp_cta_click`（ブロック ID 付き）/ `lp_scroll_depth` / `lp_conversion`

---

## 5. 機能スコープ・Phase 分割

### 5.1 Phase 1 / MVP（3 週間）

**目的:** Brief → LP → 広告連携の一気通貫を最小実装で出す

| カテゴリ | 機能 |
|---|---|
| Brief 入力 | LP URL 自動分析 / 商材名 / ターゲット / オファー |
| 生成 | AI 自動セクション選定（8 セクション初期セット） |
| 生成 | セクション別コピー生成（Gemini 2.5 Pro + `responseSchema`） |
| 生成 | KV / セクション画像生成（gpt-image-2、2-3 枚） |
| 編集 | ブロック ON/OFF・並べ替え・コピー編集 |
| 編集 | ブロック単位「もう一案」AI 再生成 |
| 公開 | `lpmaker-pro.com/site/[user]/[slug]` SSR 公開 |
| 公開 | GTM/GA4/Clarity/Pixel ID 入力 → LP 自動注入 |
| 連携 | 「広告も作る」ボタン → autobanner.jp プリフィル遷移 |
| 課金 | Stripe Meter `lp_generation_overage` 新設 + Free/Starter/Pro 制限 |
| 法務 | 公開 LP に薬機/景表ガード（既存プロンプトポリシー継承） |
| 計測 | 北極星指標 WAU の Slack 通知（既存 KPI Cron に追加） |

### 5.2 Phase 2 / 差別化機能（Phase 1 完了 +4 週間）

- 独自ドメイン CNAME（Pro 限定・Vercel Domains API）
- プレビュー上 inline コピー編集
- 勝ち LP 参照（Phase A.8 ロジック LP 拡張）
- クライアント別フォルダ / 共有プレビュー URL
- 公開 LP の GA4 連携 → 編集画面に CVR 表示
- 業種別プリセット（コスメ / サプリ / SaaS / 教育 / 不動産）
- LP A/B 自動振り分け（autobanner.jp Phase A.16 流用）

### 5.3 Phase 3 / 拡張機能（Phase 2 完了 +6 週間〜）

- ホワイトラベル（Plan C 向け OEM 提供）
- マルチユーザー・チーム機能・権限管理
- HTML/Next.js コード ZIP エクスポート
- CRM 連携（Slack / HubSpot / Mailchimp）
- 多言語 LP 生成（Translator Pro 連携）

### 5.4 スコープ外（やらないこと）

- 完全 WYSIWYG エディタ（Phase 3 以降検討）
- 動画埋め込み生成（autobanner-video 検証中、当面分離）
- マルチ言語切替 UI（Phase 3 まで保留）
- CMS 化（Notion 風自由構造、当面避ける）

---

## 6. マーケティング・GTM・SNS 統合戦略

### 6.1 ペルソナ別 LTV / 訴求

| ペルソナ | 訴求 | LTV 推定（中央） | 主要購入プラン |
|---|---|---|---|
| A. 代理店 LP プランナー（30代/年収550万） | 「制作期間 2週間 → 90 分。クライアント修正回数 ≤ 2 回」 | ¥55,440（統合） | Pro 主力 |
| B. フリーランスマーケター（30代/年商800万） | 「外注費月10万 → ¥3,980。1人で広告セット完成」 | ¥12〜35 万 | Starter → Pro |
| C. 事業会社インハウス（D2C/SaaS） | 「制作会社待ち時間ゼロ。A/B 用 LP 5 本/週」 | ¥35.5万 | Pro |

### 6.2 訴求軸（USP）の階層

| 層 | コピー |
|---|---|
| コア | 1 ブリーフで **LP と広告 17 サイズが同時に出る、唯一の GTM キット** |
| セカンダリ① | 制作期間 2 週間 → **90 分**（広告⇔LP メッセージ整合率 ≥85%） |
| セカンダリ② | ブロック単位 AI 再生成で **A/B テスト無限** |
| 否定形 | Wix / STUDIO のような **テンプレ集ではない**。広告運用者の勝ちパターンを構造化した LP エンジンである |

### 6.3 初動 GTM チャネル優先順位（最初の 30 日）

| 優先 | チャネル | アクション | 想定 CAC |
|---|---|---|---|
| ① | autobanner.jp 既存ユーザークロスセル | 約 30 名へアプリ内通知 + メール、Pro 50% OFF 早割 | ≒ ¥0 |
| ② | X（小池 + 公式） | 「LP 生成過程」動画を週 3 投稿、note 連動 | ≒ ¥0 |
| ③ | Meta 広告 | autobanner.jp 類似 1% × LP 実物クリエイティブ、日予算 ¥5,000、90 日 CPA ¥4,000 目標 | ¥4,000 |
| ④ | SaaS 比較サイト（BOXIL / ITreview / Kyozon） | Phase 2 以降 | 中 |
| ⑤ | Product Hunt / 紹介プログラム | Phase 3 以降 | 低 |

### 6.4 ファネル & 北極星指標

```
[獲得] Free Sign Up
   ▼
[Aha Moment] Brief 入力 3分以内に「LP + 17バナー」プレビュー画面
   ▼
[北極星 = WAU] LP 公開ボタン完走者 / 週
   ▼
[Trigger] 2 本目作成時に「公開＋独自ドメイン化＋バナー連携」ペイウォール
   ▼
[Free → Starter] 5 本/月 超 or 独自ドメイン CTA
   ▼
[Starter → Pro] 月 5 本超過 or autobanner.jp 月 100 本超
```

### 6.5 SNS / コンテンツ戦略（X + note）

#### Pre-launch（ローンチ 4 週前〜）

| 週 | テーマ |
|---|---|
| W-4 | 「LP 制作の現場あるある」連投（修正 7 回・締切前夜・コピー整合性） |
| W-3 | note 連載「LP 作成プロセス分解」工数公開 |
| W-2 | 旧職経験者カード「楽天 / RIZAP / FreakOut / Creema で学んだ LP の正解と失敗」 |
| W-1 | 「来週、ここに答え出します」ティーザー + β 枠 50 名募集予告 |

#### Launch Day（D-Day）

**X 投稿構成:**
```
①出だし「LP1本に3時間。私もそうでした」
②中盤「だから作った。広告クリエとLPメッセージ整合まで自動化」
③CTA「先着50社β無料／プロフリンク」
④Before/After 動画 15 秒 添付
```

**note タイトル案:**
1. 「代理店の LP 工数を 1/10 にする発明」
2. 「広告と LP の整合率を数値で管理する時代」
3. 「楽天で 460 社見た男が作った LP ジェネレーター」

#### Post-Launch 30 日

| 軸 | 頻度 | 例 |
|---|---|---|
| ノウハウ | 週 2 | 「ファーストビュー 3 秒で離脱を防ぐ 4 要素」 |
| 事例 | 週 1 | 「代理店 X 社：LP 制作 12h → 1.5h」 |
| 比較 | 隔週 | 「STUDIO・Wix・本ツールの工数比較表」 |
| ベンチマーク | 週 1 | 「業種別 CVR 中央値レポ」 |
| Behind The Scenes | 週 1 | 「AI 生成→人間レビューの裏側 Loom 30 秒」 |

---

## 7. 課金設計

### 7.1 プラン構成

| 項目 | Free | Starter ¥3,980 | Pro ¥14,800 | Plan C |
|---|---|---|---|---|
| LP 生成本数 | 1（ハードキャップ） | 5 / 月 | 20 / 月 + メータード | 個別 |
| 超過課金 | × | ¥980/本（ハードキャップ 30） | ¥980/本（ハードキャップ 100） | 個別 |
| 公開 URL | サブパス | サブパス | + 独自ドメイン（Phase 2） | + ホワイトラベル |
| AI ブロック再生成 | × | 1 LP あたり 3 回 | 無制限 | 無制限 |
| Free 透かし | あり | × | × | × |
| autobanner.jp 連携 | × | ✓（Starter 枠から消費） | ✓（Pro 枠から消費） | ✓ |
| GTM/GA4/Pixel 注入 | × | ✓ | ✓ | ✓ |

### 7.2 Stripe 設定（追加分）

| リソース | 用途 |
|---|---|
| Meter `lp_generation_overage` | LP 超過課金（新規） |
| Price (Pro Metered LP) | ¥980/本 graduated metered（新規） |
| Pro Subscription | base ¥14,800 + バナー meter ¥80 + **LP meter ¥980** の 3-item に拡張 |
| Promotion Code `LPMAKER_EARLY` | 早割 50% OFF / 先着 50 / 期限 60 日（新規） |
| Webhook | 既存ハンドラに LP 利用回数リセット追加 |

実装: `scripts/stripe-live-setup-lp.mjs` を新設（Phase A.12 と同様）

### 7.3 課金フロー

```
[ユーザーが LP 公開ボタン押下]
   ▼
[/api/lp/[id]/publish]
   ▼
[サーバー側 usage check]
   ├── Free: usageCount >= 1 → ブロック + UpgradeModal
   ├── Starter: usageCount >= 30 → ブロック / >= 5 → 超過警告モーダル
   ├── Pro: usageCount >= 100 → ブロック / >= 20 → stripe.billing.meterEvents.create(idempotent)
   ▼
[publish 成功 → User.currentMonthLpUsageCount++ ]
```

**Free 透かし焼き込み:** 公開 LP のフッターに「Powered by LP Maker Pro」を SSR 段階で固定 HTML として強制挿入（DOM 削除不可）

### 7.4 ユニットエコノミクス（Finance Pro 精緻化版）

| プラン | 月額 | 継続月（中央） | 単独 LTV | 統合 LTV |
|---|---|---|---|---|
| Starter | ¥3,980 | 12 ヶ月 | ¥47,760 | ¥55,440 |
| Pro | ¥14,800 | 20 ヶ月 | ¥296,000 | ¥332,000 |

**粗利率（Stripe 手数料 3.6% 込み）:** **92.7%**（バナーヘビーユーザー時 88%）
**LTV/CAC:** 約 **80 倍**（CAC ¥4,000 / Pro LTV ¥332,000）

### 7.5 ARR 試算（中央シナリオ）

| 期間 | Free 累積 | Starter | Pro | MRR | ARR |
|---|---|---|---|---|---|
| 30日 | 80 | 12 | 6 | ¥136,560 | ¥1.64M |
| 90日 | 240 | 38 | 14 | ¥358,440 | ¥4.30M |
| 180日 | 500 | 85 | 28 | ¥752,700 | ¥9.03M |
| 365日 | 1,100 | 180 | 62 | ¥1.63M | **¥19.6M** |

### 7.6 最重要監視リスク（感応度順）

| リスク | 発生時影響 |
|---|---|
| **Free → Starter 転換 8% → 4%** | 365日 ARR ¥19.6M → ¥12.7M（-35%）← 最致命 |
| Meta CPA ¥4,000 → ¥8,000 | LTV/CAC 80倍 → 40倍（依然健全） |
| gpt-image-2 値上げ 2倍 | 粗利率 92.7% → 89%（軽微） |

**Finance Pro インサイト:** 「Meta CPA 上昇より LP の価値訴求弱化のほうが致命的。**Free 透かし強度とハードキャップ 1 本設定が転換ドライバー**」

---

## 8. スプリント・ロードマップ

### 8.1 全体タイムライン

```
[Pre-Sprint] ─ 1週間 ─→ [Sprint 1] W1 ─→ [Sprint 2] W2 ─→ [Sprint 3] W3 ─→ [Launch] D-Day ─→ [Phase 2] +4週 ─→ [Phase 3] +6週〜
     ↑ 準備                  データ層        編集UI            課金&連携      ローンチ          独自ドメイン    ホワイトラベル
     SNS Pre-launch開始
```

### 8.2 Pre-Sprint（ローンチ-4 週・準備）

| ID | タスク | 担当 | 所要 |
|---|---|---|---|
| P-1 | lpmaker-pro.com を Vercel 同一 project に別ドメイン追加 | tech-architect | 0.5d |
| P-2 | `vercel.json` rewrites 設定（`lpmaker-pro.com/app/* → /lp-maker/*`） | tech-architect | 0.5d |
| P-3 | Stripe live に Meter `lp_generation_overage` + Price + Promo `LPMAKER_EARLY` 作成 | tech-architect | 0.5d |
| P-4 | SNS Pre-launch 投稿 4 週連載開始 | 小池 / sns-communication | 4 週間 |
| P-5 | note 連載「LP 作成プロセス分解」第1回公開 | 小池 / writer | 1d |

### 8.3 Sprint 1 / W1（Day 1-5）— データ層・Brief 入力・コピー生成

| Day | タスク | Deliverable | 依存 |
|---|---|---|---|
| D1 | Prisma schema 追加 + migration | DB 新テーブル本番 deploy | P-1〜P-3 |
| D2 | `/lp-maker` ダッシュボード + `/lp-maker/new` Brief ウィザード | 入力画面が動く | D1 |
| D3 | `/api/lp/generate` + Gemini 2.5 Pro `responseSchema` でセクション別コピー生成 | Brief→8 セクションコピー JSON | D2 |
| D4 | AI 自動セクション選定ロジック | Brief→セクション配列が決まる | D3 |
| D5 | gpt-image-2 で KV / セクション画像生成 + Vercel Blob 保存 | 画像 URL が LP データに保存 | D3 |

**Sprint 1 完了条件:** Brief 入力 → DB 保存 → API 経由でフル LP データ（コピー + 画像 URL）が返る

### 8.4 Sprint 2 / W2（Day 6-10）— 編集 UI・もう一案・公開

| Day | タスク | Deliverable | 依存 |
|---|---|---|---|
| D6 | `/lp-maker/[id]/edit` 左右パネル + 中央プレビュー（既存 11 LP コンポーネント流用） | プレビュー描画 | D5 |
| D7 | セクション ON/OFF / D&D / コピー編集 UI + Auto-save | ライト編集完全動作 | D6 |
| D8 | `/api/lp/[id]/section/[type]/regenerate`（3 案表示モーダル + Diff highlight） | 「もう一案」ボタン動作 | D7 |
| D9 | `/api/lp/[id]/publish` + slug 確定 + OGP 自動生成 + GTM/GA4/Pixel 入力フォーム | 公開フロー完成 | D8 |
| D10 | `/site/[user]/[slug]` SSR 公開ページ + Edge Cache + Robots/Sitemap | 公開 LP 閲覧可能 | D9 |

**Sprint 2 完了条件:** Brief → 編集 → 公開 → URL でアクセスできるエンドツーエンド

### 8.5 Sprint 3 / W3（Day 11-15）— 課金・連携・ローンチ準備

| Day | タスク | Deliverable | 依存 |
|---|---|---|---|
| D11 | app 側コード実装: `stripe.billing.meterEvents.create` 呼び出し + Webhook ハンドラ追加 + Pro Subscription 3-item アタッチ（Stripe Dashboard 側のリソース作成は P-3 で完了済み前提） | Pro 超過時 Stripe メータード課金発火 | D10, P-3 |
| D12 | Free/Starter/Pro usage gate + ハードキャップ + Free 公開 LP 透かし焼き込み | プラン別制限完全動作 | D11 |
| D13 | 「広告も作る」ボタン + `/api/lp/[id]/banner-handoff` + `/ironclad?prefill=` + LP-Banner 紐付け DB | autobanner.jp 連携完成 | D12 |
| D14 | Slack 通知 5 種（新規公開・Free→Starter 転換・日次 WAU・週次サマリ・赤信号）+ 法務監査 | KPI 監視体制完成 | D13 |
| D15 | Production E2E 検証 + `LPMAKER_EARLY` 配信準備 + OGP/Twitter Card 確認 | リリース判定 GO | D14 |

**Sprint 3 完了条件:** 全プランで本番動作確認済み・課金フロー完走・autobanner.jp 連携 OK

### 8.6 Launch Day（D17）

| 時刻 | アクション | 担当 |
|---|---|---|
| 08:00 | autobanner.jp 既存ユーザーへメール / Slack 通知（早割 90日無料） | tech-architect |
| 09:00 | X ローンチ投稿 + 動画 15 秒 | 小池 |
| 09:30 | note ローンチ記事公開 | 小池 / writer |
| 10:00 | Meta 広告配信開始（autobanner.jp 類似 1%・日予算 ¥5,000） | marketing |
| 終日 | Slack `#lp-maker-launch` で sign-up / 公開 / 課金イベント監視 | 全員 |

### 8.7 Phase 2 ロードマップ（D+30 〜 D+60）

| ID | タスク | 所要 |
|---|---|---|
| P2-1 | Vercel Domains API 連携 + 独自ドメイン CNAME UI | 5d |
| P2-2 | プレビュー上 inline コピー編集 | 3d |
| P2-3 | 勝ち LP 参照（Phase A.8 ロジック LP 拡張） | 5d |
| P2-4 | クライアント別フォルダ / 共有プレビュー URL | 4d |
| P2-5 | 公開 LP の GA4 連携 → 編集画面に CVR 表示 | 4d |
| P2-6 | 業種別プリセット（5 業種） | 3d |
| P2-7 | LP A/B 自動振り分け | 3d |

合計 27d ≒ 6 週間（並列実行で 4 週圧縮可能）

### 8.8 Phase 3 ロードマップ（D+60 〜）

| ID | タスク |
|---|---|
| P3-1 | ホワイトラベル（OEM 提供 / Plan C 向け） |
| P3-2 | チーム機能 / 権限管理 |
| P3-3 | HTML/Next.js コード ZIP エクスポート |
| P3-4 | CRM 連携（Slack / HubSpot / Mailchimp） |
| P3-5 | 多言語 LP 生成（Translator Pro 連携） |

### 8.9 リスクと緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| Gemini `responseSchema` 不安定 | 1-2 日遅延 | リトライ + 構造バリデーション層を D3 で同時実装 |
| gpt-image-2 タイムアウト（Vercel maxDuration 300s） | 公開フロー遅延 | LP 公開は画像生成と非同期化（job + ポーリング） |
| Stripe live Meter 設定ミス | 課金事故 | Phase A.12 チェックリスト準拠（既存 listing 全数確認） |
| Free → Starter 転換 8% 未満 | ARR -35% | D+14 で Slack 警告 / D+21 でハードキャップ強化検討 |
| ローンチ初日の autobanner.jp クロスセル過剰受注 | 既存サービス影響 | autobanner.jp と LP-maker の Vercel 関数枠を function 単位で isolate |

---

## 9. 法務・コンプライアンス・リスク

### 9.1 公開 LP の景表法 / 薬機法ガード（autobanner.jp プロンプトポリシー継承）

- AI 生成コピーの NG ワードフィルタ（既存 `src/lib/prompts/ironclad-banner.ts` を LP 用に拡張）
- 数字訴求には「※個人の感想」「※当社調べ」等の根拠注記を必須挿入
- 薬機法カテゴリ（化粧品 / サプリ / 健康食品）は「治癒・改善・効果」表現を Gemini プロンプトで明示禁止
- Free プラン透かしに「Generated by AI / 内容の正確性はユーザーが保証」注記を強制挿入

### 9.2 ユーザー責任の明文化

- LP 公開時に「掲載内容の最終責任はユーザーにある」確認チェックボックス
- 既存 autobanner.jp `/legal/terms` 第8条を準用、必要なら LP-maker 専用利用規約を追加
- プライバシーポリシー: autobanner.jp `/legal/privacy` 継承（越境移転条項含む）

### 9.3 知的財産・著作権

- AI 生成画像の商用利用権はユーザーに帰属（OpenAI / Google 規約準拠）
- ユーザーアップロード素材は autobanner.jp Asset テーブルと共有
- Free 透かしの削除を禁止する利用規約条項を追加

### 9.4 Vibe Coding 六条チェック

| 観点 | 対応 |
|---|---|
| ① セキュリティ | NextAuth SSO 継承 / 内部 API のみ / SSR XSS サニタイズ |
| ② コスト | gpt-image-2 上限 = Pro ハードキャップ 100 / OpenAI Usage Limit $200/月 |
| ③ 法務 | 9.1〜9.3 対応 / `legal` agent 監査を Sprint 3 D14 に組込 |
| ④ データ不可逆 | Prisma migration 経由 / Neon prod branch 分離 / 物理削除は user delete のみ |
| ⑤ 性能 | LP 1本生成 30-90秒 / 公開 LP は Edge Cache で <100ms |
| ⑥ 検証 | Gemini `responseSchema` / 全 API route に zod バリデーション |

### 9.5 競合リスク

| リスク | 対応 |
|---|---|
| Vercel v0 / Lovable が日本語マーケター層に参入 | 「広告×LP 同時生成」「日本商習慣特化」で差別化維持 |
| STUDIO AI が LP+広告統合機能を追加 | autobanner.jp 17 サイズ実績資産が先行優位 / Phase 2「勝ち LP 参照」で引き離し |
| 大手代理店が自社内製 | Plan C ホワイトラベルで逆に取り込む |

---

## 10. KPI・計測・運用

### 10.1 KPI ツリー

```
[北極星指標] LP-maker WAU = 公開完走ユニーク・ユーザー / 週
       │
       ├─ Activation: Brief 入力 → 完走率 ≥ 60%（GA4 `lp_published`）
       ├─ Retention: W1 ≥ 25%, W4 ≥ 10%
       ├─ Revenue: MRR / ARR / 平均 ARPU
       ├─ Conversion: Free→Starter ≥ 8% ★最重要 / Starter→Pro ≥ 20%
       └─ Cross-sell: LP→Banner handoff 使用率 ≥ 40%（Pro 統合 LTV ドライバー）
```

### 10.2 Slack 通知拡張

| 通知 | 頻度 | 発火条件 |
|---|---|---|
| 新規 LP 公開通知 | リアルタイム | `lp.publishedAt` セット時 |
| Free → Starter 転換通知 | リアルタイム | Plan upgrade webhook |
| 日次 LP-maker WAU | 毎朝 8:00 JST | Vercel Cron `/api/cron/lp-kpi-daily` |
| 週次 LP-maker サマリ | 月曜 9:00 JST | Vercel Cron `/api/cron/lp-kpi-weekly` |
| 赤信号通知（Free→Starter 4% 以下 / W1 リテンション 15% 以下） | 週次 | KPI Cron 内ガード |

### 10.3 計測実装

- **GA4 イベント（公開 LP に自動注入）:** `lp_view` / `lp_cta_click`（ブロック ID 付き）/ `lp_scroll_depth` / `lp_conversion`
- **編集画面イベント（lpmaker-pro.com）:** `brief_submitted` / `section_regenerated` / `lp_published` / `banner_handoff_triggered`
- **Microsoft Clarity:** 公開 LP / 編集画面の両方
- **Stripe Meter 連動:** `lp_generation_overage` イベント数を Slack 週次通知に反映

### 10.4 運用ルーティン

| 頻度 | 内容 | 担当 |
|---|---|---|
| 毎日 | Slack 通知確認（WAU / 新規公開 / 転換率） | 小池 |
| 毎週月曜 | 週次サマリ + GA4 / Clarity 行動データレビュー | 小池 |
| 毎週金曜 | 改善仮説 1 件決定 → 翌週着手 | 小池 + tech-architect |
| 毎月 | Stripe 売上レポート + Finance Pro レビュー | 小池 + finance |
| Phase 1 完了 D+30 | PMF 判定 → Phase 2 GO / NO-GO | 全員 |

### 10.5 Phase 1 Definition of Done

- [ ] Brief → LP → 公開 のエンドツーエンドが本番で動く
- [ ] Free / Starter / Pro 全プランで課金フロー検証済
- [ ] autobanner.jp 連携（広告も作る）が動く
- [ ] Slack 通知 5 種類が稼働
- [ ] 法務監査済 + Free 透かし焼き込み済
- [ ] 早割 `LPMAKER_EARLY` 配信中
- [ ] SNS Pre-launch 連載完走 + Launch Day 投稿配信済

---

## 11. ブレストインプット出典

本設計書は以下のエージェント並列実行結果を統合したもの。

| エージェント | 主要寄与 |
|---|---|
| `researcher` | 競合 5-8 サービスマッピング / プライス帯（Pro ¥14,800 本命）/ 空きポジション（広告×LP 同時生成・代理店マルチクライアント管理・CVR 改善ループ内蔵）|
| `marketing` | ペルソナ 3 軸（代理店 / フリーランス / インハウス）/ USP 階層（コア・セカンダリ・否定形）/ 初動 GTM Top 3 / Aha Moment 定義 |
| `sns-communication` | Pre-launch 4 週連載 / Launch Day 投稿構成 / Post-Launch 5 軸継続発信 / 切り口 KPI |
| `finance` | LTV 3 シナリオ / 90/180/365 日 ARR 試算 / 粗利率 92.7%（Stripe 込み）/ リスク感応度 |

---

## 12. 次のアクション

1. 本設計書のユーザーレビュー（小池）
2. レビュー反映 → 設計書確定 + git commit
3. `superpowers:writing-plans` スキル起動 → 詳細実装プラン作成（Sprint 1〜3 のタスク粒度を D1〜D15 で詳細化）
4. Pre-Sprint タスク（P-1〜P-5）着手

---

**設計書改訂履歴:**
- 2026-05-16 v1.0 初稿（Q1〜Q9 + ブランド選択 + 4 エージェント統合）
