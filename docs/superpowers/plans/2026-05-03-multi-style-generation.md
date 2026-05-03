# 複数スタイル並列生成 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**作成日:** 2026-05-03
**Spec:** [docs/superpowers/specs/2026-05-03-multi-style-generation-design.md](../specs/2026-05-03-multi-style-generation-design.md)

**Goal:** STEP1 で 1〜3 個の pattern を選び、STEP3 で size × pattern マトリクスを直列生成、スタイル別セクションで表示する機能を追加する。pattern が画像のビジュアルに効くよう `VISUAL_STYLE_HINTS` を画像プロンプトに注入する。

**Architecture:** DB schema 変更なし。`IroncladBrief.additionalPatterns: IroncladPattern[]` を型レベルで追加し、STEP3 で `[brief.pattern, ...brief.additionalPatterns]` を for-loop で順次叩く。1 リクエスト=1 (pattern, size) で既存 `/api/ironclad-generate` をそのまま再利用、N pattern なら N Generation が作られる。`IroncladBaseMaterials.pattern` は representative として残るが、ループ内で `{ ...baseMaterials, pattern, size }` で都度上書きして API に渡すため、実質的にはループ毎の pattern が優先される。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / 既存 OpenAI gpt-image-2 image edit API / NextAuth v5

**Out of scope（後続 Phase A.16.1 で対応予定）:**
- ZIP DL の pattern 別フォルダ構成（spec §4.8）— 本 Phase MVP には含めない。複数 pattern 生成時は履歴一覧から各 Generation を個別 ZIP DL する既存挙動でカバーする。
- 履歴一覧での「同時刻帯の複数 Generation」グルーピング表示（spec §4.6）— 既存挙動（時系列順表示）のまま。

**Test 方針:** プロジェクトはテストフレーム未導入。各 Task は「TypeScript ビルド成功 + lint 成功 + 手動表示確認」で検証。Vercel Preview 上で T1〜T5（spec §7.1 / §7.2）を実機テスト。

---

## ファイル構成マップ

### 新規

| ファイル | 責務 |
|---|---|
| `src/lib/prompts/visual-style-hints.ts` | 6 pattern × visualStyleHint テキスト定数 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `src/lib/prompts/ironclad-banner.ts` | `IroncladBrief.additionalPatterns` 追加、`buildFinalImagePrompt` に hint + コピー固定ルール注入 |
| `src/app/page.tsx` | `INITIAL_BRIEF.additionalPatterns: []`、`currentSignature` から pattern 除外 |
| `src/components/ironclad/IroncladBriefForm.tsx` | 追加スタイル UI、Free lock |
| `src/components/ironclad/IroncladGenerateScreen.tsx` | size × pattern マトリクス対応、`PatternSection` inline コンポーネント、生成ループ |

---

## 依存関係まとめ

```
Task 1 (VISUAL_STYLE_HINTS) ────┐
                                 ├─→ Task 3 (prompt 注入) ─→ Task 6 (Preview & 実機テスト) ─→ Task 7 (merge)
Task 2 (型拡張) ─────────────────┤
                                 ├─→ Task 4 (STEP1 UI) ─────↗
                                 └─→ Task 5 (STEP3 マトリクス) ↗
```

Task 1 と Task 2 は独立。Task 3 は Task 1+2 完了後。Task 4 は Task 2 後。Task 5 は Task 2 後。Task 6 は Task 3+4+5 全部完了後。

---

## CP1: visualStyleHint と型拡張

### Task 1: `VISUAL_STYLE_HINTS` を新設

**Files:**
- Create: `src/lib/prompts/visual-style-hints.ts`

- [ ] **Step 1: 新規ファイルを作成**

`src/lib/prompts/visual-style-hints.ts`:

