# Phase A.9: コピースキップ機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** STEP 2 サジェスト選択画面で、サブコピー / ターゲット / 権威バッジ / CTA の4スロットに「使う/使わない」トグルを追加し、OFF時はそのテキストを生成バナーから除外できるようにする。

**Architecture:** Frontend のみの変更（バックエンドは既に空文字を `if (text)` で条件分岐済）。`SuggestField` コンポーネントに `enabled` / `onToggleEnabled` プロップを追加し、親 `IroncladSuggestSelector` で `enabledSlots` state を管理する。OFF 時は選択値を空文字に強制し、候補ボタンと自由入力を disabled 化、フィールド全体を opacity-40 でグレーアウトする。

**Tech Stack:** React 19 / TypeScript / Tailwind CSS / Next.js 16 / lucide-react icons

**Spec:** [docs/superpowers/specs/2026-04-26-copy-skip-feature-design.md](../specs/2026-04-26-copy-skip-feature-design.md)

**Test方針:** プロジェクトはテストフレームワーク未導入。各タスクは「TypeScript ビルド通過 + 手動E2E検証」で確認。最終的に §5 全項目PASS でリリース。

---

## ファイル構成マップ

### 変更（1ファイルのみ）
| ファイル | 役割 |
|---|---|
| `src/components/ironclad/IroncladSuggestSelector.tsx` | `SuggestField` 拡張 + 親に `enabledSlots` state 追加 + `canProceed` ロジック修正 |

### 変更なし（バックエンド既対応）
- `src/lib/image-providers/prompt-helpers.ts` — `if (sub)` `if (cta)` 等で空文字スキップ済
- `src/app/api/ironclad-generate/route.ts` — `copies.length === 4` のみ確認、空文字OK
- `src/components/ironclad/IroncladGenerateScreen.tsx` — copies/cta をそのまま渡すだけ

---

## Task 0: feature ブランチ作成

**目的:** main で直接作業せず、独立ブランチで開発・テスト → マージで本番反映する Phase A.8 と同じフロー。

- [ ] **Step 1: 現在の main 状態を確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
git log --oneline -3
```

期待: working tree clean / 最新コミットが Phase A.8 マージコミット

- [ ] **Step 2: feature ブランチ作成**

```bash
git checkout -b feat/copy-skip
git branch --show-current
```

期待: `feat/copy-skip`

---

## Task 1: spec ドキュメントをブランチにコミット

**目的:** spec はブレスト時点で main に出ていないため、feature ブランチで一緒にコミットしておく。

- [ ] **Step 1: untracked ファイル確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
```

期待: `docs/superpowers/specs/2026-04-26-copy-skip-feature-design.md` が untracked

- [ ] **Step 2: spec と本プランをコミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add docs/superpowers/specs/2026-04-26-copy-skip-feature-design.md docs/superpowers/plans/2026-04-26-copy-skip-feature.md
git commit -m "docs: add Phase A.9 copy skip spec and plan

