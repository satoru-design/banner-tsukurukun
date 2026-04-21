# Phase A.6 手動受入テスト評価シート

## 目的
5 Point Detox の公式既存バナー 5 枚を参考入力として StyleProfile を作成し、
その StyleProfile で同じ LP を生成した結果を参考バナーと並べて評価する。

## 手順

### 1. プロファイル作成
- Preview URL で Step 1 に進む
- 「+ 新規プロファイル作成」をクリック
- プロファイル名: "5 Point Detox 用"
- 商材メモ: "デトックスドリンク / 40-50 代女性向け / ダイエット訴求"
- 参考画像 5 枚（`C:/Users/strkk/ref-banners/banner-01.jpeg` 〜 `banner-05.jpeg`）を D&D
- 「解析開始」→ 抽出結果を確認・微調整 → 「保存」

### 2. プロファイル無しで生成（ベースライン）
- Step 1 で「プロファイル無し」を選択
- LP URL: （5 Point Detox の LP URL）
- 8 アングル全生成 → 各アングルで Imagen 4 と FLUX それぞれ 1 枚ずつ = 16 枚生成
- スクショ保存: `without-profile/after-<angle>-<model>.jpg`

### 3. プロファイル有りで生成
- Step 1 で「5 Point Detox 用」を選択
- 同じ LP URL で同じアングルを全生成 = 16 枚
- スクショ保存: `with-profile/after-<angle>-<model>.jpg`

### 4. 評価軸
| 項目 | 評価 |
|---|---|
| 参考バナーに近いか（1〜5） | |
| 広告らしさ | |
| 可読性 | |
| コピーのトーン適合 | |
| 価格バッジの馴染み | |
| 全体の統一感 | |

### 合格基準
- プロファイル有り群の平均が参考比 **85% 以上**
- ブラインドテストで **50% 以上**が「参考バナーと見分けつかない」

## 参考画像
- `C:/Users/strkk/ref-banners/banner-01.jpeg` — 黒シルエット×ジャンクフード
- `C:/Users/strkk/ref-banners/banner-02.jpeg` — 笑顔の女性+成分リスト
- `C:/Users/strkk/ref-banners/banner-03.jpeg` — ハーブ背景
- `C:/Users/strkk/ref-banners/banner-04.jpeg` — 40代女性クローズアップ
- `C:/Users/strkk/ref-banners/banner-05.jpeg` — 黒タートル女性
