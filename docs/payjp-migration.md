# Stripe → Pay.jp 決済移管 実行計画

最終更新: 2026-06-04 / オーナー: 小池

## 前提
- Stripe アカウント**凍結**のため利用不可。
- **有料サブスク契約者ゼロ** → カードデータ移行・顧客再登録・解約リスクなし。新規からPay.jpで開始。
- 収益モデルは維持（超過分は「自前集計＋Pay.jp都度課金」で再現）。

## 検証済み事実（六条: 検証性）
- `payjp` npm v3.1.2（2026-04-28更新・現役）= Node SDK。
- フロント tokenization = `payjp.js v2`（CDN `https://js.pay.jp/v2/pay.js`）。
- ⚠️ Pay.jp サブスク = **固定額のみ**。メータード/graduated 課金なし → 超過は自前。
- ⚠️ Pay.jp に **ホスト型 Customer Portal なし** → カード変更/解約UI自作。
- ⚠️ Pay.jp に **Subscription Schedule（プラン変更予約）なし** → 期末解約/変更は自前。
- Pay.jp サブスク v2 API は2026提供予定 → **現状 v1 前提**で実装。

## アーキ方針
- `PAYMENT_PROVIDER`(`stripe`|`payjp`) フラグで切替可能に（既存 `STRIPE_ENABLED` 踏襲、安全なカットオーバー/ロールバック）。
- DB スキーマは「Stripe」依存の命名を汎用化（後方互換で段階移行）。
  - `stripeCustomerId` → 汎用 `payjpCustomerId` を**追加**（既存カラム削除しない＝不可逆回避）。
  - `stripeSubscriptionId` → `payjpSubscriptionId` 追加。
- 秘密鍵は Vercel env のみ。Webhook は署名検証必須。カード番号はサーバーに通さない。

## ⚠️ 審査対応メモ（2026-06-04）
- Pay.jp審査で料金表提出を要求された → `Downloads/payjp-pricing/autobanner-pricing.png` を申請画面にアップロード済み想定。
- 申告: 商材単価 最低¥4,980〜最高¥39,800。これに合わせ **Starter を ¥3,980→¥4,980 に値上げ**（コード9ファイル更新済み・型チェック0エラー）。
- 🔴 **未デプロイ**（オーナー選択=A）。価格更新は payjp 移管コードと同梱でローカル保持中。
  - デプロイは必ず「①prod DBマイグレーション（payjp*・OverageCharge追加）→ ②デプロイ」の順。
    `incrementUsage`/`incrementLpUsage` が新カラム payjpSubscriptionId を参照するため、順序を誤るとバナー生成が500で停止する。
  - 切替時に価格デプロイも同時に行う（本番サイトの¥4,980反映）。

## マニュアル作業（小池側・コードと並行）
1. **Pay.jp 申込・本番審査**（クリティカルパス。停止理由の整理を準備）。
2. Pay.jp ダッシュボードで **Plan 作成**（starter / pro base / business base の固定額月額）。
3. 本番/テストの API キー・Plan ID を Vercel env へ登録（下記 env 契約）。
4. 特商法ページの決済代行事業者表記を Pay.jp(GMO-PG系) に更新。

## env 契約
```
PAYMENT_PROVIDER=payjp            # サーバー側切替フラグ
NEXT_PUBLIC_PAYMENT_PROVIDER=payjp # クライアント側切替フラグ（上と必ず同値）
PAYJP_SECRET_KEY=sk_live_...      # サーバーのみ
NEXT_PUBLIC_PAYJP_PUBLIC_KEY=pk_live_...  # フロント tokenization
PAYJP_WEBHOOK_SECRET=...          # Webhook 署名検証
PAYJP_PLAN_STARTER=pln_...
PAYJP_PLAN_PRO=pln_...
PAYJP_PLAN_BUSINESS=pln_...
```

## 実装フェーズ
- **P1 基盤** ✅: `payjp-client.ts`（SDK+`PAYMENT_PROVIDER`フラグ）/ `payjp-plans.ts`（Plan ID 許可リスト）/ `payjp` v3.1.2 導入。型チェック通過。
- **P2 決済導線** ✅: payjp.js カード入力 → token → `customer` 作成 → `subscription` 作成。
  - `src/lib/billing/payjp-checkout.ts`（createPayjpSubscription）
  - `src/app/api/billing/payjp/subscribe/route.ts`（認証+plan許可リスト検証）
  - `src/components/billing/PayjpCheckoutForm.tsx`（payjp.js v2 カードフォーム）
  - DB: User に `payjpCustomerId` / `payjpSubscriptionId` 追加（stripe* 併存・可逆）。`prisma validate` 通過。
  - ⚠️ **未対応（本番前必須）**:
    1. **DBマイグレーション未適用** — `prisma migrate dev --name add_payjp_columns`（dev）→ `scripts/migrate-prod.mjs`（prod）。カットオーバー直前に実施。
    2. **3Dセキュア(3DS)** — 日本は2025〜カード登録時の本人認証義務化。`PayjpCheckoutForm` の TODO(3DS) を公式docで確認し `createToken three_d_secure:true` + 本人認証ダイアログを実装。未対応だと本番でカード登録が弾かれる可能性。
    3. CheckoutButton/プランカードを provider フラグで PayjpCheckoutForm に差し替え（P7 切替時）。
