# Phase A.14: メータード課金 + Free 段階制限（4セッション目以降グレーアウト）設計書

**作成日:** 2026-04-28
**ステータス:** ブレインストーミング完了 / 実装プラン作成済 / 着手は A.12 live mode 完了後
**前提:** Phase A.12 test mode 完了（merge `8b0e75e` / tag `phase-a12-test-complete`）
**配置場所:** `docs/superpowers/specs/2026-04-28-phase-a14-metered-billing-design.md`

---

## 1. 背景・目的

事業計画書 v2 で予告した Phase A.14（4セッション目以降グレーアウト + Pro 超過メータード課金）を実装する。本フェーズの戦略的価値：

1. **Pro 転換ドライバの完成**: 「Free で 3 セッションまで魅力体験 → 4 回目グレーアウトでアップグレード意欲を最大化」する loss aversion パターン
2. **ARR 上振れ余地**: Pro 月 100 回上限超過分を ¥80/回で課金（プロ平均 20% が月 100 回超想定 = +¥3,000/人/月）
3. **A.12 で構築した base + metered subscription 構造の完成**: usage_records を送信するだけで実装完了する設計（A.12 で先回りしたため）

### 1.1 Phase 関連性

```
A.12（test mode 完了）: base + metered の 2-item subscription を Stripe に作成
   ↓
A.12 live mode（KYC 待ち）: 本番 Stripe Customer / Subscription が動く
   ↓
A.14（本フェーズ）: 4セッション目以降グレーアウト + 月 101 回目以降 usage_records 送信
   ↓
A.15: 公開 LP で集客開始
```

---

## 2. スコープ定義

### 2.1 含むもの（A.14）
- **Free プラン段階制限**: 月 4 回目以降の生成は「透かし入りプレビュー」モードに切り替え（生成自体は走る、出力に「PREVIEW」透かし重ね）
- **Pro メータード送信**: 月 101 回目以降の生成完了時に Stripe `meterEvents.create` で 1 件送信（idempotency=Generation.id）
- **ironclad-generate API の分岐**: usage 状態 + plan に応じて挙動変更（透かし or 通常 or メータード送信）
- **画像処理**: sharp で半透明 PREVIEW 透かしを後処理合成（gpt-image-2 出力後）
- **UI 表示**:
  - Free 4 回目以降の Step 3 で「これはプレビュー版です。Pro にすれば透かしなしで使えます」バナー
  - /account の Plan セクションに「今月超過分: N 回 × ¥80 = ¥X」表示（Pro のみ）

### 2.2 含まないもの（明示的に切る）
- A.12 と独立: Stripe Subscription 構造は変更なし（base + metered のまま）
- 透かしのカスタマイズ（テキスト変更等）→ 必要なら B フェーズ
- Free セッション数を 3 → 5 等に動的変更する管理画面 → 当面 env 値（USAGE_LIMIT_FREE=3）固定

### 2.3 完了基準
1. Free プランで 4 セッション目以降を生成 → 「PREVIEW」透かし入りで出力される
2. Pro プランで 101 回目を生成 → Stripe meterEvents に 1 件記録される（Stripe Dashboard で確認）
3. 同 Generation.id で 2 回 webhook が再送されても usage_records は 1 件のみ（idempotency）
4. /account に「今月超過分」表示が出る（Pro 超過時）
5. Stripe billing cycle 末でメータード課金が Invoice に上乗せされる（Test Clock で検証）

---

## 3. 主要設計判断（autonomous 決定）

| Q | 論点 | 決定 |
|---|---|---|
| Q1 | Free 上限到達時の UX | **B: 透かし入りプレビュー**（loss aversion 最大化）。完全 block よりアップグレード訴求力が強い |
| Q2 | 透かしの実装方式 | **A: サーバー側 sharp で半透明テキスト合成**（gpt-image-2 出力後に後処理）。確実 + 削除困難 + 元品質維持 |
| Q3 | 透かしテキスト | `PREVIEW` 大文字斜め重ね + `Pro なら透かしなし` 下部小文字（白半透明 30%、ドロップシャドウあり） |
| Q4 | Pro メータード送信タイミング | **生成完了時に都度送信**（ironclad-generate API 成功パス末尾）。バッチ送信より即時性高い |
| Q5 | usage_records idempotency | **Generation.id を idempotency_key**（Stripe 標準機能）。webhook 再送や handler retry でも 1 件のみ確実 |
| Q6 | Free 上限 (3 回) は変更可能か | **`USAGE_LIMIT_FREE` env で固定**。動的変更 UI は当面不要 |
| Q7 | 4 回目以降のサイズ制限 | **Free は元々 1 サイズ固定**（既存仕様）。グレーアウトでも 1 サイズで返す |
| Q8 | グレーアウト Generation の保存 | **保存する**（履歴に残す）。`Generation.isPreview = true` フラグを追加 |
| Q9 | Pro 上限到達通知 | **101 回目で「これより ¥80/回 で課金されます」アラート 1 度だけ**（localStorage flag で 1 月 1 回） |