Brainstormed design + implementation plan for the copy skip toggle
feature. Allows skipping sub copy / target copy / authority badge / CTA
slots from generated banners."
```

---

## Task 2: SuggestField に enabled プロップを追加

**目的:** `SuggestField` を拡張して、ON/OFF 状態を受け取れるようにする。トグル ON のときは既存挙動、OFF のときはグレーアウト+disabled 化。

**File:**
- Modify: `src/components/ironclad/IroncladSuggestSelector.tsx` (function `SuggestField` at line 204-252)

- [ ] **Step 1: SuggestField シグネチャと実装を更新**

`function SuggestField({ ... })` の **全体**を以下に置き換える:

```typescript
function SuggestField({
  label,
  candidates,
  value,
  onChange,
  toggleable = false,
  enabled = true,
  onToggleEnabled,
}: {
  label: string;
  candidates: string[];
  value: string;
  onChange: (v: string) => void;
  /** Phase A.9: トグル表示するか（true: スロット ON/OFF 切替UI表示） */
  toggleable?: boolean;
  /** Phase A.9: スロットが有効か。toggleable=true のときのみ意味を持つ */
  enabled?: boolean;
  /** Phase A.9: トグル変更ハンドラ */
  onToggleEnabled?: (next: boolean) => void;
}) {
  const isDisabled = toggleable && !enabled;

  return (
    <div
      className={`border border-slate-700 rounded-lg p-4 bg-slate-900/50 space-y-3 transition ${
        isDisabled ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-slate-200">{label}</label>
        {toggleable && (
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggleEnabled?.(e.target.checked)}
              className="w-3.5 h-3.5 accent-teal-500"
            />
            このスロットを使う
          </label>
        )}
      </div>

      {isDisabled ? (
        <div className="text-xs text-slate-500 italic py-3 text-center">
          このスロットは生成バナーに含めません
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {candidates.map((c, idx) => {
              const active = value === c;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChange(c)}
                  className={`text-left p-3 rounded border text-sm transition ${
                    active
                      ? 'border-teal-400 bg-teal-950/40 text-white ring-1 ring-teal-400/40'
                      : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 mr-2">[{String.fromCharCode(65 + idx)}]</span>
                  {c}
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">自由入力で上書き（候補を選ばず手入力する場合）</label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="候補にない場合はここに入力"
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
            />
          </div>
        </>
      )}
    </div>
  );
}
```

**変更点まとめ:**
- 新プロップ3つ: `toggleable`（既存呼び出しは省略でOK、デフォルトfalse）、`enabled`、`onToggleEnabled`
- `isDisabled` 算出: `toggleable && !enabled`
- ヘッダ部分が flex で「ラベル + チェックボックス」になる（toggleable=true時のみチェックボックス表示）
- isDisabled なら候補と自由入力エリアを「このスロットは生成バナーに含めません」の文言に置換
- 全体ラッパに `opacity-40` をconditionalで付与

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功（既存呼び出しは toggleable プロップ未指定でデフォルトfalse → 既存挙動と完全同一）

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/components/ironclad/IroncladSuggestSelector.tsx
git commit -m "feat(suggest): add optional toggle to SuggestField

Adds toggleable/enabled/onToggleEnabled props to SuggestField. When
toggleable=true and enabled=false, the field shows a 'このスロットは生成
バナーに含めません' placeholder and grays out (opacity-40). Existing
callers without these props see no behavior change (toggleable defaults
to false)."
```

---

## Task 3: 親に enabledSlots state を追加

**目的:** `IroncladSuggestSelector` の関数本体にスロット有効/無効の state を追加。

**File:**
- Modify: `src/components/ironclad/IroncladSuggestSelector.tsx` (function `IroncladSuggestSelector` 内、useState ブロック)

- [ ] **Step 1: useState 追加**

`const [loading, setLoading] = useState(false);` の **直後**に以下を追加:

```typescript
  // Phase A.9: スロットの ON/OFF（OFF時は空文字で送信され、生成バナーに含まれない）
  // メインコピー(copies[0]) と designRequirements / tone / caution はトグル対象外（必須）
  const [enabledSlots, setEnabledSlots] = useState({
    sub: true,        // copies[1]
    target: true,     // copies[2]
    authority: true,  // copies[3]
    cta: true,
  });
```

- [ ] **Step 2: トグル変更ヘルパーを追加**

`const handleProceed = () => { ... }` の **直前**に以下を追加:

```typescript
  // トグルOFF切替時: そのスロットの選択値を空文字にリセット（OFF→ONでは復元しない）
  const setSlotEnabled = (slot: keyof typeof enabledSlots, enabled: boolean) => {
    setEnabledSlots((prev) => ({ ...prev, [slot]: enabled }));
    if (!enabled) {
      if (slot === 'sub') {
        const next = [...selections.copies] as typeof selections.copies;
        next[1] = '';
        onChangeSelections({ ...selections, copies: next });
      } else if (slot === 'target') {
        const next = [...selections.copies] as typeof selections.copies;
        next[2] = '';
        onChangeSelections({ ...selections, copies: next });
      } else if (slot === 'authority') {
        const next = [...selections.copies] as typeof selections.copies;
        next[3] = '';
        onChangeSelections({ ...selections, copies: next });
      } else if (slot === 'cta') {
        onChangeSelections({ ...selections, cta: '' });
      }
    }
  };
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功

- [ ] **Step 4: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/components/ironclad/IroncladSuggestSelector.tsx
git commit -m "feat(suggest): add enabledSlots state to selector

State manages 4 toggles (sub/target/authority/cta). setSlotEnabled
resets the slot value to empty string when toggled off. OFF→ON does
not restore the previous value (user must reselect)."
```

---

## Task 4: SuggestField 呼び出しに enabled を渡す

