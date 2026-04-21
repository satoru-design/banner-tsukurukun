# ベースライン録画手順（Phase A 前後の比較用）

## 目的
Phase A（画像モデル Dual 化）の効果を可視化するため、同一 LP・同一アングルでの生成結果を
**Before（Gemini Flash）** と **After（Imagen 4 / FLUX）** で比較する。

## テスト対象 LP（3 本）

> 小池さんが実際に指定してください。以下はプレースホルダ例：

1. `<LP1 URL>` — 美容系・人物ベース想定
2. `<LP2 URL>` — BtoB・オフィス/UI 系想定
3. `<LP3 URL>` — サプリ・ダイナミックビジュアル想定

差し替えたらこのファイルの例部分を更新してコミットしてください。

---

## ⚠ Phase A 着手後に気づいた方向け

現在の `feature/phase-a-image-dual` ブランチは既に Imagen 4 / FLUX に切り替わっています。**厳密な Before ベースライン（Gemini Flash 時代）を取りたい場合**は、一時的に main（または Phase A 前のタグ）に戻してから録画してください：

```bash
git stash                       # 作業中ブランチの変更を退避
git checkout main               # Gemini Flash 時代のコード
npm install && npm run dev      # ポート 3000 or 3001
# → 12 枚キャプチャ
git checkout feature/phase-a-image-dual
git stash pop
```

もし口頭記憶で十分なら、Before 録画はスキップして After 録画（Phase A 完了後 = 下記）のみで比較してもOKです。

---

## 手順（Phase A 着手前 = Before 録画）

1. ローカル起動
   ```bash
   cd C:\Users\strkk\claude_pjt\banner-tsukurukun
   npm run dev
   ```
2. ブラウザで http://localhost:3000 を開く（Basic Auth 実装前なのでそのまま入れる）
3. 各 LP で 4 アングル × 1 枚ずつ = 12 枚生成
4. Step3 で画像確定 → ブラウザ右クリックで画像保存
5. ファイル名ルール：`before-<LP番号>-<アングル名>.jpg`
   - 例: `before-1-benefit.jpg`, `before-1-fear.jpg`, `before-1-authority.jpg`, `before-1-empathy.jpg`
6. 保存先：`docs/baselines/2026-04-21-before-phase-a/`

## 手順（Phase A 完了後 = After 録画）

1. 同じ LP・同じアングルで、`imagen4` と `flux` 両方で再生成
2. ファイル名ルール：`after-<LP番号>-<アングル名>-<モデル>.jpg`
   - 例: `after-1-benefit-imagen4.jpg`, `after-1-benefit-flux.jpg`
3. 保存先：`docs/baselines/2026-04-21-after-phase-a/`
4. 合計: 3 LP × 4 アングル × 2 モデル = 24 枚

## 評価基準（比較時）

- [ ] 人物の顔・手指の破綻（Flash 系でよくある）が減っているか
- [ ] テキスト用ネガティブスペース指示（"left half empty" 等）に従っているか
- [ ] ライティングの品質（広告クリエイティブ水準か）
- [ ] 日本的トーン指定（和風・清潔感等）への追従度
- [ ] プロンプトに含めない「ダサい」要素が勝手に混入していないか
