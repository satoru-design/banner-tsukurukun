# 複数スタイル並列生成（Multi-Style Generation）設計仕様

**Date:** 2026-05-03
**Status:** Draft
**Author:** Satoru Koike (with Claude)
**関連 Phase:** A.16（仮）

---

## 1. 目的

現状、1 ブリーフセッションは pattern を1個しか指定できない。途中でスタイルを変えると STEP2 で生成された Gemini のコピー候補が破棄され、ユーザーが入力した素材選択も巻き戻されるため、「同じスクリプトのまま別スタイルでも生成して比較する」ことができない。

本機能は **「同一コピー・同一素材で複数スタイル（pattern）のバナーをまとめて生成し、スタイル別にグルーピング表示する」** 機能を追加する。

---

## 2. ゴール

| # | 要件 | 達成条件 |
|---|------|----------|
| G1 | STEP1 で複数 pattern を選択可能 | 代表 pattern 1個 + 追加 pattern 最大2個 = 合計1〜3個。Free は1個固定、Pro/Starter は最大3個 |
| G2 | 代表 pattern を変更しても STEP2 の suggestions が破棄されない | `suggestionsSignature` から pattern を除外 |
| G3 | STEP3 で size × pattern マトリクスを順次生成 | 例: 3 size × 3 pattern = 9枚を直列生成、進捗表示 |
| G4 | 生成結果はスタイル別にセクション分けして表示 | UI で「【王道】」「【ラグジュアリー】」見出しで2-3セクションに分割 |
| G5 | pattern が画像のビジュアルスタイルに効くようになる | `VISUAL_STYLE_HINTS` を `buildFinalImagePrompt` に注入。pre-flight で 6 pattern 描き分け確認済み |
| G6 | Free は 4 枚目以降 PREVIEW 透かし、DL は 3 枚まで | 既存 Phase A.14 ロジック流用、DL ボタンに plan lock |
| G7 | コピー文言が pattern に依存しない | STEP2 suggest API は代表 pattern 1個で呼出、selections は全 pattern で固定流用 |
| G8 | ZIP DL がスタイル別フォルダ構成 | `/王道/instagram_1080x1080.png` `/ラグジュアリー/instagram_1080x1080.png` ... |

---

## 3. 非ゴール（YAGNI）

- pattern ごとに別の Gemini suggest を呼んで別コピーを生成する仕組み（design 上 G7 と矛盾）
- 並列度を 3+ に上げる（直列 or concurrency=2 で十分。OpenAI rate limit のリスク回避）
- pattern を Custom（ユーザー定義）にする機能（既存 6 pattern で固定）
- バックグラウンドジョブ化（Vercel maxDuration=300s で 1 リクエスト=1 (size, pattern)、UI で逐次表示すれば十分）
- DB schema 変更（既存 Generation / GenerationImage で対応可能）

---

## 4. アーキテクチャ

### 4.1 データモデル拡張（型のみ、DB 変更なし）

```ts
// src/lib/prompts/ironclad-banner.ts
export interface IroncladBrief {
  pattern: IroncladPattern;            // 代表 pattern（既存）
  additionalPatterns: IroncladPattern[]; // 追加 pattern（新規、空配列 OK、最大2個）
  product: string;
  target: string;
  purpose: string;
  sizes: IroncladSize[];
}
```

`IroncladBaseMaterials` には pattern を保持するが、複数 pattern 生成時は呼出側で都度差し替える（Materials 自体を pattern 別に複製する設計）。

### 4.2 visual-only への pattern 再定義

新規定数 `VISUAL_STYLE_HINTS: Record<IroncladPattern, string>` を `src/lib/prompts/visual-style-hints.ts` に新設（外部化することで運用中に hint だけ書き換えやすい）。

```ts
export const VISUAL_STYLE_HINTS: Record<IroncladPattern, string> = {
  '王道': '...', // 配色 / 構図 / 質感 / フォント / 装飾 / 全体イメージ の6項目
  '綺麗め': '...',
  // ... 6 pattern
};
```

