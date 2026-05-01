# Meta 広告 CV 設定・最適化アクション 引継ぎ

## サービス概要

- **サイト**: https://autobanner.jp
- **サービス名**: 勝ちバナー作る君（AI バナー一括生成 SaaS）
- **運営**: 株式会社4th Avenue Lab（小池 慧）
- **本日 2026-05-01 全公開化済**（whitelist 解除）

## プラン構成

| プラン | 月額（税込） | 上限 |
|---|---|---|
| Free | ¥0 | 月 3 セッション、4回目以降は PREVIEW 透かし入り |
| Starter | ¥3,980 | 月 30 セッション、5 サイズ |
| Pro | ¥14,800 | 月 100 セッション、超過 ¥80/回（メータード課金） |
| Plan C | 個別商談 | /contact から問合せ |

## 計測タグ設置状況（既に完了）

| ツール | ID | 設置方法 |
|---|---|---|
| **Google Tag Manager** | `GTM-T4ZNBZ7R` | site-wide（全ページ） |
| **GA4** | `G-4WQ14T471C` | GTM 経由「GA4 - All Pages」タグ |
| **Microsoft Clarity** | `wjy4elb3aq` | GTM 経由 Custom HTML タグ |
| **Meta Pixel** | `1562291372271933` | GTM 経由 Custom HTML タグ「meta pixel」（PageView 全ページ） |
| **Meta Conversion API** | アクセストークン設定済 | サーバー側、Stripe `checkout.session.completed` webhook 内で **Purchase** イベント送信 |

## 実装済 CV イベント

| イベント | 発火元 | 計測経路 |
|---|---|---|
| **PageView** | 全ページ | Pixel（Browser → GTM Custom HTML） |
| **Purchase** | Stripe Checkout 完了時 | **CAPI のみ**（サーバー側、`event_id`=Stripe session.id） |

CAPI 実装ファイル: `src/lib/billing/meta-capi.ts`
Webhook 統合: `src/lib/billing/webhook-handlers/checkout-completed.ts`

## **未実装の CV イベント（追加検討対象）**

広告最適化のため追加すべきイベント候補：

| イベント | 発火タイミング | 推奨計測方法 |
|---|---|---|
| **Lead** | Google SSO サインイン完了時 | Pixel + CAPI（早期 CV 用、初期キャンペーンで使用） |
| **CompleteRegistration** | 初回ユーザー登録時 | 同上 |
| **InitiateCheckout** | Stripe Checkout ボタンクリック時 | Pixel（Browser、`/api/billing/checkout-session` 呼び出し時に dataLayer push） |
| **ViewContent** | 料金プラン表示時（Pricing セクション 50%スクロール）| Pixel（GTM スクロール深度トリガー） |
| **AddPaymentInfo** | Stripe Checkout でクレカ入力時 | Pixel（Stripe イベント連携、技術的に難しいので優先度低） |

## A/B テスト構成

- `/lp01` = **機能訴求**（17 サイズ一括生成 / 勝ちバナー学習）
- `/lp02` = **時短訴求**（テンプレを作る時間、もう要りません）
- 共通セクション（Problem / Solution / Features / Comparison / CustomerVoice / Pricing / FAQ / FinalCta）は完全同一
- Hero のみ A/B 化されている
- **広告側で出稿先 URL を /lp01 と /lp02 で分けるだけで A/B 計測可能**（コード側 random 振り分けなし）

## ファネル全体像

```
LP訪問（PageView）
   ↓
無料で試す → Google SSO サインイン（Lead）
   ↓
Pro にする → Stripe Checkout 起動（InitiateCheckout）
   ↓
決済完了（Purchase）← ここが最重要 CV、CAPI で確実に取得済
   ↓
バナー生成・継続利用
```

## 推奨 Meta 広告設定

### 1. CV 最適化キャンペーン（推奨）

**フェーズ 1（CV データ蓄積期、初期 0〜2週間）**:
- 最適化対象: **Lead**（サインイン完了）または **CompleteRegistration**
- 理由: Purchase は CV 数が少なすぎて Meta の機械学習が回らない。早期 CV で学習させる
- 必要実装: Lead イベントの Pixel + CAPI 両発火（後述）

**フェーズ 2（CV データ蓄積後、2〜4 週間目以降）**:
- 最適化対象: **Purchase**
- 理由: Lead で CV を集めてから Purchase 最適化に切り替えると ROAS が改善

### 2. オーディエンス設定

- **カスタムオーディエンス**:
  - LP 訪問者（過去 30 日）
  - サインイン完了者（過去 30 日）
  - Pro Checkout 完了者（過去 60 日）
- **類似オーディエンス**: Pro Checkout 完了者の 1〜2% 類似
- **除外**: 既存有料プラン契約者（DB 連携 or 顧客リストアップロード）

### 3. クリエイティブ

- LP に既に生成バナーが配置されているので、**そのまま広告クリエイティブとして転用可能**
- `/public/lp/banners/` 配下に Instagram / YDA / Display 全 5 サイズあり

## 次にメインチャットでやってほしいこと（追加実装）

メインの Claude Code セッションでは現在、**ステマ規制・コスト暴走・DB 分離等のリスク管理修正中**。完了後に以下を依頼予定：

1. **Lead イベント発火**: NextAuth signIn callback 成功時に dataLayer push + CAPI 送信
2. **InitiateCheckout イベント発火**: `CheckoutButton` クリック時に `fbq('track', 'InitiateCheckout', {...}, {eventID: ...})` で dataLayer push
3. **Pixel-side Purchase 発火**: Stripe Checkout 完了後の戻り URL（`/account?stripe=success`）で fbq + 同じ event_id でデデュプ
4. **GA4 で Lead/Purchase の Conversion 設定**: GTM で GA4 Event タグを Lead トリガー / Purchase トリガーで設置

## Stripe / 決済情報

- ライブモード稼働中、KYC 完了済
- インボイス番号: T8010901045333
- Promotion Code「FRIENDS」: Pro 100% off / 期限 2026-07-31（テスト用に小池さんがフルフロー検証済）

## 制約・注意点

- 1 人運営なのでサポート対応は **平日 10〜17 時 / 2 営業日以内目安**
- ALLOWED_EMAILS 解除済（誰でも Google アカウントでサインイン可能）
- まだ実顧客はゼロ、最初の有料契約獲得が当面の目標

## 質問されたら

実装やコード変更は別の Claude Code セッション（メインチャット）で行うので、Meta 広告マネージャー側の設定・最適化提案・CV 戦略の相談に集中してほしい。