```ts
import type { IroncladPattern } from './ironclad-banner';

/**
 * 6 pattern それぞれの「画像ビジュアル」専用ヒント。
 * Phase A.16: pattern を「コピー文言フレーバー」から「画像ビジュアルスタイル」に再定義したことに伴い新設。
 *
 * 配色 / 構図 / 質感 / フォント / 装飾 / 全体イメージ の 6 軸で各 pattern の差を強く出す。
 *
 * 運用中に hint だけ書き換えやすいよう外部化（ironclad-banner.ts には混ぜない）。
 * 実機 Preview で識別性が弱い pattern があれば、ここの該当エントリだけ強化すれば即反映できる。
 *
 * 2026-05-03 pre-flight 結果（同コピー × 6 pattern × reference なし）:
 *   - baseline (pattern 単語のみ) → 6 pattern ほぼ識別不能
 *   - enhanced (本ファイル注入)   → 6 pattern 明確に描き分け
 */
export const VISUAL_STYLE_HINTS: Record<IroncladPattern, string> = {
  '王道': [
    '配色: 白基調 + 緑(#2E7D32 系)アクセント + 黒文字。コントラスト強め。',
    '構図: 左にコピー、右に商品の左右分割。中央に大きな数字を必ず配置。',
    '質感: フラット、クリーン、印刷物的な実直さ。',
    'フォント: 太いゴシック体メイン、数字部分は極太+斜体可。',
    '装飾: 強調枠、ふきだし、矢印、円形バッジでメッセージを強調。',
    '全体イメージ: 通販雑誌・ジャパネット型ダイレクトレスポンス王道。',
  ].join('\n'),

  '綺麗め': [
    '配色: オフホワイト + ペールグリーン(#D5E8D4 系) + 淡いベージュ。低彩度。',
    '構図: 余白を大胆にとり、商品をセンター単体配置。コピーは控えめ。',
    '質感: 上質紙、ソフトシャドウ、自然光のような柔らかい照明。',
    'フォント: 細めの明朝体メイン。サブは細ゴシック。',
    '装飾: ほぼなし。細い罫線か、葉のシルエット程度。',
    '全体イメージ: 女性誌「&Premium」「kiitos」風、抜け感とミニマル。',
  ].join('\n'),

  'インパクト重視': [
    '配色: ビビッドな黄色(#FFEB00) or 蛍光緑 or 赤(#E53935)を多用。コントラスト極大。',
    '構図: 大文字コピーが画面の50-60%を占める。商品は左下脇役、数字は最大級。',
    '質感: 漫画的ベタ塗り、強い縁取り(stroke)、爆発エフェクト。',
    'フォント: 極太ゴシック・斜体・変形可。「!!」「-2kg」を巨大に。',
    '装飾: オノマトペ「スルッ」「ドン!」、集中線、星型バッジ。',
    '全体イメージ: 漫画広告、トリプルA8、スクロールを物理的に止める強い視覚刺激。',
  ].join('\n'),

  '信頼感': [
    '配色: ネイビー(#0D2C54) + 白 + ゴールド(#C9A227)差し色。落ち着いた高彩度。',
    '構図: 認証バッジを大きく目立つ位置に配置。中央上部に専門家肖像枠の余白を確保。',
    '質感: マット、堅実、医療パンフレット・公式書類風。',
    'フォント: 明朝体・セリフ系、伝統的で重量感あり。',
    '装飾: 罫線、賞のリボン、鍵マーク、checkmark。',
    '全体イメージ: 学術・公的・長期実績を訴求。製薬・金融広告の信頼トーン。',
  ].join('\n'),

  'ストーリー型': [
    '配色: 暖色系ベージュ(#F5E6D3) + ライトオレンジ + ブラウン。自然光ライク。',
    '構図: 40代女性の日常シーン(リビング・キッチン)が画面の70%を占める。コピーは下部に控えめオーバーレイ。',
    '質感: 写真ベース、ライフスタイル誌風、シネマティック、浅い被写界深度。',
    'フォント: 細めゴシック+手書き風混在可。日記のような親密さ。',
    'マスクや仰々しい装飾は禁止。写真の力で語る。',
    '全体イメージ: 共感→興味の流れ。北欧暮らしの道具店・ドキュメンタリー的。',
  ].join('\n'),

  'ラグジュアリー': [
    '配色: ディープネイビー or ブラック基調 + ゴールドホイル(#D4AF37) + ホワイトスペース。',
    '構図: 余白を大胆にとり、商品をセンター単体配置。コピーは最小限。',
    '質感: マット紙 + 箔押し風、エンボス、ガラスのような光沢。',
    'フォント: 細めセリフ体(Didot, Bodoni 系)・大文字・字間広め。',
    '装飾: ゴールドの細線、最小限のアイコン、ヘアラインボーダー。',
    '全体イメージ: ハイエンドD2C、価値提案優先、価格訴求なし。Cartier・Aesop の広告ライク。',
  ].join('\n'),
};
```

- [ ] **Step 2: TypeScript ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 3: コミット**

```bash
git add src/lib/prompts/visual-style-hints.ts
git commit -m "feat(prompts): add VISUAL_STYLE_HINTS for 6 patterns

Phase A.16 multi-style generation 準備。pattern を画像ビジュアルスタイルに再定義し、
配色 / 構図 / 質感 / フォント / 装飾 / 全体イメージの 6 軸で各 pattern の描き分けを強化。

pre-flight 検証結果（2026-05-03 同コピー × 6 pattern）:
- baseline (pattern 単語のみ): 6 pattern ほぼ識別不能
- enhanced (本ファイル注入):    6 pattern 明確に描き分け

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `IroncladBrief` に `additionalPatterns` を追加

**Files:**
- Modify: `src/lib/prompts/ironclad-banner.ts:120-126`

- [ ] **Step 1: 既存 interface を確認**

Run: `grep -n "interface IroncladBrief" src/lib/prompts/ironclad-banner.ts`
Expected: line 120 付近

- [ ] **Step 2: `IroncladBrief` を編集**

`src/lib/prompts/ironclad-banner.ts:120-126`:

変更前:
```ts
export interface IroncladBrief {
  pattern: IroncladPattern;
  product: string;
  target: string;
  purpose: string;
  sizes: IroncladSize[];
}
```

変更後:
```ts
export interface IroncladBrief {
  /** 代表 pattern（STEP2 suggest はこの 1 個で呼ぶ） */
  pattern: IroncladPattern;
  /**
   * Phase A.16: 追加スタイル（最大 2 個）。Free は常に空配列、Pro/Starter のみ最大 2 個まで設定可能。
   * STEP3 では [pattern, ...additionalPatterns] の順に直列生成する。
   */
  additionalPatterns: IroncladPattern[];
  product: string;
  target: string;
  purpose: string;
  sizes: IroncladSize[];
}
```

- [ ] **Step 3: TypeScript ビルド確認**

Run: `npx tsc --noEmit`
Expected: 多数エラー（additionalPatterns 必須化により呼出箇所が壊れる）

エラーが出る箇所をすべて Step 4 で修正する。

- [ ] **Step 4: 既存呼出箇所を修正**

Run: `grep -rn "INITIAL_BRIEF\|: IroncladBrief\b" src/ --include="*.tsx" --include="*.ts"`

ヒットする箇所すべてに `additionalPatterns: []` を追加する。代表的な箇所:

`src/app/page.tsx:18-24`:

変更前:
```ts
const INITIAL_BRIEF: IroncladBrief = {
  pattern: '王道',
  product: '',
  target: '',
  purpose: '',
  sizes: ['Instagram (1080x1080)'],
};
```

変更後:
```ts
const INITIAL_BRIEF: IroncladBrief = {
  pattern: '王道',
  additionalPatterns: [],
  product: '',
  target: '',
  purpose: '',
  sizes: ['Instagram (1080x1080)'],
};
```

`src/app/page.tsx:94-100`（`?regenerate` / `?prefill` で履歴復元する箇所）:

変更前:
```ts
setBrief({
  pattern: briefSnapshot.pattern,
  product: briefSnapshot.product,
  target: briefSnapshot.target,
  purpose: briefSnapshot.purpose,
  sizes: briefSnapshot.sizes ?? ['Instagram (1080x1080)'],
});
```

変更後:
```ts
setBrief({
  pattern: briefSnapshot.pattern,
  additionalPatterns: [], // 履歴復元では常に代表 pattern 1 個のみ（追加は再選択させる）
  product: briefSnapshot.product,
  target: briefSnapshot.target,
  purpose: briefSnapshot.purpose,
  sizes: briefSnapshot.sizes ?? ['Instagram (1080x1080)'],
});
```

- [ ] **Step 5: TypeScript ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラー 0

- [ ] **Step 6: Lint 確認**

Run: `npm run lint`
Expected: エラー 0

- [ ] **Step 7: コミット**

```bash
git add src/lib/prompts/ironclad-banner.ts src/app/page.tsx
git commit -m "feat(types): add IroncladBrief.additionalPatterns (max 2)