`buildFinalImagePrompt(m)` の末尾に以下を追記する:

```
## 🎨 ビジュアルスタイル指示（必ず厳守）
この広告は「{pattern}」スタイル。下記の視覚指示に従って描画すること。

{VISUAL_STYLE_HINTS[pattern]}

## ⚠️ コピー固定の絶対ルール
上記コピー以外の文言（「実感の声」「90 Capsules」等の追加要素）を勝手に追加しないこと。
コピー文言は一字一句、上記指定の通りに描画する。
```

「コピー固定の絶対ルール」は pre-flight で観測された「追加要素混入」（実感の声、90 Capsules 等）対策。

### 4.3 STEP1 UI

`IroncladBriefForm.tsx` に「追加スタイル（任意）」セクションを追加:

```
パターン *  → [王道] [綺麗め] [インパクト重視] [信頼感] [ストーリー型] [ラグジュアリー]
                ↑ 単一選択（既存と同じ）

[追加スタイルでも生成する（最大2個）✨ Pro] ← Pro/Starter のみ操作可能、Free は disabled
                                            ↓ クリックで展開
追加スタイル: [☐ 綺麗め] [☐ インパクト重視] [☐ 信頼感] [☐ ストーリー型] [☐ ラグジュアリー]
（代表で選んでいる pattern は表示しない）
```

Free が追加スタイルを開こうとすると `UpgradeLockModal` を表示。

### 4.4 STEP2 改修

- `suggestionsSignature` から `pattern` を除外: `${product}|${target}|${purpose}` のみ
- pattern 変更で suggestions は破棄されない
- `ironclad-suggest` API への入力 pattern は **代表 pattern 1個**を使う

### 4.5 STEP3 改修

`IroncladGenerateScreen.tsx` を `(size × pattern)` マトリクス対応に:

```
state results: SizeResult[]  →  PatternSizeResult[]

interface PatternSizeResult {
  pattern: IroncladPattern;
  size: IroncladSize;
  status: 'idle' | 'generating' | 'success' | 'error';
  imageUrl?: string;
  isPreview?: boolean;
  ...
}
```

UI:
```
🎨 王道
  ┌─────────────┬─────────────┬─────────────┐
  │ Instagram   │ Stories     │ FB/GDN      │
  │ [生成済]     │ [生成中]    │ [待機]      │
  └─────────────┴─────────────┴─────────────┘

🎨 ラグジュアリー
  ┌─────────────┬─────────────┬─────────────┐
  │ Instagram   │ Stories     │ FB/GDN      │
  │ [待機]      │ [待機]      │ [待機]      │
  └─────────────┴─────────────┴─────────────┘
```

直列で `[(size, pattern)] for pattern in [代表, ...追加] for size in sizes` の順に生成。

### 4.6 履歴保存（Generation = 1 pattern を維持）

既存 `ironclad-generate` API は 1 リクエスト = 1 (size, pattern) で動作中。`snapshotIdentityKey` は pattern を含むので、5分以内マージは「同 pattern 内の異 size 同セッション」のみマージされる（=複数 pattern は別 Generation になる）。

これは仕様通り。クライアント側で N 個の pattern を順次叩くと、N 個の Generation が作られる。履歴一覧では「同時刻帯に作られた複数 Generation」を作成日時の近接（5分以内）でグルーピング表示する（履歴 UI 改修は本 Phase 範囲外、後続 Phase で対応）。

### 4.7 PREVIEW & DL 制限（既存ロジック流用）

- 既存 `usageCount > USAGE_LIMIT_FREE` で Free に PREVIEW 透かしが焼き込まれる
- DL ボタンに plan check 追加: free user で `usageCount > USAGE_LIMIT_FREE` の image なら lock & UpgradeModal 起動
- マトリクス生成中に hardcap 到達 → 既存の 429 ロジックでそれ以降 block