**目的:** copies[1〜3] と CTA の `<SuggestField />` 呼び出しに toggleable / enabled / onToggleEnabled を渡す。copies[0] とトーン / 注意事項 / デザイン要件はそのまま（トグル対象外）。

**File:**
- Modify: `src/components/ironclad/IroncladSuggestSelector.tsx` (line 132-179 付近の各 SuggestField)

- [ ] **Step 1: copies の map ループを置き換え**

既存:
```typescript
          {[0, 1, 2, 3].map((i) => (
            <SuggestField
              key={`copy-${i}`}
              label={`コピー${i + 1}${i === 0 ? '（メイン）' : i === 1 ? '（サブ）' : i === 2 ? '（ターゲット/価格訴求）' : '（権威/ダメ押し）'}`}
              candidates={suggestions.copies[i]}
              value={selections.copies[i]}
              onChange={(v) => {
                const next = [...selections.copies] as typeof selections.copies;
                next[i] = v;
                onChangeSelections({ ...selections, copies: next });
              }}
            />
          ))}
```

を以下に置き換える:

```typescript
          {[0, 1, 2, 3].map((i) => {
            const slotKey: 'sub' | 'target' | 'authority' | null =
              i === 1 ? 'sub' : i === 2 ? 'target' : i === 3 ? 'authority' : null;
            const toggleable = slotKey !== null;
            const enabled = slotKey ? enabledSlots[slotKey] : true;
            return (
              <SuggestField
                key={`copy-${i}`}
                label={`コピー${i + 1}${i === 0 ? '（メイン）' : i === 1 ? '（サブ）' : i === 2 ? '（ターゲット/価格訴求）' : '（権威/ダメ押し）'}`}
                candidates={suggestions.copies[i]}
                value={selections.copies[i]}
                onChange={(v) => {
                  const next = [...selections.copies] as typeof selections.copies;
                  next[i] = v;
                  onChangeSelections({ ...selections, copies: next });
                }}
                toggleable={toggleable}
                enabled={enabled}
                onToggleEnabled={slotKey ? (e) => setSlotEnabled(slotKey, e) : undefined}
              />
            );
          })}
```

- [ ] **Step 2: CTA の SuggestField 呼び出しを置き換え**

既存:
```typescript
          <SuggestField
            label="CTA"
            candidates={suggestions.ctas}
            value={selections.cta}
            onChange={(v) => onChangeSelections({ ...selections, cta: v })}
          />
```

を以下に置き換える:

```typescript
          <SuggestField
            label="CTA"
            candidates={suggestions.ctas}
            value={selections.cta}
            onChange={(v) => onChangeSelections({ ...selections, cta: v })}
            toggleable={true}
            enabled={enabledSlots.cta}
            onToggleEnabled={(e) => setSlotEnabled('cta', e)}
          />
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功

- [ ] **Step 4: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/components/ironclad/IroncladSuggestSelector.tsx
git commit -m "feat(suggest): wire toggle UI to copy/CTA SuggestFields

Copy 2/3/4 + CTA now show the 'このスロットを使う' toggle. Main copy
(copies[0]) stays toggleable=false (always required). designRequirements,
tone, caution unchanged."
```

---

## Task 5: canProceed ロジックを修正

**目的:** ON 状態のスロットだけを必須化する。OFF スロットの空文字は許容。

**File:**
- Modify: `src/components/ironclad/IroncladSuggestSelector.tsx` (line 73-78 付近の `canProceed`)

- [ ] **Step 1: canProceed を再定義**

既存:
```typescript
  const canProceed = Boolean(
    selections.copies[0] &&
      selections.designRequirements[0] &&
      selections.cta &&
      selections.tone,
  );
```

を以下に置き換える:

```typescript
  // Phase A.9: ON スロットのみ必須化
  // メインコピー(copies[0]) と designRequirements[0] と tone は常に必須
  // CTA は enabledSlots.cta=true のときのみ必須
  // copies[1〜3] は対応するトグルがONのときのみ必須
  const canProceed = Boolean(
    selections.copies[0] &&
      selections.designRequirements[0] &&
      selections.tone &&
      (!enabledSlots.cta || selections.cta) &&
      (!enabledSlots.sub || selections.copies[1]) &&
      (!enabledSlots.target || selections.copies[2]) &&
      (!enabledSlots.authority || selections.copies[3]),
  );
```