- **P3 Webhook** ✅: Pay.jp Webhook 受信 → 検証 → `plan-sync` 相当の DB 同期。
  - `src/app/api/billing/payjp/webhook/route.ts`（受信エンドポイント）
  - `src/lib/billing/payjp-webhook-verify.ts`（**多層防御**: `X-Payjp-Webhook-Token` 定時間比較 + `events.retrieve` で本物を再取得し body を信用しない）
  - `src/lib/billing/payjp-webhook-handlers.ts`（dispatcher: subscription.created/updated/renewed/canceled/deleted/paused/resumed + charge.failed/succeeded）
  - `src/lib/billing/payjp-plan-sync.ts`（status: active/trial/canceled/paused 同期、renewed で月次 usage リセット）
  - `src/lib/billing/payjp-types.ts`（SDK 戻り値から Event/Subscription/Charge 型を導出）
  - idempotency は既存 `WebhookEvent` を `recordEventReceivedGeneric` で流用。型チェック 0 エラー。
  - ⚠️ Pay.jp には HMAC 署名が無い（静的トークンのみ）→ 上記再取得で補完。**Pay.jp ダッシュボードで Webhook URL `https://autobanner.jp/api/billing/payjp/webhook` を登録**し、token を `PAYJP_WEBHOOK_SECRET` に設定すること。
- **P4 自前ポータル** ✅: カード変更・解約UI。
  - `usePayjpCard.ts`（共有フック）/ `PayjpCardUpdateForm.tsx` / `api/billing/payjp/card`（customers.update）/ `api/billing/payjp/cancel`（subscriptions.cancel=期末解約）
- **P5 超過従量課金** ✅:「自前集計+都度課金で維持」の本体。
  - `src/lib/billing/payjp-overage.ts`（billPayjpOverage：usageCount/LP超過を算出→charges.create）
  - **冪等設計**: `OverageCharge` テーブル `@@unique([userId, periodEnd])`。succeeded/pending=スキップ、failed=再試行、API失敗時failed記録。
  - renewed webhook で「前周期の超過をリセット前に請求」。`incrementUsage`/`incrementLpUsage` を Pay.jp サブスク対応（lazy reset無効化で周期内累積）。
  - 解約済み（renewed来ない）は `api/cron/payjp-overage-sweep`（日次1:00・vercel.json登録済）で最終周期請求→free化。
  - 単価: banner pro¥80/business¥40、LP pro¥980/本。⚠️ DBマイグレーション要適用（OverageChargeテーブル追加）。
- **P6 プラン変更/期末解約**: `subscriptions.update`の`next_cycle_plan`（ネイティブ期末切替）でダウングレード/アップグレード予約。
- **P7 切替・撤去**（先行分 ✅ / 本番切替は審査・キー待ち）:
  - ✅ UI を provider フラグ対応: `payment-provider.client.ts`（NEXT_PUBLIC_PAYMENT_PROVIDER 判定）/ `PayjpPlanButton.tsx`（未契約=カード入力モーダル, 既契約=即時アップグレード※二重課金防止）/ `CheckoutButton`・`PortalButton`（Pay.jp=カード変更モーダル）・`DowngradeButton`・`UnsubscribeButton` を分岐対応 / プランカード3種に plan・currentPlan 注入＋env ガードを provider 対応。
  - ✅ 特商法ページ更新: 決済代行を PAY.JP に、Customer Portal 表記をマイページに変更。
  - ⏳ 残（審査・本番キー後）: DBマイグレーション適用 → Vercel env 登録（鍵/Plan ID/Webhook secret/NEXT_PUBLIC_PAYMENT_PROVIDER）→ Pay.jp ダッシュボードで Webhook URL 登録 → `PAYMENT_PROVIDER=payjp` 投入・実カードで疎通確認 → 問題なければ Stripe コード/env 撤去。

## 影響ファイル（Stripe依存・要改修）
- 基盤: `src/lib/billing/{stripe-client,prices,plan-sync,idempotency,usage-records}.ts`
- API: `src/app/api/billing/{checkout-session,webhook,portal-session,cancel,downgrade}/route.ts`
- Webhook handlers: `src/lib/billing/webhook-handlers/*`
- UI: `src/components/billing/*`（CheckoutButton/PortalButton/プランカード等）, `src/app/account/*`
- 法務: `src/app/legal/tokutei/page.tsx`
