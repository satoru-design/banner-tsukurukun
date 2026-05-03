# Phase A.17.0 Business Tier 手動テスト

## 前提
- Stripe test mode key 設定済（`.env`）
- `.env` の `DATABASE_URL` は dev branch の認証情報（2026-05-04 現在ローテート済 → 復旧後検証可）
- ローカル dev server: `npm run dev`
- Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhook`

## 本番（live mode）デプロイ後の Smoke Test

### S1: LP の 4 列表示
1. https://autobanner.jp/lp01 を開く
2. Desktop: Free / Starter / Pro / Business の 4 列で表示
3. Business カードに **NEW** バッジ（amber）と「広告代理店・中堅 EC 運用部隊向け」コピー
4. Mobile (375px width): 縦積みで 4 カード
5. 「年契約・SLA・専任サポートをご希望の方は▶」が下部表示

### S2: /account の Business カード（admin として）
1. satoru@inkyouup.co.jp で /account を開く
2. 「プラン」セクション最下部に「🚀 Business プラン」カードが表示
3. CTA は「Business を試す（admin プレビュー）」
4. ¥39,800 / 1,000 枠 / ¥40 メータード / 上限 3,000 が記載
5. 下部に「より大規模・年契約・SLA をご希望なら Plan C のお問い合わせへ」リンク

## ケース 1: Free → Business 直接 Checkout（test mode 必要）
1. test mode の Free アカウントでログイン
2. /account の Business カードで「Business で始める」クリック
3. Stripe Checkout で `4242 4242 4242 4242` で決済
4. /account?stripe=success に戻る
5. Plan badge が "business" になる
6. usageLimit が 1,000 になる

## ケース 2: Pro → Business アップグレード（即時 prorate）
1. 既に Pro plan のアカウントでログイン
2. /account の Business カードで「Business にアップグレード」クリック
3. Stripe Checkout で支払（既存カード使用）
4. /account に戻り Plan badge が "business"
5. Stripe Dashboard で prorate Invoice が発行されている

## ケース 3: Business → Pro ダウングレード（期末切替）
1. Business plan のアカウント
2. /account の Business カードで「Pro にダウングレード」クリック
3. confirm dialog で OK
4. planExpiresAt が表示される（次回更新日まで Business）
5. Stripe Test Clock で 1 ヶ月進める → plan が pro に切り替わる

## ケース 4: Business メータード送信
1. Business plan のアカウント
2. `.env` で USAGE_LIMIT_BUSINESS を一時的に 5 に変更
3. dev server 再起動
4. 6 枚目の生成を実行
5. Stripe Dashboard の Meter Events で `banner_generation_overage` が記録される
6. `.env` を元に戻す

## ケース 5: Y inline banner
1. Pro plan のアカウントで usageCount を 95 に DB 直接更新
2. /ironclad で 6 pattern × 1 size = 6 枚 を生成
3. 6 枚目（usageCount = 101）の時点で UpgradeToBusinessBanner が STEP3 上部に表示
4. 「今月は表示しない」クリック → 非表示
5. ページリロード後も非表示（localStorage 効いている）

## ケース 6: X 月次バナー
1. UpgradeNotice テーブルに直接 insert（test 用）:
   ```sql
   INSERT INTO "UpgradeNotice" (id, "userId", type, "recommendedPlan", "metricSnapshot", "createdAt")
   VALUES (
     'test_' || extract(epoch from now())::text,
     '<your_user_id>',
     'business_upgrade_recommendation',
     'business',
     '{"avgOveragePerMonth": 24000, "invoiceCount": 3, "totalMeteredJpy": 72000, "threshold": 10000}'::jsonb,
     NOW()
   );
   ```
2. /account を開く
3. BusinessUpgradeAccountBanner（amber）が表示
4. 「閉じる」クリック → 非表示 + DB の upgradeNoticeShownAt 更新

## ケース 7: Cron 動作確認
```bash
# dry-run (本番 DB 参照、何も書き込まない)
export DATABASE_URL=$(grep ^PROD_DATABASE_URL= .env | cut -d= -f2-)
node scripts/check-business-upgrade-candidates.mjs --dry-run

# 本番 Cron route の動作確認（CRON_SECRET 必要）
curl -H "Authorization: Bearer $CRON_SECRET" https://autobanner.jp/api/cron/check-business-upgrade
```

## ケース 8: FRIENDS coupon が base のみ割引
1. test mode の新規 Free アカウントでログイン
2. /account → Pro Checkout に遷移時、URL に `?promo=FRIENDS` 付与
3. Stripe Checkout 画面で「FRIENDS」適用済表示、初月 ¥14,800 引き
4. usageCount を一時的に >100 にして metered 送信を発生させる
5. 月末 invoice で base ¥14,800 → ¥0、metered は通常課金（割引なし）