---

## 4. アーキテクチャ

### 4.1 主要データフロー

#### ① Free プランの 4 回目以降の生成
```
1. User: Step 3 で「生成」ボタンクリック
2. POST /api/ironclad-generate 成功パス末尾で:
   - 既存: incrementUsage()
   - A.14 追加: if (plan === 'free' && usageCount >= USAGE_LIMIT_FREE) → isPreview=true
3. gpt-image-2 で画像生成
4. A.14 追加: isPreview=true なら sharp で透かし合成
5. Vercel Blob にアップロード
6. Generation 作成（isPreview フラグ付き）
7. クライアントに返却（透かし付き画像）
8. Step 3 UI: isPreview=true なら「これはプレビュー版です」バナー表示
```

#### ② Pro プランの 101 回目以降の生成
```
1. User: 生成ボタンクリック（admin/Pro なので無制限 UI）
2. POST /api/ironclad-generate
3. 既存 incrementUsage() 後の usageCount を確認
4. A.14 追加: if (plan === 'pro' && usageCount > USAGE_LIMIT_PRO) →
   stripe.billing.meterEvents.create({
     event_name: 'banner_generation_overage',
     payload: { stripe_customer_id: user.stripeCustomerId, value: '1' },
     identifier: generation.id, // idempotency
   })
5. 生成完了（透かしなし、通常）
6. Stripe 月末請求で base ¥14,800 + (超過数 × ¥80) を自動 invoice
```

### 4.2 月次サイクル整合

A.12 で導入した「subscription 持ちは Stripe 起点 lazy reset」が前提:
- payment_succeeded webhook で usageCount=0, usageResetAt=current_period_end が設定される
- A.14 の Pro 上限判定 `usageCount > USAGE_LIMIT_PRO` は Stripe billing 月単位で正しく動く
- Stripe 側の meter usage も同じ billing cycle で集計され、Invoice に反映される

---

## 5. DB スキーマ変更

```prisma
model Generation {
  // ... 既存フィールド ...

  /// Phase A.14: Free 上限超過時の「透かし入りプレビュー」フラグ
  /// true なら画像が PREVIEW 透かし入り、UI でアップグレード訴求バナー表示
  isPreview  Boolean  @default(false)
}

model User {
  // ... 既存フィールド ...

  /// Phase A.14: Pro 上限到達通知を「今月既に出したか」のフラグ
  /// true なら 101 回目以降のアラートを suppress、payment_succeeded webhook 時にリセット
  proOverageNoticeShownAt  DateTime?
}
```

### 5.1 マイグレーション

```sql
ALTER TABLE "Generation" ADD COLUMN "isPreview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "proOverageNoticeShownAt" TIMESTAMP(3);
```

既存ユーザー / Generation への影響: なし（NULL 許容 / boolean default false）。

---

## 6. ファイル/モジュール構成

### 6.1 新規作成

| ファイル | 役割 |
|---|---|
| `prisma/migrations/<ts>_phase_a14_metered/migration.sql` | isPreview + proOverageNoticeShownAt |
| `src/lib/billing/usage-records.ts` | `sendMeteredUsage(customerId, generationId)` ラッパー |
| `src/lib/image-providers/watermark.ts` | sharp で PREVIEW 透かしを画像に合成するヘルパー |
| `src/lib/plans/limits.ts` 拡張 | `USAGE_LIMIT_FREE=3` / `USAGE_LIMIT_PRO=100` 定数化（既存にあれば追記） |
| `src/components/ironclad/PreviewBanner.tsx` | 「これはプレビュー版です」訴求バナー |
| `src/components/account/ProOverageDisplay.tsx` | /account の Plan セクション内「今月超過分」表示 |

### 6.2 変更

| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | Generation.isPreview + User.proOverageNoticeShownAt |
| `src/app/api/ironclad-generate/route.ts` | usage 判定ロジック追加 + 透かし合成呼出 + meterEvents 送信 |
| `src/components/ironclad/IroncladGenerateScreen.tsx` | isPreview 状態の UI 表示 |
| `src/app/account/PlanSection.tsx` | ProOverageDisplay 統合 |
| `src/lib/generations/blob-client.ts` | （変更不要、既存の put をそのまま使う） |

### 6.3 環境変数追加

```
USAGE_LIMIT_FREE=3
USAGE_LIMIT_PRO=100
```

これらは A.12 の既存 plan limit 定義と統合（`src/lib/plans/limits.ts`）。

---

## 7. エラーハンドリング設計

### 7.1 ironclad-generate の追加分岐

```
[POST /api/ironclad-generate] 既存処理...
  ↓
[gpt-image-2 で生成成功後]
  ↓
1. user, plan, usageCount を取得
2. if (plan === 'free' && usageCount >= USAGE_LIMIT_FREE) →
   - 透かし合成
   - isPreview = true
   - Generation 作成時に isPreview=true セット
3. if (plan === 'pro' && usageCount > USAGE_LIMIT_PRO) →
   - meterEvents.create を try/catch（失敗してもユーザー側は成功扱い、ログのみ）
   - meterEvents 失敗は admin 通知 → 翌日リトライ運用（手動）
4. Generation 作成 + 返却
```

