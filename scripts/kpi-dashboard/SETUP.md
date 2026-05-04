# KPI ダッシュボード セットアップ手順

ファイブポイントデトックスの daily KPI シート形式を踏襲した、勝ちバナー作る君用の自動 KPI ダッシュボードです。

## 完成イメージ

| date | Sales | Cost | ROAS | imp | click | CTR | CPC | LP訪問 | Free登録CV | Free CPA | Free Cvr | Paid CV | Paid CPA | Paid Cvr | Starter売上 | Starter cv | Pro売上 | Pro cv | Business売上 | Business cv | 退会 | 累Starter | 累Pro | 累Business | 生成枚数 | 生成(Free) | 生成(Starter) | 生成(Pro) | 生成(Business) | memo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

毎朝 8:00 JST に前日 1 日分が自動追記されます。

## 自動取得 vs 手動入力

### 自動（GAS が毎日入れる）
- Sales / Starter売上 / Pro売上 / Business売上 (Stripe API)
- Starter cv / Pro cv / Business cv (Stripe API)
- Free登録CV / Paid CV / 退会 (autobanner.jp /api/admin/kpi)
- 累Starter / 累Pro / 累Business (autobanner.jp)
- 生成枚数 / プラン別生成 (autobanner.jp)

### 手動入力（毎朝 Meta Ads Manager から転記）
- Cost (Meta 広告費)
- imp / click (Meta 広告 impressions / clicks)
- LP訪問 (GA4 のユニークユーザー数)
- memo

### 自動計算（数式列・手動入力後に即時算出）
- ROAS = Sales / Cost
- CTR = click / imp
- CPC = Cost / click
- Free CPA = Cost / Free登録CV
- Free Cvr = Free登録CV / LP訪問
- Paid CPA = Cost / Paid CV
- Paid Cvr = Paid CV / Free登録CV

## セットアップ 9 ステップ（30 分）

### ステップ 1: Google Sheets を新規作成

1. https://sheets.new を開く
2. ファイル名: 「**勝ちバナー作る君 daily KPI**」
3. URL から **シート ID** をコピー（例: `https://docs.google.com/spreadsheets/d/【ここがID】/edit`）

### ステップ 2: Apps Script を開く

1. シート上部メニュー → **拡張機能** → **Apps Script**
2. デフォルトの `Code.gs` をすべて削除
3. **このリポジトリの `scripts/kpi-dashboard/Code.gs` の中身**を全コピペ
4. 保存（Ctrl+S）

### ステップ 3: タイムゾーンを Asia/Tokyo に

1. Apps Script 左サイドバー → **プロジェクトの設定**（⚙️）
2. **タイムゾーン** → **(GMT+09:00) 日本標準時**

### ステップ 4: Vercel に ADMIN_KPI_SECRET 環境変数を設定

ローカルで以下を実行（事前に SECRET を生成）:

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
SECRET=$(openssl rand -hex 32)
echo $SECRET  # この値を控えておく
node scripts/vercel-set-env.mjs ADMIN_KPI_SECRET "$SECRET" production preview --sensitive
```

Vercel 反映には git push が必要なので、空コミットで rebuild:
```bash
git commit --allow-empty -m "chore: rebuild for ADMIN_KPI_SECRET"
git push origin main
```

### ステップ 5: Apps Script に Script Properties を設定

Apps Script 左サイドバー → **プロジェクトの設定**（⚙️） → **スクリプト プロパティ** → **スクリプト プロパティを追加**

以下 5 つを順に追加:

| プロパティ | 値 |
|---|---|
| `STRIPE_LIVE_KEY` | `sk_live_...`（`~/.claude/secrets/stripe-live-token` の値） |
| `KPI_API_URL` | `https://autobanner.jp/api/admin/kpi` |
| `ADMIN_KPI_SECRET` | ステップ 4 で生成した SECRET |
| `SHEET_ID` | ステップ 1 でコピーした ID |
| `SHEET_NAME` | `KPI`（任意・デフォルト KPI） |

### ステップ 6: 動作確認（手動実行）