**ロジック:** `(トグルOFF || 値あり)` で「トグルONかつ値なし」のみ false に。

- [ ] **Step 2: TypeScript ビルド確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git add src/components/ironclad/IroncladSuggestSelector.tsx
git commit -m "feat(suggest): make canProceed respect skip toggles

Slots toggled OFF no longer block the 'next' button — empty values
are allowed when the user explicitly opted out. Slots toggled ON
remain required (existing behavior preserved when all toggles are ON,
which is the default)."
```

---

## Task 6: ローカル動作確認

**目的:** 実装後、開発サーバで全シナリオを手動確認。

- [ ] **Step 1: 開発サーバ起動**

別ターミナル（PowerShell）で:
```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run dev
```

ブラウザで `http://localhost:3000/` を開く（Basic Auth: koike/banner2026）。

- [ ] **Step 2: テスト#1 デフォルト動作（全ON）**

1. STEP 1 でブリーフ入力 → 「次へ」
2. STEP 2 で各 4 コピー候補を選択（全ON状態のまま）
3. デザイン要件・CTA・トーン・注意事項も選択
4. 「次へ（生成画面）」が有効化される
5. STEP 3 で生成 → Phase A.8 と同じ4つのテキスト全て描画されたバナー出力

期待: トグルが「コピー2/3/4 と CTA」だけに表示され、すべて ☑ 状態。生成バナーに4テキスト + CTA すべて入る。

- [ ] **Step 3: テスト#2 CTA だけ OFF**

1. STEP 2 で CTA トグルを OFF
2. CTA フィールドがグレーアウト「このスロットは生成バナーに含めません」表示
3. メインコピー / サブ / ターゲット / 権威 / デザイン要件 / トーンは選択済
4. 「次へ」ボタン有効化される（CTA未入力でも通る）
5. STEP 3 生成 → 生成バナーに **CTAボタンが描画されない** ことを確認

期待: バナー下部の CTA ボタン領域がない、または背景のみ

- [ ] **Step 4: テスト#3 権威バッジだけ OFF**

1. STEP 2 で コピー4（権威/ダメ押し）トグルを OFF
2. 生成 → 生成バナーに**右上の権威バッジ（GOLD circle）が描画されない**ことを確認

- [ ] **Step 5: テスト#4 サブ + ターゲット + 権威 + CTA すべて OFF**

1. STEP 2 で 4 つのトグル全て OFF
2. メインコピー + デザイン要件 + トーンのみで「次へ」有効
3. STEP 3 生成 → メインコピーだけのミニマルバナー出力

期待: ほぼ画像 + メインコピー1行 のみのシンプルなバナー

- [ ] **Step 6: テスト#5 トグル OFF→ON 動作**

1. CTA を一度 OFF にする → グレーアウト
2. CTA を再度 ON にする
3. CTA フィールドが復活、候補ボタンが選択可能に
4. 値は**空のまま**（前回選択値は復元されない）
5. 候補から1つ選択 or 自由入力 → 「次へ」有効

- [ ] **Step 7: テスト#6 既存 Phase A.8 機能との両立**

1. STEP 1 で勝ちバナー参照ON
2. STEP 2 で CTA だけ OFF
3. 生成 → 勝ちパターン傾向は反映されるが CTA は描画されない

期待: 字数制限と勝ちパターン反映は維持、CTAだけ消える

- [ ] **Step 8: 結果報告**

全6項目 PASS なら次のタスクへ。NG があれば該当 Task に戻って修正。

---

## Task 7: 本番デプロイ

**目的:** feature ブランチを GitHub に push → preview 確認 → main マージ → 本番反映。

- [ ] **Step 1: ブランチを GitHub に push**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git push -u origin feat/copy-skip
```

期待: push 成功、Vercel が自動でプレビュー deploy 開始

- [ ] **Step 2: プレビュー URL 取得**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx vercel ls 2>/dev/null | head -5
```

最新（Age が小さい方）の Preview 環境 URL をブラウザで開いて Task 6 の主要シナリオ（デフォルト動作 + CTA OFF + 全OFF）を確認。

- [ ] **Step 3: main にマージ**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git checkout main
git pull origin main
git merge --no-ff feat/copy-skip -m "Merge: Phase A.9 copy skip feature

Adds optional toggle to skip sub copy / target copy / authority badge
/ CTA from generated banners. Main copy stays required.