### 4.8 ZIP DL 拡張（Pro+）

`/api/history/[id]/zip` は 1 Generation = 1 ZIP を返す既存実装。複数 pattern 対応のため、新規 API `/api/generations/zip-batch` を追加して generation id 群を受け取り、pattern 別フォルダで ZIP を返す。

```
zip 構成:
  /{pattern}/{size}.png
    例: /王道/Instagram (1080x1080).png
        /王道/FB-GDN (1200x628).png
        /ラグジュアリー/Instagram (1080x1080).png
```

---

## 5. データフロー

```
[STEP 1]
  pattern: 王道（代表）
  additionalPatterns: [ラグジュアリー, ストーリー型]
  sizes: [Instagram, Stories]
       ↓
[STEP 2]
  ironclad-suggest API (pattern=王道 で 1回だけ呼出)
  → 共通 selections（コピー4個・デザ要件4個・CTA・トーン・注意）
       ↓
[STEP 3]
  for pattern in [王道, ラグジュアリー, ストーリー型]:
    for size in [Instagram, Stories]:
      POST /api/ironclad-generate
        body: { pattern, ...selections, size }
      → Generation + GenerationImage 1件作成（既存のまま）

  結果: 6 GenerationImage / 3 Generation / 1 Brief
```

---

## 6. UI 詳細

### 6.1 STEP1 追加スタイル UI

```tsx
{/* 既存: パターン選択 */}
<div className="mb-4">
  <label>パターン *</label>
  {IRONCLAD_PATTERNS.map(p => <button key={p}>{p}</button>)}
</div>

{/* 新規: 追加スタイル */}
<div className="mb-4">
  <button onClick={togglePro}>
    🎨 追加スタイルでも生成する（最大2個）
    {plan === 'free' && <ProBadge />}
  </button>
  {showAdditional && (
    <div>
      {IRONCLAD_PATTERNS.filter(p => p !== brief.pattern).map(p => (
        <Checkbox
          checked={brief.additionalPatterns.includes(p)}
          disabled={!brief.additionalPatterns.includes(p) && brief.additionalPatterns.length >= 2}
          onChange={...}
        />
      ))}
      <p>選択中: {brief.additionalPatterns.length}/2</p>
    </div>
  )}
</div>
```

### 6.2 STEP3 マトリクス

```tsx
{[brief.pattern, ...brief.additionalPatterns].map(pattern => (
  <section key={pattern}>
    <h3>🎨 {pattern}</h3>
    <div className="grid">
      {sizes.map(size => {
        const r = results.find(r => r.pattern === pattern && r.size === size);
        return <BannerCard key={size} result={r} onRegenerate={...} onDownload={...} />;
      })}
    </div>
  </section>
))}
```

---

## 7. テスト計画

### 7.1 ローカル動作確認

| ケース | 操作 | 期待 |
|---|---|---|
| L1 | Free で「追加スタイル」をクリック | UpgradeLockModal が出る |
| L2 | Pro で代表「王道」+ 追加 [ラグジュアリー] + 1 size | STEP3 で 2 セクション × 1 枚 = 2枚生成、両方視覚的に違う |
| L3 | Pro で代表「王道」+ 追加 [ラグジュアリー, インパクト重視] + 2 size | STEP3 で 3 セクション × 2 枚 = 6枚、直列生成 |
| L4 | STEP1 で pattern を「王道」→「ラグジュアリー」に変更 | STEP2 で suggestions が保持される |
| L5 | Free で 1 size × 1 pattern で 4 セッション目を生成 | PREVIEW 透かし焼き込み + DL ボタン lock |

### 7.2 Vercel Preview 実機テスト（visualStyleHint 効果検証）