Phase A.16 multi-style generation 準備。代表 pattern + 追加 pattern (最大 2 個) の構造を導入。
DB schema 変更なし、既存 IroncladBaseMaterials は単一 pattern のままで、STEP3 でループ毎に差し替える。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## CP2: プロンプト注入

### Task 3: `buildFinalImagePrompt` に visualStyleHint + コピー固定ルールを追加

**Files:**
- Modify: `src/lib/prompts/ironclad-banner.ts:458-509` (`buildFinalImagePrompt`)

- [ ] **Step 1: 既存関数の構造を確認**

Run: `grep -n "buildFinalImagePrompt\|## 出力" src/lib/prompts/ironclad-banner.ts`

- [ ] **Step 2: import を追加**

`src/lib/prompts/ironclad-banner.ts` 冒頭の import 群に追加:

```ts
import { VISUAL_STYLE_HINTS } from './visual-style-hints';
```

- [ ] **Step 3: `buildFinalImagePrompt` の末尾出力ブロックを編集**

`src/lib/prompts/ironclad-banner.ts:502-506` の最後の `lines.push('', '## 出力', ...)` を以下のように差し替える。

変更前:
```ts
  lines.push(
    '',
    '## 出力',
    `${sizeCfg.aspectRatio} の広告バナー画像を1枚生成`,
  );

  return lines.join('\n');
}
```

変更後:
```ts
  lines.push(
    '',
    '## 🎨 ビジュアルスタイル指示（必ず厳守）',
    `この広告は「${m.pattern}」スタイル。下記の視覚指示に従って描画すること。`,
    '',
    VISUAL_STYLE_HINTS[m.pattern],
    '',
    '## ⚠️ コピー固定の絶対ルール',
    '上記「## コピー」セクションに記載されたコピー以外の文言を絶対に追加しないこと。',
    '禁止される追加要素の例: 「実感の声、多数」「90 Capsules」「monitor satisfaction」「自社調べ」など',
    'コピー文言は一字一句、上記指定の通りに描画する。',
    '',
    '## 出力',
    `${sizeCfg.aspectRatio} の広告バナー画像を1枚生成`,
  );

  return lines.join('\n');
}
```

- [ ] **Step 4: TypeScript ビルド + Lint 確認**

Run: `npx tsc --noEmit && npm run lint`
Expected: エラー 0

- [ ] **Step 5: dev サーバーで素早く確認**

Run: `npm run dev`

ブラウザで http://localhost:3000 を開き、ログイン後に STEP1 → STEP2 → STEP3 まで通常通り進める。STEP3 で「プロンプトを見る」をクリックして、プロンプト末尾に「## 🎨 ビジュアルスタイル指示」と「## ⚠️ コピー固定の絶対ルール」が含まれていることを目視確認。

確認後 dev サーバー停止（Ctrl+C）。

- [ ] **Step 6: コミット**

```bash
git add src/lib/prompts/ironclad-banner.ts
git commit -m "feat(prompts): inject VISUAL_STYLE_HINTS + copy-lock rule into image prompt

Phase A.16 multi-style generation の核。
- buildFinalImagePrompt 末尾に pattern 別の visualStyleHint を注入
- 「コピー固定の絶対ルール」を追加し、pre-flight で観測された追加要素混入（実感の声、90 Capsules 等）を防ぐ

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## CP3: STEP1 UI

### Task 4: `IroncladBriefForm` に追加スタイル UI を追加

**Files:**
- Modify: `src/components/ironclad/IroncladBriefForm.tsx:194-220` (パターン選択ブロック直後)

- [ ] **Step 1: 既存パターン選択箇所を確認**

Run: `grep -n "IRONCLAD_PATTERNS\|パターン \*" src/components/ironclad/IroncladBriefForm.tsx`

- [ ] **Step 2: `useSession` import を確認**

Run: `grep -n "useSession\|sessionToCurrentUser" src/components/ironclad/IroncladBriefForm.tsx`

すでに使われているなら追加 import 不要。使われていなければ Step 3 で追加。

- [ ] **Step 3: 必要な import を追加**

`src/components/ironclad/IroncladBriefForm.tsx` 冒頭の import 群に以下を追加（既存にあるものは skip）:

```tsx
import { useSession } from 'next-auth/react';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { UpgradeLockModal } from '@/components/layout/UpgradeLockModal';
import { useState as useStateLocal } from 'react'; // すでに React import 済みなら不要
```

`useState` が既に import されていれば `useStateLocal` ではなく既存の `useState` をそのまま使う。

- [ ] **Step 4: コンポーネント関数の冒頭に user / モーダル state を追加**

`IroncladBriefForm` 関数本体の冒頭（`return` 文より前）に追加:

```tsx
const { data: session } = useSession();
const user = sessionToCurrentUser(session);
const isPaid = user.plan === 'pro' || user.plan === 'starter' || user.plan === 'admin';
const [proLockOpen, setProLockOpen] = useState(false);
const [showAdditional, setShowAdditional] = useState(false);