1. Apps Script のエディタ上部 → 関数選択ドロップダウン → **manualRun**
2. **▶ 実行**
3. 初回は権限承認ダイアログ → 「**詳細**」 → 「**(プロジェクト名) （安全ではないページ）に移動**」 → 「**許可**」
4. 実行ログ（下部）に `[KPI] DONE` が出れば成功
5. Google Sheets に切り替え → KPI シートに前日 1 行が追記されているか確認

### ステップ 7: 過去データを backfill（任意）

過去 30 日分を一気に埋めたい場合、以下を Apps Script で実行:

```javascript
function backfill30days() {
  for (let i = 1; i <= 30; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
    d.setUTCHours(0, 0, 0, 0);
    const dateStr = d.toISOString().substring(0, 10);
    PROP.setProperty('_backfillDate', dateStr); // 一時的に override
    // ...（要 fetchKpiApi/fetchStripeData の date 引数化、現状は yesterday 固定なので backfill 非対応）
  }
}
```

※ Phase 2 で実装。現状は当日以降の日次蓄積のみ。

### ステップ 8: 毎朝 8:00 自動実行トリガーを設定

1. Apps Script の関数選択 → **setupDailyTrigger**
2. **▶ 実行**
3. 実行ログに `daily 8:00 trigger created` 表示で OK
4. 左サイドバー → **トリガー**（⏰）で `dailyKpiUpdate` が「日次・午前 8 時〜9 時」になっているか確認

### ステップ 9: 条件付き書式を設定（任意・推奨）

ファイブポイントデトックスのように緑/赤グラデで視認性を上げる:

1. シートで列を選択（例: ROAS 列）
2. **表示形式** → **条件付き書式** → **カラースケール**
3. 推奨設定:
   - **ROAS**: 0% = 赤、150% = 緑（広告費に対する売上倍率）
   - **CTR**: 0% = 赤、3% = 緑
   - **Free Cvr**: 0% = 赤、30% = 緑
   - **Paid Cvr**: 0% = 赤、30% = 緑
   - **CAC / CPA 系**: 0 = 緑、5,000 = 赤（小さいほど良い）

## 動作タイミング

- **毎朝 8:00 JST**: 前日 (JST 0:00 〜 23:59) の KPI が追記される
- 手動入力（Cost / imp / click / LP訪問）は 9:00 頃 Meta Ads Manager + GA4 から転記
- 数式列（ROAS / CTR / CPA / CVR）は手動入力 1 秒後に自動計算

## 既知の制限・Phase 2 で改善

| 項目 | 現状 | Phase 2 |
|---|---|---|
| Cost / imp / click | 手動入力 | Meta Ads API 自動取得 |
| LP訪問 | 手動入力 | GA4 Data API 自動取得 |
| 過去 backfill | 非対応 | date 引数化して任意日 fetch 可 |
| Slack 通知 | なし | 毎朝 KPI サマリを #marketing に投稿 |
| LTV 計算 | なし | 月次 cohort retention 別 LTV 算出 |

## トラブルシューティング

### `KPI API failed: 401`
→ Vercel の `ADMIN_KPI_SECRET` と Apps Script の `ADMIN_KPI_SECRET` が一致しているか確認。Vercel 側を変えたら git push で rebuild してから Apps Script を実行。

### `Stripe API failed: 401`
→ `STRIPE_LIVE_KEY` が `sk_live_...` で始まっているか確認。Stripe Dashboard で API key 有効性を確認。

### 「Script Properties 未設定」エラー
→ ステップ 5 で全 5 項目を入れたか確認。スペル間違い注意（大文字小文字含む）。

### 行が追記されない
→ Apps Script 左サイドバー → **実行数** で エラー履歴を確認。stack trace から原因特定。

## メンテナンス

- 月 1 回くらい、自動実行のログを確認（実行数 → エラーがないか）
- Stripe API key を rotate した時は Script Properties の `STRIPE_LIVE_KEY` も更新
- 列追加したい時は `Code.gs` の `COLUMNS` 配列に追記 → 既存シートのヘッダー行は手動で追加 → 次回実行から自動入力