| ケース | 操作 | 期待 |
|---|---|---|
| P1 | seed asset (5 Point Detox + GMP + Australian Government) で 6 pattern × Instagram 生成 | composite mode + visualStyleHint で 6 pattern が視覚的に描き分けられる |
| P2 | P1 のうち 「インパクト重視」「ラグジュアリー」「ストーリー型」 | 配色・構図が pre-flight enhanced と同等か、より強い識別性 |
| P3 | コピー固定 | 「実感の声、多数」「90 Capsules」等の追加要素が混入しない |
| P4 | reference 画像（ボトル）の改変なし | 6 pattern 全てで同じボトル形状・ラベル |

P1 で識別性が pre-flight より大幅に弱い場合 → `VISUAL_STYLE_HINTS` の各 pattern hint を強化（外部 JSON なので即修正可能）。

---

## 8. リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| composite mode で visualStyleHint が薄まる | 6 pattern 描き分けが弱化 | `VISUAL_STYLE_HINTS` を JSON 化して即書き換え可能に。実機テスト後に強化 |
| 直列 6-9 枚生成で UX が長すぎる | ユーザー離脱 | 進捗バー + 完成済みバナー逐次表示で「進んでいる感」を出す。並列度 2 への昇格は OpenAI rate limit 観測後 |
| pattern 数 × size 数で usageCount を一気に消費 | Free が即枯渇 | hardcap 既存ロジックで gate される（4枚目 PREVIEW、9枚目 429）。これは仕様通り |
| Pro が 17 size × 3 pattern = 51 枚を一回で消費 | 100 枠が ~2 セッションで枯渇 → メータード課金に進む | 仕様通り（むしろ売上 UP）。UI で「3 pattern × 17 size = 51 枠消費します」事前確認モーダル |
| コピー文言の追加要素混入（pre-flight で観測） | 法務リスク（薬機法） | プロンプト末尾に「コピー固定の絶対ルール」を明記、実機 P3 で確認 |
| クライアント側ループ中にネットワーク切断 | 一部だけ生成済みで中途半端 | 各 (size, pattern) は独立 generation で履歴に保存される。ユーザーは履歴から続きを再生成できる（既存機能） |

---

## 9. 実装スコープ

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/lib/prompts/visual-style-hints.ts` | **新規** 6 pattern × visualStyleHint |
| `src/lib/prompts/ironclad-banner.ts` | `IroncladBrief.additionalPatterns` 追加、`buildFinalImagePrompt` に hint 注入 + コピー固定ルール |
| `src/components/ironclad/IroncladBriefForm.tsx` | 追加スタイル UI |
| `src/components/ironclad/IroncladGenerateScreen.tsx` | size × pattern マトリクス対応、生成ループ |
| `src/components/ironclad/PatternSection.tsx` | **新規** マトリクス UI コンポーネント |
| `src/app/page.tsx` | `INITIAL_BRIEF.additionalPatterns: []`、`currentSignature` から pattern 除外、baseMaterials の patterns 配列化 |
| `src/app/api/generations/zip-batch/route.ts` | **新規** pattern 別フォルダ ZIP DL |
| `src/components/ironclad/PatternsBatchZipButton.tsx` | **新規** 一括 ZIP DL ボタン（Pro+） |

### DB 変更

なし。

---

## 10. リリース手順

1. ブランチ `feat/multi-style-generation` 作成
2. Task 1〜9 を順次実装、各 Task ごとに commit
3. Vercel Preview デプロイ
4. P1〜P4 を実機テスト → 結果が pre-flight enhanced 同等以上ならマージ準備
5. PR 作成 → main マージ
6. tag `phase-a16-multi-style-complete` push
7. 本番動作確認（admin 自身で 2 pattern × 1 size 生成）

---

## 11. ロールバック計画

- DB 変更なし → schema 戻し不要
- `git revert <merge-commit>` 一発で UI / API / プロンプトすべて元に戻る
- `VISUAL_STYLE_HINTS` の hint だけ問題なら、当該ファイルのみ revert で部分巻き戻し可能