const MAX_ADDITIONAL = 2;
const additionalPatterns = brief.additionalPatterns ?? [];

const toggleAdditionalPattern = (p: IroncladPattern) => {
  if (additionalPatterns.includes(p)) {
    onChangeBrief({
      ...brief,
      additionalPatterns: additionalPatterns.filter((x) => x !== p),
    });
  } else if (additionalPatterns.length < MAX_ADDITIONAL) {
    onChangeBrief({
      ...brief,
      additionalPatterns: [...additionalPatterns, p],
    });
  }
};
```

- [ ] **Step 5: 既存パターン選択ブロックの直下に追加 UI を挿入**

`IroncladBriefForm.tsx:194-220` の既存「パターン \*」ブロックの `</div>` 終了直後に以下を追加:

```tsx
{/* Phase A.16: 追加スタイル（最大2個） */}
<div className="mb-4">
  <button
    type="button"
    onClick={() => {
      if (!isPaid) {
        setProLockOpen(true);
        return;
      }
      setShowAdditional((v) => !v);
    }}
    className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
  >
    <span>🎨 追加スタイルでも生成する（最大{MAX_ADDITIONAL}個）</span>
    {!isPaid && (
      <span className="px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700 text-[10px]">
        Pro
      </span>
    )}
    <span className="text-slate-500 text-xs">
      {showAdditional ? '▲' : '▼'}
    </span>
  </button>

  {showAdditional && isPaid && (
    <div className="mt-3 p-4 border border-slate-700 rounded-lg bg-slate-900/50">
      <p className="text-xs text-slate-400 mb-2">
        同じコピー・素材で、選んだスタイル分だけ追加生成します。
        <span className="ml-2 text-teal-300">
          選択中: {additionalPatterns.length}/{MAX_ADDITIONAL}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {IRONCLAD_PATTERNS.filter((p) => p !== brief.pattern).map((p) => {
          const checked = additionalPatterns.includes(p);
          const disabled = !checked && additionalPatterns.length >= MAX_ADDITIONAL;
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggleAdditionalPattern(p)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded text-xs border transition ${
                checked
                  ? 'bg-teal-600 text-white border-teal-500'
                  : disabled
                    ? 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {checked ? '✓ ' : ''}
              {p}
            </button>
          );
        })}
      </div>
      {additionalPatterns.length > 0 && (
        <p className="text-[11px] text-amber-300 mt-3">
          ⚠️ 追加スタイルごとに使用回数を消費します（{1 + additionalPatterns.length} スタイル ×{' '}
          {brief.sizes.length} サイズ = {(1 + additionalPatterns.length) * brief.sizes.length} 回消費）
        </p>
      )}
    </div>
  )}
</div>

<UpgradeLockModal
  open={proLockOpen}
  onClose={() => setProLockOpen(false)}
  feature="複数スタイル生成"
  description="複数のスタイルで同時にバナーを生成するには Pro プランへのアップグレードが必要です。"
/>
```

代表 pattern が変更されたとき、追加 pattern に重複があれば自動的に取り除く処理を追加する必要がある。`IroncladBriefForm` の代表 pattern 変更 onClick ハンドラ部分（`onClick={() => onChangeBrief({ ...brief, pattern: p as IroncladPattern })}`）を以下のように修正:

```tsx
onClick={() => {
  const next = p as IroncladPattern;
  onChangeBrief({
    ...brief,
    pattern: next,
    additionalPatterns: (brief.additionalPatterns ?? []).filter((x) => x !== next),
  });
}}
```

- [ ] **Step 6: TypeScript ビルド + Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: エラー 0

`UpgradeLockModal` の props がプロジェクト既存実装と一致しない場合、`src/components/layout/UpgradeLockModal.tsx` を確認して props を調整する（`feature` / `description` 受け取れるか、それとも別 props 名か）。

- [ ] **Step 7: dev で目視確認**

Run: `npm run dev`

http://localhost:3000 を開いて:
1. Free アカウント or admin で「🎨 追加スタイルでも生成する」をクリック → admin 以外なら UpgradeLockModal が出る
2. admin で開くと、代表以外の 5 pattern がチェックボックス表示される
3. 2 個選ぶと 3 個目は disabled になる
4. 代表 pattern を「王道」→「綺麗め」に変えると、追加に「綺麗め」があれば自動的に外れる

確認後 dev 停止。

- [ ] **Step 8: コミット**

```bash
git add src/components/ironclad/IroncladBriefForm.tsx
git commit -m "feat(step1): add additional-pattern selector with Pro lock

Phase A.16: 代表 pattern の下に「🎨 追加スタイルでも生成する（最大2個）」セクション追加。
- Free は UpgradeLockModal で Pro 訴求
- 代表 pattern が変更されたとき、追加 pattern から自動除外
- 選択 N 個で消費回数の事前見積を表示

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## CP4: STEP2 と STEP3

### Task 5: `currentSignature` から pattern を除外

**Files:**
- Modify: `src/app/page.tsx:51`

- [ ] **Step 1: 既存箇所を確認**

Run: `grep -n "currentSignature" src/app/page.tsx`
Expected: line 51 付近

- [ ] **Step 2: 変更**

`src/app/page.tsx:51`:

変更前:
```ts
const currentSignature = `${brief.pattern}|${brief.product}|${brief.target}|${brief.purpose}`;
```