### 7.2 meterEvents 送信失敗時の扱い

- Stripe API 障害でメータード送信失敗 → ログに残し、ユーザーには成功を返す（ユーザー体験優先）
- Stripe Dashboard の Events 監視で漏れを検知
- 翌月の Invoice 確定前 (current_period_end - 24h) に Cron で漏れを再送信（A.14 v2 で実装、初版は手動）

### 7.3 透かし合成失敗時

- sharp の処理失敗（OOM 等）→ try/catch で透かしなしの元画像を返却（成功優先）
- ログに `[watermark] failed` を残す

---

## 8. 透かしデザイン

```
┌──────────────────────┐
│         ╱╱╱╱╱        │
│      ╱╱P R E╱V I E╲W ╲
│     ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╲│
│    ┌───────────────────┐│
│    │   実バナー画像    ││
│    └───────────────────┘│
│                          │
│      Pro なら透かしなし  │
└──────────────────────────┘
```

- 中央に大文字「PREVIEW」斜め配置（45°）、白半透明 30%
- 下部に小文字「Pro なら透かしなし」白半透明 50%
- ドロップシャドウ（黒、blur 4px）で背景色を選ばず読める
- フォントサイズは画像幅の 8%（1080px なら 86px）

実装: `sharp.composite` で SVG 文字列を重ねる（軽量 + 透明度・回転対応）。

---

## 9. 実装順序（チェックポイント分割）

### CP1: DB + ライブラリ基盤（0.5 日）
- Prisma migration（isPreview + proOverageNoticeShownAt）
- `src/lib/billing/usage-records.ts`（meterEvents ラッパー）
- `src/lib/image-providers/watermark.ts`（sharp 透かし合成）
- limits.ts に USAGE_LIMIT_FREE/PRO 定数

### CP2: ironclad-generate API 統合（1 日）
- 既存 route.ts に usage 判定 + 透かし合成 + meterEvents 送信を追加
- isPreview を Generation 作成時にセット
- TypeScript ビルド + ローカルで Free 4 回目を試行 → 透かし入り画像確認

### CP3: UI 統合（0.5 日）
- PreviewBanner.tsx を Step 3 に統合
- ProOverageDisplay を /account に統合
- localStorage flag で「101 回目アラート 1 月 1 回」UX

### CP4: Stripe Test Clock で月末検証（0.5 日）
- Test Clock で 1 ヶ月進める → meterEvents が Invoice に集計されることを確認
- payment_succeeded webhook 後に proOverageNoticeShownAt がリセットされる確認

### CP5: live mode 移行検証（0.5 日）
- 自分の Pro Subscription（A.12 live mode で作成済の前提）で 1 回だけ「擬似超過」（USAGE_LIMIT_PRO を一時的に 1 に下げて動作確認）→ 実 Stripe Invoice にメータード課金が乗るか確認 → 即解約 / metered usage を Stripe 側で取り消し

**累計工数: 3 営業日**

---

## 10. リスクと緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| sharp 透かし合成の OOM | ユーザー体験悪化 | try/catch で fallback、ログ監視 |
| meterEvents 送信失敗で課金漏れ | 売上損失 | ログ + Stripe Dashboard 監視 + 月末 Cron リトライ（v2） |
| 既存ユーザーの一時混乱 | サポート問合せ | リリース時にメール通知（A.15 LP 公開タイミングと合わせる） |
| Stripe meter event の deduplication 失敗 | 二重課金 | identifier=Generation.id で Stripe 側冪等性に任せる、テスト必須 |
| Free ユーザーが透かし回避を試みる | サポート工数 | 透かしを画像に焼き込み（後付け除去困難）、HTML/CSS 透過は使わない |

### 10.1 ロールバック手順

- **L1（即座）**: env `USAGE_LIMIT_FREE=999999` / `USAGE_LIMIT_PRO=999999` → 全員無制限化、機能を実質停止
- **L2（数分）**: feature ブランチ revert merge
- **L3**: tag `phase-a12-complete`（live mode 完了タグ）に巻き戻し

---

## 11. 次フェーズへの接続

- **A.15（公開 LP）**: 料金体系の透明性が重要。LP の料金表に「Pro 100 回まで月額固定 / 101 回目以降は ¥80/回」と明記
- **B.1（薬機法 AI スコア）**: 別事業価値の追加、A.14 完了後に着手可能
- **B.3（リテンション）**: 月末「Pro 超過 N 回でした」のレポートメール → ユーザー満足度向上

---

## 12. 参考リンク

- 事業計画 spec v2: `docs/superpowers/specs/2026-04-26-business-plan.md`
- 前 Phase: `docs/superpowers/specs/2026-04-28-phase-a12-billing-design.md`
- Stripe Billing Meters: https://stripe.com/docs/billing/subscriptions/usage-based
- Stripe Idempotency: https://stripe.com/docs/api/idempotent_requests