Backend unchanged: buildBakeTextInstruction already handles empty
strings via 'if (text)' conditionals. Only IroncladSuggestSelector
modified.

Rollback: turn all toggles ON in UI = byte-identical to Phase A.8
behavior. No env var or DB migration needed."
```

- [ ] **Step 4: main を push（本番反映トリガ）**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git push origin main
```

期待: Vercel が本番 deploy 自動開始（約30秒で完了）

- [ ] **Step 5: 本番動作確認**

`https://autobanner.jp/` を開いて Task 6 の主要シナリオを再度確認:
- 全ONで既存挙動と同じバナー生成
- CTA OFF で CTAボタンなしバナー生成

期待: ローカル / プレビューと同じ挙動

---

## Task 8: メモリ更新

**目的:** Phase A.9 完了をプロジェクトメモリに記録。

**File:**
- Modify: `C:/Users/strkk/.claude/projects/C--Users-strkk--claude/memory/project_banner_tsukurukun.md`

- [ ] **Step 1: Phase 履歴セクションに A.9 追加**

`## Phase 履歴` セクションの末尾、Phase A.8 のエントリの後に以下を追加:

```markdown
- **Phase A.9 完了（2026-04-26）** - コピースキップ機能 / branch `feat/copy-skip`
  - STEP 2 サジェスト選択画面で「☑ このスロットを使う」トグル追加（コピー2/3/4 + CTA の4スロット）
  - OFF時はそのテキストが生成バナーに含まれない（フィールドはグレーアウト）
  - メインコピー(copies[0]) と デザイン要件 / トーン / 注意事項はスキップ不可
  - バックエンド変更ゼロ（`buildBakeTextInstruction` の `if (text)` で既に空文字スキップ実装済）
  - 全ON状態は Phase A.8 と完全同一の挙動
  - 影響範囲: `IroncladSuggestSelector.tsx` 1ファイルのみ
```

- [ ] **Step 2: 「次候補」セクションから A.9 を削除**

「次候補」リストの「Phase A.9 候補: 生成サジェストの「このコピーは使わない」スキップ機能」行を削除。

- [ ] **Step 3: 設計ドキュメントセクションに A.9 を追加**

`## 設計ドキュメント` セクションに以下を追加:

```markdown
- Phase A.9 Spec: `docs/superpowers/specs/2026-04-26-copy-skip-feature-design.md`
- Phase A.9 Plan: `docs/superpowers/plans/2026-04-26-copy-skip-feature.md`
```

---

## Self-Review

**1. Spec coverage:**
- §1 背景・目的 → Task 2-5 で UI/state/canProceed を実装
- §2 設計判断 → Task 2 で SuggestField の toggleable=false がデフォルト（既存呼び出し互換性）
- §3 機能要件のスコープ → Task 4 で copies[1-3] と CTA のみトグル化、メインコピーは toggleable=false
- §4 UI 設計 → Task 2 で Pattern B（トグル + グレーアウト）実装
- §5 データモデル → Task 3 で `enabledSlots` state、Task 3 で OFF時に空文字リセット
- §6 実装変更ファイル → 1ファイル（IroncladSuggestSelector.tsx）のみ
- §7 エッジケース → Task 3 で OFF→ON 復元しない、Task 5 で空文字許容、Task 6 で全OFFテスト
- §8 ロールバック → Task 7 のマージで完了、L1（全ON）は手動操作で達成
- §9 テスト戦略 → Task 6 の6項目で全カバー
- §10 完了の定義 → Task 7 本番動作確認 + Task 8 メモリ更新

**2. Placeholder scan:** "TBD" / "TODO" / "implement later" / "適切に" — なし。全コードは完全提示。

**3. Type consistency:**
- `EnabledSlots` 型は Task 3 で型推論ベース（明示型なし）。`keyof typeof enabledSlots` で `'sub' | 'target' | 'authority' | 'cta'` ユニオン型として参照。
- `slotKey` 型注釈 (Task 4) は `'sub' | 'target' | 'authority' | null` で `keyof typeof enabledSlots | null` のサブセット → 整合性OK
- `setSlotEnabled` シグネチャ (Task 3) と Task 4 の呼び出しが一致

OK, 整合済。

---

## 完了の定義

以下が全て満たされたら本プランを「完了」とみなす:
- Task 0〜8 すべて完了
- Task 6 全6項目PASS
- Task 7 本番動作確認PASS
- メモリファイルに Phase A.9 完了記録