変更後:
```ts
// Phase A.16: pattern は visual-only に再定義したため signature から除外。
// pattern を変更しても STEP2 の suggestions は破棄されない。
const currentSignature = `${brief.product}|${brief.target}|${brief.purpose}`;
```

- [ ] **Step 3: 履歴復元時の signature も同じ形式に**

`src/app/page.tsx:109-111`:

変更前:
```ts
setSuggestionsSignature(
  `${briefSnapshot.pattern}|${briefSnapshot.product}|${briefSnapshot.target}|${briefSnapshot.purpose}`,
);
```

変更後:
```ts
setSuggestionsSignature(
  `${briefSnapshot.product}|${briefSnapshot.target}|${briefSnapshot.purpose}`,
);
```

- [ ] **Step 4: TypeScript ビルド + Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: エラー 0

- [ ] **Step 5: dev で目視確認**

Run: `npm run dev`

1. STEP1 で代表 pattern「王道」+ 商材入力 → STEP2 で suggest 生成 → STEP1 に戻って pattern を「ラグジュアリー」に変更 → STEP2 に進む
2. **期待: suggestions が保持されている（再生成されない）**
3. 商材を変更 → STEP2 に進む → suggestions が再生成される

dev 停止。

- [ ] **Step 6: コミット**

```bash
git add src/app/page.tsx
git commit -m "feat(step2): keep suggestions when only pattern changes

Phase A.16: pattern を visual-only に再定義したため、currentSignature から pattern を除外。
代表 pattern を切り替えても Gemini 生成のコピー候補は保持され、コピー固定で別スタイル生成が可能になる。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `IroncladGenerateScreen` を pattern × size マトリクスに

**Files:**
- Modify: `src/components/ironclad/IroncladGenerateScreen.tsx`

このタスクが本機能のメイン。既存ファイルの大半を書き換える。

- [ ] **Step 1: 現状ファイル全体を読み直す**

Run: `cat src/components/ironclad/IroncladGenerateScreen.tsx | head -340`

既存実装を頭に入れる。重要な箇所:
- `Props.sizes: IroncladSize[]` (既存) は維持、新たに `Props.patterns: IroncladPattern[]` を追加
- `Props.baseMaterials.pattern` は **代表 pattern** として残す（generation API には毎ループ pattern を上書きして渡す）
- `SizeResult` を `PatternSizeResult` に拡張

- [ ] **Step 2: ファイル全体を以下の内容で置換する**

`src/components/ironclad/IroncladGenerateScreen.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { Download, Sparkles, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type {
  IroncladBaseMaterials,
  IroncladMaterials,
  IroncladPattern,
  IroncladSize,
} from '@/lib/prompts/ironclad-banner';
import { GenerationProgress } from '@/components/ui/GenerationProgress';
import { Toast } from '@/components/ui/Toast';
import { sessionToCurrentUser } from '@/lib/auth/session-to-current-user';
import { isUsageLimitReached } from '@/lib/plans/usage-check';
import { UsageLimitModal } from '@/components/layout/UsageLimitModal';
import { PreviewBanner } from '@/components/ironclad/PreviewBanner';

type Props = {
  baseMaterials: IroncladBaseMaterials;
  patterns: IroncladPattern[]; // [代表, ...追加] の順
  sizes: IroncladSize[];
  onBack: () => void;
};

type PatternSizeResult = {
  pattern: IroncladPattern;
  size: IroncladSize;
  status: 'idle' | 'generating' | 'success' | 'error';
  imageUrl?: string;
  promptPreview?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  isPreview?: boolean;
};

export function IroncladGenerateScreen({ baseMaterials, patterns, sizes, onBack }: Props) {
  const { data: session, update: updateSession } = useSession();
  const user = sessionToCurrentUser(session);
  const [usageLimitModalOpen, setUsageLimitModalOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ generationId: string } | null>(null);

  const [results, setResults] = useState<PatternSizeResult[]>(() =>
    patterns.flatMap((pattern) => sizes.map((size) => ({ pattern, size, status: 'idle' as const }))),
  );
  const [overallGenerating, setOverallGenerating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const updateResult = (
    pattern: IroncladPattern,
    size: IroncladSize,
    patch: Partial<PatternSizeResult>,
  ) => {
    setResults((prev) =>
      prev.map((r) => (r.pattern === pattern && r.size === size ? { ...r, ...patch } : r)),
    );
  };

  const generateOne = async (pattern: IroncladPattern, size: IroncladSize): Promise<void> => {
    if (
      user.userId &&
      user.plan === 'starter' &&
      isUsageLimitReached({
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
        usageResetAt: user.usageResetAt,
      })
    ) {
      setUsageLimitModalOpen(true);
      return;
    }

    updateResult(pattern, size, { status: 'generating', errorMessage: undefined });
    // Phase A.16: ループごとに pattern を差し替えて API に渡す
    const materials: IroncladMaterials = { ...baseMaterials, pattern, size };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 320 * 1000);

    try {
      const res = await fetch('/api/ironclad-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materials),
        signal: controller.signal,
      });

      if (res.status === 429) {
        setUsageLimitModalOpen(true);
        updateResult(pattern, size, { status: 'idle' });
        return;
      }

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          errMsg = j?.error || errMsg;
        } catch {
          if (res.status === 504) {
            errMsg = '生成がタイムアウトしました（5分超過）。もう一度お試しください';
          }
        }
        throw new Error(errMsg);
      }

      const json = await res.json();
      updateResult(pattern, size, {
        status: 'success',
        imageUrl: json.imageUrl,
        promptPreview: json.promptPreview,
        metadata: json.metadata,
        isPreview: json.isPreview === true,
      });

      if (typeof json.usageCount === 'number') {
        await updateSession({ usageCount: json.usageCount });
      }

      if (typeof json.generationId === 'string') {
        setToastInfo({ generationId: json.generationId });
      }
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      const errorMessage = isAbort
        ? '生成がタイムアウトしました（5分20秒経過）。もう一度お試しください'
        : e instanceof Error
          ? e.message
          : String(e);
      updateResult(pattern, size, {
        status: 'error',
        errorMessage,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const generateAll = async () => {
    setOverallGenerating(true);
    // 直列: pattern 順 × size 順（API レート制限とコスト管理のため）
    for (const pattern of patterns) {
      for (const size of sizes) {
        await generateOne(pattern, size);
      }
    }
    setOverallGenerating(false);
  };

  const handleDownload = (
    imageUrl: string,
    pattern: IroncladPattern,
    size: IroncladSize,
    isPreview: boolean,
  ) => {
    // Phase A.16: Free は preview 透かし入りを DL ロック
    if (isPreview && user.plan === 'free') {
      setUsageLimitModalOpen(true);
      return;
    }
    const link = document.createElement('a');
    link.href = imageUrl;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (baseMaterials.product || 'banner').replace(
      /[^a-zA-Z0-9ぁ-んァ-ヶ一-龥]/g,
      '_',
    ).slice(0, 30);
    const sizeTag = size.replace(/[^a-zA-Z0-9]/g, '_');
    const patternTag = pattern.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龥]/g, '_');
    link.download = `ironclad_${safeName}_${patternTag}_${sizeTag}_${ts}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const completedCount = results.filter((r) => r.status === 'success').length;
  const totalCount = results.length;
  const anyPromptPreview = results.find((r) => r.promptPreview)?.promptPreview;
  const anyPreview = results.some((r) => r.isPreview === true);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">STEP 3. 完成</h2>
          <p className="text-sm text-slate-400 mt-1">
            選択した {patterns.length} スタイル × {sizes.length} サイズ = {totalCount} 枚を直列生成します。
          </p>
        </div>
        {anyPromptPreview && (
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 rounded text-xs bg-slate-700 hover:bg-slate-600"
          >
            {showPrompt ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPrompt ? 'プロンプトを隠す' : 'プロンプトを見る'}
          </button>
        )}
      </div>

      {anyPreview && <PreviewBanner plan={user.plan} />}

      <MaterialsSummary baseMaterials={baseMaterials} patterns={patterns} sizes={sizes} />

      {showPrompt && anyPromptPreview && (
        <div className="border border-slate-700 rounded-lg p-4 bg-slate-950/50">
          <h3 className="text-xs font-bold text-teal-300 mb-2">鉄板プロンプト（生成済 1 枚目のもの）</h3>
          <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
{anyPromptPreview}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={generateAll}
          disabled={overallGenerating}
          className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 hover:opacity-90 disabled:opacity-40 shadow-xl hover:scale-[1.02] transition-transform"
        >
          <Sparkles className={`w-5 h-5 ${overallGenerating ? 'animate-pulse' : ''}`} />
          {overallGenerating
            ? `生成中… ${completedCount + 1}/${totalCount}`
            : completedCount > 0
              ? `すべて再生成（${totalCount}枚）`
              : `バナー生成開始（${totalCount}枚）`}
        </button>
      </div>

      {patterns.map((pattern) => (
        <PatternSection
          key={pattern}
          pattern={pattern}
          results={results.filter((r) => r.pattern === pattern)}
          overallGenerating={overallGenerating}
          plan={user.plan}
          onRegenerate={(size) => generateOne(pattern, size)}
          onDownload={(url, size, isPreview) => handleDownload(url, pattern, size, isPreview)}
        />
      ))}

      <div className="flex justify-start pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
        >
          ← 素材に戻る
        </button>
      </div>

      <UsageLimitModal
        open={usageLimitModalOpen}
        onClose={() => setUsageLimitModalOpen(false)}
        usageCount={user.usageCount}
        usageLimit={user.usageLimit}
        plan={user.plan}
      />

      {toastInfo && (
        <Toast
          message="履歴に保存しました"
          actionLabel="履歴を見る"
          actionHref={`/history/${toastInfo.generationId}`}
          onClose={() => setToastInfo(null)}
        />
      )}
    </div>
  );
}

function PatternSection({
  pattern,
  results,
  overallGenerating,
  plan,
  onRegenerate,
  onDownload,
}: {
  pattern: IroncladPattern;
  results: PatternSizeResult[];
  overallGenerating: boolean;
  plan: string;
  onRegenerate: (size: IroncladSize) => void;
  onDownload: (url: string, size: IroncladSize, isPreview: boolean) => void;
}) {
  return (
    <section className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
      <h3 className="text-base font-bold text-teal-300 mb-3 flex items-center gap-2">
        <span className="text-xl">🎨</span>
        <span>{pattern}</span>
        <span className="text-xs text-slate-500 ml-2">
          {results.filter((r) => r.status === 'success').length}/{results.length}
        </span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((r) => (
          <div
            key={r.size}
            className="border border-slate-700 rounded-lg p-3 bg-slate-900/50 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200">{r.size}</div>
              <StatusBadge status={r.status} />
            </div>
            <div className="min-h-[14rem] flex items-center justify-center bg-slate-950 rounded overflow-hidden">
              {r.status === 'generating' && (
                <div className="w-full">
                  <GenerationProgress compact estimatedSeconds={45} />
                </div>
              )}
              {r.status === 'error' && (
                <div className="text-red-400 text-xs p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  {r.errorMessage}
                </div>
              )}
              {r.status === 'success' && r.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.imageUrl} alt={`Banner ${pattern} ${r.size}`} className="w-full h-auto" />
              )}
              {r.status === 'idle' && (
                <div className="text-slate-500 text-xs">
                  {overallGenerating ? '待機中…' : '生成ボタンを押してください'}
                </div>
              )}
            </div>
            {r.status === 'success' && r.imageUrl && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onRegenerate(r.size)}
                  className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                >
                  このサイズだけ再生成
                </button>
                <button
                  type="button"
                  onClick={() => onDownload(r.imageUrl!, r.size, r.isPreview === true)}
                  className={`text-[11px] px-2 py-1 rounded text-white font-bold flex items-center gap-1 ${
                    r.isPreview && plan === 'free'
                      ? 'bg-slate-600 hover:bg-slate-500 cursor-pointer'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                  title={r.isPreview && plan === 'free' ? 'Pro でロック解除' : 'ダウンロード'}
                >
                  <Download className="w-3 h-3" />
                  {r.isPreview && plan === 'free' ? 'Pro で DL' : 'DL'}
                </button>
              </div>
            )}
            {r.status === 'error' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onRegenerate(r.size)}
                  className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                >
                  再試行
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: PatternSizeResult['status'] }) {
  const cls =
    status === 'success'
      ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
      : status === 'generating'
        ? 'bg-sky-900/50 text-sky-300 border-sky-700 animate-pulse'
        : status === 'error'
          ? 'bg-red-900/50 text-red-300 border-red-700'
          : 'bg-slate-900/50 text-slate-400 border-slate-700';
  const label =
    status === 'success'
      ? '完了'
      : status === 'generating'
        ? '生成中'
        : status === 'error'
          ? 'エラー'
          : '待機中';
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function MaterialsSummary({
  baseMaterials,
  patterns,
  sizes,
}: {
  baseMaterials: IroncladBaseMaterials;
  patterns: IroncladPattern[];
  sizes: IroncladSize[];
}) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/50 space-y-2 text-xs">
      <h3 className="text-sm font-bold text-teal-300 mb-3">選択した材料</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
        <KV label="スタイル" value={patterns.join(' / ')} />
        <KV label="サイズ" value={sizes.join(', ')} />
        <KV label="商材" value={baseMaterials.product} />
        <KV label="ターゲット" value={baseMaterials.target} />
        <KV label="目的" value={baseMaterials.purpose} />
        <KV label="トーン" value={baseMaterials.tone} />
      </div>
      <div className="pt-2 border-t border-slate-800">
        <div className="text-slate-500 mb-1">コピー</div>
        <ul className="space-y-0.5 text-slate-300">
          {baseMaterials.copies.filter(Boolean).map((c, i) => (
            <li key={i}>・{c}</li>
          ))}
        </ul>
      </div>
      <div className="pt-2 border-t border-slate-800">
        <div className="text-slate-500 mb-1">デザイン要件</div>
        <ul className="space-y-0.5 text-slate-300">
          {baseMaterials.designRequirements.filter(Boolean).map((d, i) => (
            <li key={i}>・{d}</li>
          ))}
        </ul>
      </div>
      <div className="pt-2 border-t border-slate-800">
        <KV label="CTA" value={baseMaterials.cta} />
        {baseMaterials.caution && <KV label="注意" value={baseMaterials.caution} />}
      </div>
      {(baseMaterials.productImageUrl || baseMaterials.badgeImageUrl1 || baseMaterials.badgeImageUrl2) && (
        <div className="pt-2 border-t border-slate-800">
          <div className="text-slate-500 mb-1">添付素材（composite モードで改変禁止）</div>
          <div className="flex flex-wrap gap-2">
            {baseMaterials.productImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={baseMaterials.productImageUrl} alt="product" className="w-16 h-16 object-cover rounded border border-slate-700" />
            )}
            {baseMaterials.badgeImageUrl1 && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={baseMaterials.badgeImageUrl1} alt="badge1" className="w-16 h-16 object-cover rounded border border-slate-700" />
            )}
            {baseMaterials.badgeImageUrl2 && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={baseMaterials.badgeImageUrl2} alt="badge2" className="w-16 h-16 object-cover rounded border border-slate-700" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: 呼出側 `page.tsx` で patterns prop を渡す**

`src/app/page.tsx:222-228` の `<IroncladGenerateScreen ... />` 呼出を修正。

変更前:
```tsx
{step === 3 && baseMaterials && (
  <IroncladGenerateScreen
    baseMaterials={baseMaterials}
    sizes={brief.sizes}
    onBack={() => setStep(2)}
  />
)}
```

変更後:
```tsx
{step === 3 && baseMaterials && (
  <IroncladGenerateScreen
    baseMaterials={baseMaterials}
    patterns={[brief.pattern, ...(brief.additionalPatterns ?? [])]}
    sizes={brief.sizes}
    onBack={() => setStep(2)}
  />
)}
```

- [ ] **Step 4: TypeScript ビルド + Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: エラー 0

- [ ] **Step 5: dev で目視確認**

Run: `npm run dev`

1. admin で代表「王道」+ 追加 [ラグジュアリー] + 1 size でフロー実行
2. STEP3 で「🎨 王道」「🎨 ラグジュアリー」の 2 セクションが縦に並ぶ
3. 「バナー生成開始（2枚）」ボタンで直列生成、王道 → ラグジュアリーの順
4. 完成後、各セクションで個別「このサイズだけ再生成」「DL」ボタンが効く

dev 停止。

- [ ] **Step 6: コミット**

```bash
git add src/components/ironclad/IroncladGenerateScreen.tsx src/app/page.tsx
git commit -m "feat(step3): pattern x size matrix generation with PatternSection UI

Phase A.16 メイン実装。
- IroncladGenerateScreen を pattern × size マトリクス対応に
- 直列生成（pattern 順 × size 順）
- スタイル別セクション表示（PatternSection inline コンポーネント）
- Free 4 枚目以降の DL ボタンを Pro lock（既存 isPreview 流用）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## CP5: Vercel Preview と実機テスト

### Task 7: Preview デプロイ + visualStyleHint 実機検証

- [ ] **Step 1: ブランチを push**

Run:
```bash
git push -u origin HEAD
```
Expected: Vercel が自動で Preview デプロイを作成

- [ ] **Step 2: Preview URL 取得**

Run: `npx vercel ls --token "$(cat ~/.claude/secrets/vercel-token)" | head -3`
または GitHub PR の Vercel コメントから取得

- [ ] **Step 3: T1〜T5（spec §7.1）を Preview 実機で実行**

| ケース | 操作 | 期待 |
|---|---|---|
| T1 | Free で「🎨 追加スタイル」をクリック | UpgradeLockModal が出る |
| T2 | admin で代表「王道」+ 追加 [ラグジュアリー] + Instagram 1 size | 2 セクション × 1 枚 = 2 枚生成、視覚的に明確に違う |
| T3 | admin で代表「王道」+ 追加 [ラグジュアリー, インパクト重視] + Instagram + Stories の 2 size | 3 セクション × 2 枚 = 6 枚直列生成 |
| T4 | STEP1 で「王道」→「ラグジュアリー」に変更 → STEP2 | suggestions が保持される |
| T5 | Free で 1 size × 1 pattern を 4 セッション目 | PREVIEW 透かし焼き込み + DL ボタンが「Pro で DL」表示 |

- [ ] **Step 4: P1〜P4（spec §7.2）visualStyleHint 実機検証**

T2 の 2 枚（王道 vs ラグジュアリー）と T3 の 6 枚（王道 / ラグジュアリー / インパクト重視 × 2 size）を保存し、以下を判定:

| 項目 | 期待 | NG 時の対応 |
|---|---|---|
| P1: 6 pattern が composite mode + visualStyleHint で識別可能 | pre-flight enhanced と同等以上 | NG → `VISUAL_STYLE_HINTS` の薄い pattern を強化（外部ファイル即修正→push） |
| P2: 「ラグジュアリー」「インパクト重視」「ストーリー型」の 3 つは特に強く違う | 配色 / 構図 / 装飾が pre-flight enhanced と同等 | 同上 |
| P3: コピー固定 | 「実感の声」「90 Capsules」等の追加要素混入なし | NG → `buildFinalImagePrompt` のコピー固定ルール文言を強化 |
| P4: reference 画像（5 Point Detox ボトル + GMP + Australian Government）の改変なし | 6 pattern 全てで同じボトル形状・ラベル | NG → `GPT2_PREFIX` の改変禁止ルールを強化 |

P1〜P4 すべて PASS で Task 8 へ。
NG があれば該当ファイルだけ修正 → push → Preview 自動更新 → 再テスト。

- [ ] **Step 5: 検証結果を PR description にメモ**

判定結果（PASS / NG + どのファイルを強化したか）を PR description に書く。

---

### Task 8: PR 作成 + main マージ + tag

- [ ] **Step 1: PR 作成**

Run:
```bash
gh pr create --title "feat: multi-style generation (Phase A.16)" --body "$(cat <<'EOF'
## Summary
- STEP1 で代表 pattern + 追加 pattern 最大 2 個を選択可能（Free は単一固定）
- STEP3 で size × pattern マトリクスを直列生成、スタイル別セクションで表示
- pattern を visual-only に再定義: VISUAL_STYLE_HINTS を画像プロンプトに注入
- 「コピー固定の絶対ルール」追加で追加要素混入を抑止
- pattern 変更で STEP2 suggestions が破棄されないように修正
- Free 4 枚目以降の DL ボタンに Pro lock 追加

## Why
顧客から「同じスクリプトでスタイル違いの比較ができない」要望。
スタイルを変えると STEP2 が巻き戻り、Gemini 生成のコピーや素材選択が消える状態だった。

## Test plan
- [x] T1〜T5 を Vercel Preview で実機確認
- [x] P1〜P4（visualStyleHint 効果検証）PASS
- [x] tsc --noEmit / npm run lint クリーン

Spec: docs/superpowers/specs/2026-05-03-multi-style-generation-design.md
Plan: docs/superpowers/plans/2026-05-03-multi-style-generation.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: PR がグリーン（Vercel build OK）になることを確認**

- [ ] **Step 3: main にマージ**

Run: `gh pr merge --squash --delete-branch`
Expected: 本番デプロイがトリガー

- [ ] **Step 4: tag push**

Run:
```bash
git checkout main
git pull
git tag phase-a16-multi-style-complete
git push origin phase-a16-multi-style-complete
```

- [ ] **Step 5: 本番動作確認**

admin で本番にログインし、代表「王道」+ 追加 [ラグジュアリー] + Instagram 1 size で 2 枚生成。Preview 検証と同じ結果が出ることを確認。

- [ ] **Step 6: メモリ更新（手動）**

memory `project_banner_tsukurukun.md` の Phase 履歴に A.16 の節を追加（必要に応じて Skill で memory 系統を更新）。

---

## 依存関係まとめ

```
Task 1 (VISUAL_STYLE_HINTS) ──┐
                               ├─→ Task 3 (prompt 注入)
Task 2 (型拡張) ───────────────┤
                               ├─→ Task 4 (STEP1 UI)
                               ├─→ Task 5 (signature 修正)
                               └─→ Task 6 (STEP3 マトリクス) ─→ Task 7 (Preview 実機) ─→ Task 8 (merge)
```

---

## ロールバック計画

- DB 変更なし → schema 戻し不要
- `git revert <merge-commit>` 一発で UI / API / プロンプトすべて元に戻る
- `VISUAL_STYLE_HINTS` の hint だけ問題なら、`src/lib/prompts/visual-style-hints.ts` のみ revert で部分巻き戻し可能
- 緊急時は `IroncladBriefForm.tsx` の追加スタイル UI ブロックだけコメントアウトすれば、機能は無効化されつつ既存挙動に戻る（hot-fix 用）
