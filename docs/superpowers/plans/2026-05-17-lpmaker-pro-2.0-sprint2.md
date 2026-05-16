# LP Maker Pro 2.0 — Sprint 2 Implementation Plan (D6〜D10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sprint 1 で完成した「Brief → AI 生成 → DB 保存」の上に、**編集 UI / ブロック単位 AI 再生成 / 公開フロー / SSR 公開ページ** を実装し、エンドツーエンドで「Brief → 編集 → 公開 → 一般ユーザーが URL で閲覧」できる状態にする。

**Architecture:**
- LP-maker 専用 section components を `src/components/lp-maker/sections/` に**新規 11 個作成**（既存 `src/components/lp/*` は autobanner.jp 専用にハードコードされているため流用不可。デザインのみ inspiration として参照）
- Edit 画面は 3-pane layout（左: section list / 中央: preview / 右: props editor）、auto-save パターン
- 「もう一案」は Gemini を 3 並列起動 + 高 temperature で variation 生成
- 公開フローは `lpmaker-pro.com/site/[user]/[slug]` の Edge-cached SSR、OGP 画像は sharp で自動生成
- アナリティクス注入は GTM/GA4/Clarity/Pixel ID を public LP に afterInteractive で挿入

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Prisma 7 / `@google/genai` (Gemini 2.5 Pro) / sharp (OGP 生成) / Vercel Blob

**Spec:** [docs/superpowers/specs/2026-05-16-lpmaker-pro-2.0-design.md](../specs/2026-05-16-lpmaker-pro-2.0-design.md)

**Sprint 1 Spec/Code 訂正:** Sprint 1 spec §3.2 / §5.1 / 既存 11 LP コンポーネント資産活用」と記載していたが、検証の結果 `src/components/lp/*` は autobanner.jp 専用 props を持ち流用不可。Sprint 2 で **LP-maker 専用 section components を新規作成**（同じ Tailwind トーン: slate-950 base / emerald-500 accent）。spec も Sprint 2 完了後に更新する。

**Test方針:** Sprint 1 と同じく、`npm run build` + ローカル `npm run dev` + Prisma Studio による smoke test。テストフレーム未導入。

**前提:**
- Sprint 1 完了（HEAD: `eeb36b2`、C-1/C-2 fix 済）
- feature branch `feat/lpmaker-pro-2-sprint1` 上で継続。Sprint 2 完了後に `feat/lpmaker-pro-2-sprint2` へリネーム or 同 branch で push
- dev DB 生存（Sprint 1 で確認済）
- `lpmaker-pro.com` 接続は **Sprint 3 D15 直前まで実行しない**（Pre-Sprint タスクは Sprint 3 で execute）
- 暫定 admin gate (`/api/lp/generate`) が動いており、Free/Starter ユーザーは Sprint 3 D11 まで API ブロックされる

---

## ファイル構成マップ

### Sprint 2 で作成（新規 26 ファイル）

**Day 6 / Edit 画面骨格 + 11 section preview:**

| ファイル | 役割 |
|---|---|
| `src/app/lp-maker/[id]/edit/page.tsx` | server component、LP fetch + 認証 |
| `src/app/lp-maker/[id]/edit/EditClient.tsx` | client component、3-pane layout state |
| `src/components/lp-maker/sections/HeroPreview.tsx` | hero section render |
| `src/components/lp-maker/sections/ProblemPreview.tsx` | problem section render |
| `src/components/lp-maker/sections/SolutionPreview.tsx` | solution section render |
| `src/components/lp-maker/sections/FeaturesPreview.tsx` | features section render |
| `src/components/lp-maker/sections/NumericProofPreview.tsx` | numeric_proof section render |
| `src/components/lp-maker/sections/ComparisonPreview.tsx` | comparison section render |
| `src/components/lp-maker/sections/VoicePreview.tsx` | voice section render |
| `src/components/lp-maker/sections/PricingPreview.tsx` | pricing section render |
| `src/components/lp-maker/sections/FaqPreview.tsx` | faq section render |
| `src/components/lp-maker/sections/InlineCtaPreview.tsx` | inline_cta section render |
| `src/components/lp-maker/sections/FinalCtaPreview.tsx` | final_cta section render |
| `src/components/lp-maker/SectionRenderer.tsx` | type-dispatch (switch) で各 preview に分岐 |

**Day 7 / 編集 UI + auto-save:**

| ファイル | 役割 |
|---|---|
| `src/components/lp-maker/SectionListPane.tsx` | 左ペイン: ON/OFF + D&D 並べ替え |
| `src/components/lp-maker/SectionPropsEditor.tsx` | 右ペイン: 選択 section の props 編集フォーム |
| `src/app/api/lp/[id]/route.ts` | PATCH endpoint (sections / title 更新) |
| `src/lib/lp/use-auto-save.ts` | client hook、debounced PATCH |

**Day 8 / もう一案 AI 再生成:**

| ファイル | 役割 |
|---|---|
| `src/app/api/lp/[id]/section/[type]/regenerate/route.ts` | POST endpoint、3 案返却 |
| `src/lib/lp/copy-variants.ts` | Gemini 3 並列起動で variations 生成 |
| `src/components/lp-maker/RegenerateModal.tsx` | 3 案表示 + Diff highlight + 採用ボタン |

**Day 9 / 公開フロー:**

| ファイル | 役割 |
|---|---|
| `src/app/api/lp/[id]/publish/route.ts` | POST endpoint、status='published' + OGP 生成 |
| `src/lib/lp/publish.ts` | publish オーケストレータ (slug validate + OGP 生成 + DB update) |
| `src/lib/lp/og-generator.ts` | sharp + SVG で OGP 1200x630 PNG 自動生成 |
| `src/components/lp-maker/PublishModal.tsx` | slug 編集 + GTM/GA4/Clarity/Pixel ID 入力 + 公開ボタン |

**Day 10 / 公開 LP SSR:**

| ファイル | 役割 |
|---|---|
| `src/app/site/[user]/[slug]/page.tsx` | server component、SSR 公開ページ (edge-cacheable) |
| `src/components/lp-maker/PublicSectionRenderer.tsx` | 公開用 section renderer (preview と共通化) |
| `src/components/lp-maker/AnalyticsInjector.tsx` | GTM/GA4/Clarity/Pixel `<Script>` 注入 |
| `src/app/site/[user]/[slug]/opengraph-image.tsx` | OGP メタタグ用 |
| `src/app/sitemap.ts` | sitemap.xml 自動生成 (公開 LP 列挙) |

### Sprint 2 で変更

| ファイル | 変更内容 |
|---|---|
| `src/middleware.ts` | `PUBLIC_PATH_PREFIXES` に `/site/` を追加（公開 LP は認証不要） |
| `src/app/lp-maker/page.tsx` | I-1 fix: dashboard を `where: { sections: { not: [] } }` でフィルタ |
| `src/components/lp-maker/BriefWizardStep2.tsx` | I-3 fix: unused props 削除 |
| `src/components/lp-maker/BriefWizardStep3.tsx` | I-2 fix: 「8 セクション」→「7-9 セクション」表記修正 |
| `src/lib/lp/orchestrator.ts` | I-4 fix: title = brief.productName 固定 / I-5 fix: slug にランダムサフィックス追加 |
| `src/lib/lp/copy-prompts.ts` | Minor fix: comparison プロンプトの「商品名」リテラル → ${brief.productName} 補間 |

---

## Task 0: 前提確認

**Files:** なし

- [ ] **Step 1: ブランチ確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git status
git branch --show-current
git log --oneline -3
```

期待: `feat/lpmaker-pro-2-sprint1` ブランチ、HEAD は `eeb36b2` (C-2 fix)。

- [ ] **Step 2: dev DB 接続確認**

```bash
npx prisma db pull --print | head -5
```

期待: schema dump が出る = DB 接続 OK。失敗時は `.env` の `DATABASE_URL` を `PROD_DATABASE_URL` で一時上書き（Sprint 1 で確認済の対処）。

---

## Day 6 — Task 7: Sprint 1 Punch List 一括 fix

**Files:**
- 変更: `src/app/lp-maker/page.tsx` (I-1)
- 変更: `src/components/lp-maker/BriefWizardStep2.tsx` (I-3)
- 変更: `src/components/lp-maker/BriefWizardStep3.tsx` (I-2)
- 変更: `src/lib/lp/orchestrator.ts` (I-4 + I-5)
- 変更: `src/lib/lp/copy-prompts.ts` (Minor)
- 変更: `src/lib/lp/types.ts` (Minor: ogImageUrl を optional に)

- [ ] **Step 1: I-1 dashboard filter**

`src/app/lp-maker/page.tsx` の `findMany` を修正:

```tsx
const landingPages = await prisma.landingPage.findMany({
  where: {
    userId: session.user.id,
    // I-1 fix: orphan/失敗 LP を除外
    NOT: { sections: { equals: [] } },
  },
  orderBy: { updatedAt: 'desc' },
  take: 50,
});
```

- [ ] **Step 2: I-2 STEP3 コピー修正**

`src/components/lp-maker/BriefWizardStep3.tsx` line ~47-50 の文言:

```diff
-          ブリーフから業種・オファー特性を判断し、8 セクションの最適な組合せを自動決定します。
+          ブリーフから業種・オファー特性を判断し、7〜9 セクションの最適な組合せを自動決定します。
```

- [ ] **Step 3: I-3 BriefWizardStep2 unused props 削除**

`src/components/lp-maker/BriefWizardStep2.tsx` の Props interface を変更:

```tsx
interface Props {
  // brief / onChange は Phase 1 不使用。Phase 2 で素材選択 UI 統合時に復活。
  onBack: () => void;
  onNext: () => void;
}

export function BriefWizardStep2({ onBack, onNext }: Props) {
  // (body 変更なし)
}
```

呼び出し側 `src/app/lp-maker/new/page.tsx` の `<BriefWizardStep2>` から `brief` / `onChange` props を削除:

```diff
         {step === 2 && (
           <BriefWizardStep2
-            brief={brief}
-            onChange={setBrief}
             onBack={() => setStep(1)}
             onNext={() => setStep(3)}
           />
         )}
```

- [ ] **Step 4: I-4 title source 修正 + I-5 slug 衝突対策**

`src/lib/lp/orchestrator.ts` を修正:

```diff
   // ステップ 2: 仮の LandingPage を作成（KV 画像 URL を後で update するため）
-  const slug = `lp-${Date.now().toString(36)}`;
+  // I-5 fix: 同一 user 同一 ms の slug 衝突回避にランダムサフィックス
+  const slug = `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
   const lp = await prisma.landingPage.create({
     data: {
       userId: args.userId,
       slug,
       title: args.brief.productName,
       ...
```

```diff
-  const heroProps = finalSections.find((s) => s.type === 'hero')?.props as
-    | { headline?: string }
-    | undefined;
-  const title = heroProps?.headline ?? args.brief.productName;
+  // I-4 fix: title は productName 固定（headline は sections[hero].props.headline に存続）。
+  // 安定した dashboard / sitemap / OGP fallback を保証。
+  const title = args.brief.productName;
```

- [ ] **Step 5: copy-prompts comparison literal fix**

`src/lib/lp/copy-prompts.ts` の comparison 部分:

```diff
     comparison: `
 比較表セクションを生成してください。
 - headline: 30 字以内
 - rowLabels: 比較項目 5 つ（例: 制作時間 / 月額費用 / etc）
-- columns: ["商品名", "従来の方法", "他社サービス"] の 3 列、各 rows は rowLabels と同数
+- columns: ["${brief.productName}", "従来の方法", "他社サービス"] の 3 列、各 rows は rowLabels と同数
 `.trim(),
```

これは `Record<LpSectionType, string>` の static literal なので `brief` 変数にアクセスするには関数化が必要。下記のように `buildUserPromptForSection` を引数増やして対応:

```tsx
export function buildUserPromptForSection(
  sectionType: LpSectionType,
  brief: LpBrief
): string {
  const productNameOrPlaceholder = brief.productName || '本商品';
  const guides: Record<LpSectionType, string> = {
    // ... 他は変更なし
    comparison: `
比較表セクションを生成してください。
- headline: 30 字以内
- rowLabels: 比較項目 5 つ（例: 制作時間 / 月額費用 / etc）
- columns: ["${productNameOrPlaceholder}", "従来の方法", "他社サービス"] の 3 列、各 rows は rowLabels と同数
`.trim(),
    // ...
  };
  return guides[sectionType];
}
```

そして `copy-generator.ts` の呼び出し側を更新:

```diff
-  const userPrompt = buildUserPromptForSection(sectionType);
+  const userPrompt = buildUserPromptForSection(sectionType, brief);
```

- [ ] **Step 6: Minor: ogImageUrl を optional に**

`src/lib/lp/types.ts`:

```diff
 export interface LpGenerationResult {
   landingPageId: string;
   title: string;
   sections: LpSection[];
   kvImageUrl: string;
-  ogImageUrl: string;
+  ogImageUrl?: string;  // D9 で生成、Sprint 1 ではまだ
 }
```

- [ ] **Step 7: Build**

```bash
npm run build
```

期待: pass。

- [ ] **Step 8: Commit**

```bash
git add src/app/lp-maker/page.tsx src/components/lp-maker/BriefWizardStep2.tsx src/components/lp-maker/BriefWizardStep3.tsx src/lib/lp/orchestrator.ts src/lib/lp/copy-prompts.ts src/lib/lp/copy-generator.ts src/lib/lp/types.ts src/app/lp-maker/new/page.tsx
git commit -m "fix(sprint2-punchlist): I-1 dashboard filter + I-2 STEP3 copy + I-3 unused props + I-4 title source + I-5 slug collision + Minor copy-prompts/types"
```

---

## Day 6 — Task 8: 11 個の LP-maker 専用 Section Preview Components

**Files:** `src/components/lp-maker/sections/` 配下 11 ファイル + 1 dispatcher

これらは LP-maker 用 props（HeroProps / ProblemProps 等）を受け取り、Tailwind で slate-950 / emerald-500 トーンで render する。**既存 `src/components/lp/*` のデザイン感を踏襲しつつ、props は完全に独立**。

**重要:** 各コンポーネントは preview / public の両方で使う。`isPublic?: boolean` prop を追加して、preview では「ここをクリックして編集」ヒント表示、public ではクリック禁止。

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p src/components/lp-maker/sections
```

- [ ] **Step 2: HeroPreview**

`src/components/lp-maker/sections/HeroPreview.tsx`:

```tsx
import type { HeroProps } from '@/lib/lp/types';

export function HeroPreview({ props }: { props: HeroProps }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-slate-50">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.20),_transparent_60%)]"
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
            {props.headline}
          </h1>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed">
            {props.subheadline}
          </p>
          <div className="mt-8">
            <button
              type="button"
              className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-4 rounded-lg shadow-lg shadow-emerald-500/20"
            >
              {props.ctaText}
            </button>
          </div>
        </div>
        {props.imageUrl && (
          <div className="relative">
            <img
              src={props.imageUrl}
              alt=""
              className="w-full h-auto rounded-lg shadow-2xl"
            />
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: ProblemPreview**

`src/components/lp-maker/sections/ProblemPreview.tsx`:

```tsx
import type { ProblemProps } from '@/lib/lp/types';

export function ProblemPreview({ props }: { props: ProblemProps }) {
  return (
    <section className="bg-slate-900 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {props.headline}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {props.items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-800 rounded-lg p-6 border border-slate-700"
            >
              <h3 className="text-lg font-bold text-amber-300 mb-3">
                {item.title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: SolutionPreview**

`src/components/lp-maker/sections/SolutionPreview.tsx`:

```tsx
import type { SolutionProps } from '@/lib/lp/types';

export function SolutionPreview({ props }: { props: SolutionProps }) {
  return (
    <section className="bg-slate-950 text-slate-100 py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-6">
          {props.headline}
        </h2>
        <p className="text-lg text-slate-300 leading-relaxed">
          {props.description}
        </p>
        {props.imageUrl && (
          <img
            src={props.imageUrl}
            alt=""
            className="mt-10 mx-auto rounded-lg max-w-2xl"
          />
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: FeaturesPreview**

`src/components/lp-maker/sections/FeaturesPreview.tsx`:

```tsx
import type { FeaturesProps } from '@/lib/lp/types';

export function FeaturesPreview({ props }: { props: FeaturesProps }) {
  return (
    <section className="bg-slate-900 text-slate-100 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {props.headline}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {props.items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-800 rounded-lg p-5 border border-slate-700"
            >
              {item.iconHint && (
                <div className="text-emerald-400 text-2xl mb-3">★</div>
              )}
              <h3 className="font-bold text-emerald-300 mb-2">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: NumericProofPreview**

`src/components/lp-maker/sections/NumericProofPreview.tsx`:

```tsx
import type { NumericProofProps } from '@/lib/lp/types';

export function NumericProofPreview({ props }: { props: NumericProofProps }) {
  return (
    <section className="bg-slate-950 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {props.items.map((item, idx) => (
            <div key={idx}>
              <p className="text-5xl sm:text-6xl font-black text-emerald-400">
                {item.number}
              </p>
              <p className="mt-3 text-sm font-bold text-slate-200">
                {item.label}
              </p>
              {item.note && (
                <p className="mt-1 text-xs text-slate-500">{item.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: ComparisonPreview**

`src/components/lp-maker/sections/ComparisonPreview.tsx`:

```tsx
import type { ComparisonProps } from '@/lib/lp/types';

export function ComparisonPreview({ props }: { props: ComparisonProps }) {
  return (
    <section className="bg-slate-900 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">
          {props.headline}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full bg-slate-800 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-700">
                <th className="text-left text-xs uppercase tracking-wide px-4 py-3 text-slate-400">
                  項目
                </th>
                {props.columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`text-center text-sm font-bold px-4 py-3 ${
                      idx === 0 ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rowLabels.map((label, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-t border-slate-700"
                >
                  <td className="text-sm font-bold text-slate-300 px-4 py-3">
                    {label}
                  </td>
                  {props.columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`text-sm px-4 py-3 text-center ${
                        colIdx === 0
                          ? 'text-emerald-300 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {col.rows[rowIdx]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: VoicePreview**

`src/components/lp-maker/sections/VoicePreview.tsx`:

```tsx
import type { VoiceProps } from '@/lib/lp/types';

export function VoicePreview({ props }: { props: VoiceProps }) {
  return (
    <section className="bg-slate-950 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {props.headline}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {props.items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900 rounded-lg p-5 border border-slate-800"
            >
              <p className="text-sm text-slate-200 leading-relaxed">
                「{item.quote}」
              </p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">{item.author}</p>
                {item.proofBadge && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">
                    {item.proofBadge}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 9: PricingPreview**

`src/components/lp-maker/sections/PricingPreview.tsx`:

```tsx
import type { PricingProps } from '@/lib/lp/types';

export function PricingPreview({ props }: { props: PricingProps }) {
  return (
    <section className="bg-slate-900 text-slate-100 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {props.headline}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {props.plans.map((plan, idx) => (
            <div
              key={idx}
              className={`bg-slate-800 rounded-lg p-6 border ${
                idx === 1
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'border-slate-700'
              }`}
            >
              <h3 className="text-lg font-bold text-emerald-300 mb-2">
                {plan.name}
              </h3>
              <p className="text-3xl font-black mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f, i) => (
                  <li
                    key={i}
                    className="text-xs text-slate-300 flex items-start gap-2"
                  >
                    <span className="text-emerald-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded"
              >
                {plan.ctaText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 10: FaqPreview**

`src/components/lp-maker/sections/FaqPreview.tsx`:

```tsx
import type { FaqProps } from '@/lib/lp/types';

export function FaqPreview({ props }: { props: FaqProps }) {
  return (
    <section className="bg-slate-950 text-slate-100 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">
          {props.headline}
        </h2>
        <div className="space-y-3">
          {props.items.map((item, idx) => (
            <details
              key={idx}
              className="bg-slate-900 rounded-lg p-5 border border-slate-800"
            >
              <summary className="font-bold cursor-pointer text-slate-200">
                Q. {item.question}
              </summary>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 11: InlineCtaPreview**

`src/components/lp-maker/sections/InlineCtaPreview.tsx`:

```tsx
import type { CtaProps } from '@/lib/lp/types';

export function InlineCtaPreview({ props }: { props: CtaProps }) {
  return (
    <section className="bg-emerald-500/10 border-y border-emerald-500/30 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-lg sm:text-xl font-bold text-slate-100 mb-5">
          {props.headline}
        </p>
        <button
          type="button"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-lg"
        >
          {props.buttonText}
        </button>
        {props.note && (
          <p className="mt-3 text-xs text-slate-400">{props.note}</p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 12: FinalCtaPreview**

`src/components/lp-maker/sections/FinalCtaPreview.tsx`:

```tsx
import type { CtaProps } from '@/lib/lp/types';

export function FinalCtaPreview({ props }: { props: CtaProps }) {
  return (
    <section className="bg-gradient-to-br from-emerald-600 to-emerald-700 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-5xl font-black text-slate-950 mb-8">
          {props.headline}
        </h2>
        <button
          type="button"
          className="bg-slate-950 hover:bg-slate-800 text-emerald-400 font-bold text-lg px-10 py-5 rounded-lg shadow-2xl"
        >
          {props.buttonText}
        </button>
        {props.note && (
          <p className="mt-5 text-sm text-slate-950/80 font-bold">
            {props.note}
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 13: SectionRenderer (dispatcher)**

`src/components/lp-maker/SectionRenderer.tsx`:

```tsx
import type { LpSection } from '@/lib/lp/types';
import { HeroPreview } from './sections/HeroPreview';
import { ProblemPreview } from './sections/ProblemPreview';
import { SolutionPreview } from './sections/SolutionPreview';
import { FeaturesPreview } from './sections/FeaturesPreview';
import { NumericProofPreview } from './sections/NumericProofPreview';
import { ComparisonPreview } from './sections/ComparisonPreview';
import { VoicePreview } from './sections/VoicePreview';
import { PricingPreview } from './sections/PricingPreview';
import { FaqPreview } from './sections/FaqPreview';
import { InlineCtaPreview } from './sections/InlineCtaPreview';
import { FinalCtaPreview } from './sections/FinalCtaPreview';
import type {
  HeroProps,
  ProblemProps,
  SolutionProps,
  FeaturesProps,
  NumericProofProps,
  ComparisonProps,
  VoiceProps,
  PricingProps,
  FaqProps,
  CtaProps,
} from '@/lib/lp/types';

export function SectionRenderer({ section }: { section: LpSection }) {
  switch (section.type) {
    case 'hero':
      return <HeroPreview props={section.props as unknown as HeroProps} />;
    case 'problem':
      return <ProblemPreview props={section.props as unknown as ProblemProps} />;
    case 'solution':
      return <SolutionPreview props={section.props as unknown as SolutionProps} />;
    case 'features':
      return <FeaturesPreview props={section.props as unknown as FeaturesProps} />;
    case 'numeric_proof':
      return <NumericProofPreview props={section.props as unknown as NumericProofProps} />;
    case 'comparison':
      return <ComparisonPreview props={section.props as unknown as ComparisonProps} />;
    case 'voice':
      return <VoicePreview props={section.props as unknown as VoiceProps} />;
    case 'pricing':
      return <PricingPreview props={section.props as unknown as PricingProps} />;
    case 'faq':
      return <FaqPreview props={section.props as unknown as FaqProps} />;
    case 'inline_cta':
      return <InlineCtaPreview props={section.props as unknown as CtaProps} />;
    case 'final_cta':
      return <FinalCtaPreview props={section.props as unknown as CtaProps} />;
  }
}
```

- [ ] **Step 14: Build + Commit**

```bash
npm run build
git add src/components/lp-maker/sections/ src/components/lp-maker/SectionRenderer.tsx
git commit -m "feat(D6-T8): add 11 LP-maker section preview components + SectionRenderer dispatcher"
```

---

## Day 6 — Task 9: Edit 画面の skeleton

**Files:**
- 作成: `src/app/lp-maker/[id]/edit/page.tsx`
- 作成: `src/app/lp-maker/[id]/edit/EditClient.tsx`

- [ ] **Step 1: edit/page.tsx (server component)**

```tsx
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { EditClient } from './EditClient';
import type { LpSection } from '@/lib/lp/types';

export const dynamic = 'force-dynamic';

export default async function LpEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/lp-maker/${id}/edit`);

  const prisma = getPrisma();
  const lp = await prisma.landingPage.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!lp) notFound();

  return (
    <EditClient
      lpId={lp.id}
      initialTitle={lp.title}
      initialSections={lp.sections as unknown as LpSection[]}
      initialStatus={lp.status}
      initialSlug={lp.slug}
    />
  );
}
```

- [ ] **Step 2: EditClient.tsx (3-pane layout state)**

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { LpSection } from '@/lib/lp/types';
import { SectionRenderer } from '@/components/lp-maker/SectionRenderer';
import { SectionListPane } from '@/components/lp-maker/SectionListPane';
import { SectionPropsEditor } from '@/components/lp-maker/SectionPropsEditor';

interface Props {
  lpId: string;
  initialTitle: string;
  initialSections: LpSection[];
  initialStatus: string;
  initialSlug: string;
}

export function EditClient({ lpId, initialTitle, initialSections, initialStatus, initialSlug }: Props) {
  const [sections, setSections] = useState<LpSection[]>(initialSections);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [title] = useState(initialTitle);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 grid grid-cols-1 md:grid-cols-[280px_1fr_320px]">
      {/* Left pane: section list */}
      <aside className="border-r border-slate-800 bg-slate-900 p-4 overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-4">
          <Link href="/lp-maker" className="text-xs text-slate-400 hover:text-slate-200">
            ← 一覧
          </Link>
          <h2 className="text-sm font-bold">{title}</h2>
        </div>
        <SectionListPane
          sections={sections}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          onChange={setSections}
          lpId={lpId}
        />
      </aside>

      {/* Center: preview */}
      <main className="overflow-y-auto max-h-screen">
        {sections.filter((s) => s.enabled).map((s) => (
          <SectionRenderer key={s.type} section={s} />
        ))}
      </main>

      {/* Right pane: props editor */}
      <aside className="border-l border-slate-800 bg-slate-900 p-4 overflow-y-auto max-h-screen">
        {selectedIdx !== null && sections[selectedIdx] ? (
          <SectionPropsEditor
            section={sections[selectedIdx]}
            onChange={(next) => {
              const copy = [...sections];
              copy[selectedIdx] = next;
              setSections(copy);
            }}
            lpId={lpId}
          />
        ) : (
          <div className="text-xs text-slate-500 text-center py-8">
            左ペインからセクションを選択して編集
          </div>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: build**

```bash
npm run build
```

build はまだ `SectionListPane` / `SectionPropsEditor` 未実装でエラー（次の Task 10 / 11 で作成）。**この Step では build エラー OK**。**commit は Task 11 完了後**。

- [ ] **Step 4: commit は後回し（Task 11 完了後にまとめる）**

---

## Day 7 — Task 10: SectionListPane（左ペイン）

**Files:**
- 作成: `src/components/lp-maker/SectionListPane.tsx`

- [ ] **Step 1: SectionListPane**

```tsx
'use client';
import type { LpSection } from '@/lib/lp/types';
import { useAutoSave } from '@/lib/lp/use-auto-save';

const SECTION_LABELS: Record<string, string> = {
  hero: 'FV',
  problem: '課題',
  solution: '解決策',
  features: '機能',
  numeric_proof: '数字訴求',
  comparison: '比較',
  voice: 'お客様の声',
  pricing: '料金',
  faq: 'FAQ',
  inline_cta: '中間 CTA',
  final_cta: '最終 CTA',
};

interface Props {
  sections: LpSection[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onChange: (sections: LpSection[]) => void;
  lpId: string;
}

export function SectionListPane({ sections, selectedIdx, onSelect, onChange, lpId }: Props) {
  useAutoSave({ lpId, sections });

  function toggleEnabled(idx: number) {
    const next = [...sections];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    onChange(next);
  }

  function move(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    next.forEach((s, i) => { s.order = i; });
    onChange(next);
  }

  return (
    <ul className="space-y-2">
      {sections.map((s, idx) => (
        <li
          key={`${s.type}-${idx}`}
          className={`rounded p-2 border ${
            selectedIdx === idx
              ? 'bg-slate-800 border-emerald-500/40'
              : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onSelect(idx)}
              className="flex-1 text-left text-sm font-bold text-slate-200"
            >
              {SECTION_LABELS[s.type] ?? s.type}
            </button>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={() => toggleEnabled(idx)}
                className="accent-emerald-500"
              />
              <span className="text-[10px] text-slate-500">ON</span>
            </label>
          </div>
          <div className="flex gap-1 mt-1">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="text-[10px] text-slate-500 hover:text-slate-200 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === sections.length - 1}
              className="text-[10px] text-slate-500 hover:text-slate-200 disabled:opacity-30"
            >
              ↓
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

---

## Day 7 — Task 11: SectionPropsEditor（右ペイン）+ auto-save hook + PATCH API

**Files:**
- 作成: `src/components/lp-maker/SectionPropsEditor.tsx`
- 作成: `src/lib/lp/use-auto-save.ts`
- 作成: `src/app/api/lp/[id]/route.ts`

- [ ] **Step 1: use-auto-save.ts**

```typescript
import { useEffect, useRef } from 'react';
import type { LpSection } from './types';

interface Args {
  lpId: string;
  sections: LpSection[];
}

/**
 * sections / title 変更を debounced で /api/lp/[id] に PATCH 保存。
 * 1.5 秒間変更がなかったら送信。
 */
export function useAutoSave({ lpId, sections }: Args) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>('');

  useEffect(() => {
    const payload = JSON.stringify({ sections });
    if (payload === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lp/${lpId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: payload,
        });
        if (res.ok) {
          lastSaved.current = payload;
        }
      } catch (e) {
        console.error('[auto-save] failed', e);
      }
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [lpId, sections]);
}
```

- [ ] **Step 2: /api/lp/[id]/route.ts PATCH endpoint**

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { LP_SECTION_TYPES } from '@/lib/lp/types';

export const runtime = 'nodejs';

const LpSectionUpdateSchema = z.object({
  type: z.enum(LP_SECTION_TYPES),
  order: z.number().int().min(0),
  enabled: z.boolean(),
  props: z.record(z.string(), z.unknown()),
});

const PatchBodySchema = z.object({
  sections: z.array(LpSectionUpdateSchema).optional(),
  title: z.string().min(1).max(200).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const prisma = getPrisma();

  // 所有権チェック
  const existing = await prisma.landingPage.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.landingPage.update({
    where: { id },
    data: {
      ...(parsed.data.sections !== undefined && { sections: parsed.data.sections as unknown as object }),
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: SectionPropsEditor.tsx**

```tsx
'use client';
import type { LpSection } from '@/lib/lp/types';

interface Props {
  section: LpSection;
  onChange: (next: LpSection) => void;
  lpId: string;
}

/**
 * セクション内の文字列フィールドを再帰的に編集できる汎用エディタ。
 * 配列内のオブジェクトもネストして表示。
 */
export function SectionPropsEditor({ section, onChange }: Props) {
  function updateField(path: string[], value: unknown) {
    const next = structuredClone(section);
    let cursor: Record<string, unknown> | unknown[] = next.props as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = (cursor as Record<string, unknown>)[path[i]] as Record<string, unknown> | unknown[];
    }
    (cursor as Record<string, unknown>)[path[path.length - 1]] = value;
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-200 mb-3">
          {section.type} 編集
        </h3>
      </div>
      <FieldsRenderer
        node={section.props}
        path={[]}
        onUpdate={updateField}
      />
    </div>
  );
}

function FieldsRenderer({
  node,
  path,
  onUpdate,
}: {
  node: unknown;
  path: string[];
  onUpdate: (path: string[], value: unknown) => void;
}) {
  if (typeof node === 'string') {
    return (
      <textarea
        defaultValue={node}
        onChange={(e) => onUpdate(path, e.target.value)}
        rows={Math.min(8, Math.max(1, node.length / 40))}
        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-100"
      />
    );
  }
  if (Array.isArray(node)) {
    return (
      <div className="space-y-3 pl-2 border-l border-slate-700">
        {node.map((item, idx) => (
          <div key={idx}>
            <p className="text-[10px] text-slate-500 mb-1">item {idx + 1}</p>
            <FieldsRenderer
              node={item}
              path={[...path, String(idx)]}
              onUpdate={onUpdate}
            />
          </div>
        ))}
      </div>
    );
  }
  if (node && typeof node === 'object') {
    return (
      <div className="space-y-3">
        {Object.entries(node).map(([key, value]) => (
          <div key={key}>
            <label className="block text-[10px] text-slate-400 mb-1">{key}</label>
            <FieldsRenderer
              node={value}
              path={[...path, key]}
              onUpdate={onUpdate}
            />
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-xs text-slate-500">(unsupported)</p>;
}
```

- [ ] **Step 4: Build**

```bash
npm run build
```

期待: pass (Task 9 の EditClient 含めて全部解決)。

- [ ] **Step 5: Commit (Task 9 + 10 + 11 まとめ)**

```bash
git add src/app/lp-maker/\[id\]/ src/components/lp-maker/SectionListPane.tsx src/components/lp-maker/SectionPropsEditor.tsx src/lib/lp/use-auto-save.ts src/app/api/lp/\[id\]/
git commit -m "feat(D7-T9-11): add /lp-maker/[id]/edit 3-pane edit UI + PATCH API + auto-save hook"
```

---

## Day 8 — Task 12: 「もう一案」AI 再生成

**Files:**
- 作成: `src/lib/lp/copy-variants.ts`
- 作成: `src/app/api/lp/[id]/section/[type]/regenerate/route.ts`
- 作成: `src/components/lp-maker/RegenerateModal.tsx`

- [ ] **Step 1: copy-variants.ts**

```typescript
import type { LpBrief, LpSectionType } from './types';
import { generateSectionCopy } from './copy-generator';

/**
 * 1 セクションの「もう一案」を 3 並列で生成。
 *
 * generateSectionCopy 内部の Gemini 呼び出しは同じプロンプトだが、
 * Gemini 2.5 Pro は同一プロンプトでも sampling で異なる出力を返すため、
 * 3 回並列で投げれば 3 種の案を得られる。
 *
 * 失敗時は部分結果でも返す（最低 1 案あれば OK）。
 */
export async function generateSectionVariants(
  brief: LpBrief,
  sectionType: LpSectionType
): Promise<Record<string, unknown>[]> {
  const results = await Promise.allSettled([
    generateSectionCopy(brief, sectionType),
    generateSectionCopy(brief, sectionType),
    generateSectionCopy(brief, sectionType),
  ]);

  const variants = results
    .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (variants.length === 0) {
    throw new Error('all 3 variants failed');
  }
  return variants;
}
```

- [ ] **Step 2: regenerate API route**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { LP_SECTION_TYPES, type LpBrief, type LpSectionType } from '@/lib/lp/types';
import { generateSectionVariants } from '@/lib/lp/copy-variants';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, type } = await params;

  if (!LP_SECTION_TYPES.includes(type as LpSectionType)) {
    return NextResponse.json({ error: 'Invalid section type' }, { status: 400 });
  }

  const prisma = getPrisma();

  // admin gate (C-2 と同じ理由、Sprint 3 で plan-based に置換)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  if (user?.plan !== 'admin') {
    return NextResponse.json({ error: 'Admin only until Sprint 3', adminOnly: true }, { status: 403 });
  }

  const lp = await prisma.landingPage.findFirst({
    where: { id, userId: session.user.id },
    select: { brief: true },
  });
  if (!lp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const variants = await generateSectionVariants(
      lp.brief as unknown as LpBrief,
      type as LpSectionType
    );

    // 履歴 (LandingPageGeneration) に各案を保存
    await prisma.landingPageGeneration.createMany({
      data: variants.map((v) => ({
        landingPageId: id,
        sectionType: type,
        prompt: JSON.stringify({ regenerate: true, sectionType: type }),
        output: v as unknown as object,
      })),
    });

    return NextResponse.json({ variants });
  } catch (err) {
    console.error('[/api/lp/[id]/section/[type]/regenerate] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: RegenerateModal.tsx**

```tsx
'use client';
import { useState } from 'react';
import type { LpSection } from '@/lib/lp/types';
import { SectionRenderer } from './SectionRenderer';

interface Props {
  lpId: string;
  section: LpSection;
  onAdopt: (newProps: Record<string, unknown>) => void;
  onClose: () => void;
}

export function RegenerateModal({ lpId, section, onAdopt, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchVariants() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lp/${lpId}/section/${section.type}/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { variants } = await res.json();
      setVariants(variants);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-100">
            「{section.type}」のもう一案
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {variants.length === 0 && !loading && (
          <div className="text-center py-10">
            <button
              type="button"
              onClick={fetchVariants}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded"
            >
              ✨ 3 案を生成（約 30-60 秒）
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-10 text-slate-400">
            生成中…
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded p-3 text-sm text-red-300 my-4">
            {error}
          </div>
        )}

        {variants.length > 0 && (
          <div className="space-y-6">
            {variants.map((v, idx) => (
              <div
                key={idx}
                className="border border-slate-800 rounded-lg overflow-hidden"
              >
                <div className="bg-slate-800 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-slate-300">案 {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onAdopt(v);
                      onClose();
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-3 py-1 rounded"
                  >
                    この案を採用
                  </button>
                </div>
                <div className="bg-slate-950">
                  <SectionRenderer section={{ ...section, props: v }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: SectionPropsEditor に「もう一案」ボタン追加**

`src/components/lp-maker/SectionPropsEditor.tsx` の冒頭 `<div className="space-y-4">` の中、`<h3>` の隣に追加:

```tsx
import { useState } from 'react';
import { RegenerateModal } from './RegenerateModal';

// ...component body...
const [showRegenerate, setShowRegenerate] = useState(false);

// JSX 内
<div className="flex items-center justify-between mb-3">
  <h3 className="text-sm font-bold text-slate-200">
    {section.type} 編集
  </h3>
  <button
    type="button"
    onClick={() => setShowRegenerate(true)}
    className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2 py-1 rounded"
  >
    ↻ もう一案
  </button>
</div>

{showRegenerate && (
  <RegenerateModal
    lpId={lpId}
    section={section}
    onAdopt={(newProps) => onChange({ ...section, props: newProps })}
    onClose={() => setShowRegenerate(false)}
  />
)}
```

注: `SectionPropsEditor` の Props に `lpId` は既存。`'use client'` 既に宣言済。

- [ ] **Step 5: Build + Commit**

```bash
npm run build
git add src/lib/lp/copy-variants.ts src/app/api/lp/\[id\]/section/ src/components/lp-maker/RegenerateModal.tsx src/components/lp-maker/SectionPropsEditor.tsx
git commit -m "feat(D8-T12): add block-level regenerate (3 variants) with RegenerateModal + history saving"
```

---

## Day 9 — Task 13: 公開フロー（slug + OGP + Publish API + Modal）

**Files:**
- 作成: `src/lib/lp/og-generator.ts`
- 作成: `src/lib/lp/publish.ts`
- 作成: `src/app/api/lp/[id]/publish/route.ts`
- 作成: `src/components/lp-maker/PublishModal.tsx`

- [ ] **Step 1: og-generator.ts (sharp + SVG)**

```typescript
import sharp from 'sharp';
import { put } from '@vercel/blob';

/**
 * LP の hero headline を使って OGP 1200x630 PNG を生成し Vercel Blob に保存。
 *
 * 既存 scripts/generate-og-image.mjs (Phase A.15) と同じ思想。
 * グラデ背景 + headline テキストオーバーレイ。
 */
export async function generateOgImage(args: {
  landingPageId: string;
  headline: string;
  brandLabel?: string;
}): Promise<{ ogImageUrl: string }> {
  const svg = buildOgSvg(args.headline, args.brandLabel ?? 'LP Maker Pro');

  const png = await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png()
    .toBuffer();

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN missing');

  const blob = await put(
    `lp-maker/${args.landingPageId}/og.png`,
    png,
    { access: 'public', contentType: 'image/png', token }
  );
  return { ogImageUrl: blob.url };
}

function buildOgSvg(headline: string, brand: string): string {
  const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  }[c]!));

  // 30 字で改行を入れる簡易処理
  const lines: string[] = [];
  const text = esc(headline);
  const max = 18;
  for (let i = 0; i < text.length; i += max) {
    lines.push(text.slice(i, i + max));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="600" y="${315 - lines.length * 40}" text-anchor="middle" fill="#10b981" font-size="28" font-weight="bold" font-family="sans-serif">${esc(brand)}</text>
  ${lines.map((ln, i) =>
    `<text x="600" y="${330 + i * 80}" text-anchor="middle" fill="#f8fafc" font-size="64" font-weight="900" font-family="sans-serif">${ln}</text>`
  ).join('\n')}
</svg>`;
}
```

- [ ] **Step 2: publish.ts (オーケストレータ)**

```typescript
import { getPrisma } from '@/lib/prisma';
import type { LpSection } from './types';
import { generateOgImage } from './og-generator';

/**
 * LP を公開状態に遷移させる。
 * - slug の uniqueness 確認（@@unique([userId, slug]) に違反する場合は新 slug を要求）
 * - OGP 画像生成
 * - status='published' に更新、publishedAt セット
 */
export async function publishLandingPage(args: {
  userId: string;
  landingPageId: string;
  desiredSlug?: string;
  analyticsConfig?: Record<string, string>;
}): Promise<{ slug: string; ogImageUrl: string; publishedUrl: string }> {
  const prisma = getPrisma();

  const lp = await prisma.landingPage.findFirst({
    where: { id: args.landingPageId, userId: args.userId },
  });
  if (!lp) throw new Error('LP not found');

  // slug 重複チェック
  const targetSlug = args.desiredSlug?.trim() || lp.slug;
  if (targetSlug !== lp.slug) {
    const dup = await prisma.landingPage.findFirst({
      where: {
        userId: args.userId,
        slug: targetSlug,
        NOT: { id: args.landingPageId },
      },
      select: { id: true },
    });
    if (dup) throw new Error(`slug "${targetSlug}" は既に使用中`);
  }

  // OGP 生成
  const sections = lp.sections as unknown as LpSection[];
  const heroProps = sections.find((s) => s.type === 'hero')?.props as
    | { headline?: string }
    | undefined;
  const headline = heroProps?.headline ?? lp.title;
  const { ogImageUrl } = await generateOgImage({
    landingPageId: lp.id,
    headline,
  });

  // 更新
  await prisma.landingPage.update({
    where: { id: lp.id },
    data: {
      slug: targetSlug,
      status: 'published',
      publishedAt: new Date(),
      ogImageUrl,
      ...(args.analyticsConfig && {
        analyticsConfig: args.analyticsConfig as unknown as object,
      }),
    },
  });

  // user slug（公開 URL に使う）は session.user.id か email 由来。Phase 1 は id を base36 で使う。
  const userSlug = args.userId.slice(-8);
  const publishedUrl = `https://lpmaker-pro.com/site/${userSlug}/${targetSlug}`;

  return { slug: targetSlug, ogImageUrl, publishedUrl };
}
```

- [ ] **Step 3: /api/lp/[id]/publish/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { publishLandingPage } from '@/lib/lp/publish';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PublishBodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(60).optional(),
  analyticsConfig: z.record(z.string(), z.string()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  if (user?.plan !== 'admin') {
    return NextResponse.json({ error: 'Admin only until Sprint 3', adminOnly: true }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = PublishBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await publishLandingPage({
      userId: session.user.id,
      landingPageId: id,
      desiredSlug: parsed.data.slug,
      analyticsConfig: parsed.data.analyticsConfig,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/lp/[id]/publish] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: PublishModal.tsx**

```tsx
'use client';
import { useState } from 'react';

interface Props {
  lpId: string;
  initialSlug: string;
  onClose: () => void;
  onPublished: (publishedUrl: string) => void;
}

export function PublishModal({ lpId, initialSlug, onClose, onPublished }: Props) {
  const [slug, setSlug] = useState(initialSlug);
  const [gtmId, setGtmId] = useState('');
  const [ga4Id, setGa4Id] = useState('');
  const [clarityId, setClarityId] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setSubmitting(true);
    setError(null);
    try {
      const analyticsConfig: Record<string, string> = {};
      if (gtmId) analyticsConfig.gtmId = gtmId;
      if (ga4Id) analyticsConfig.ga4Id = ga4Id;
      if (clarityId) analyticsConfig.clarityId = clarityId;
      if (pixelId) analyticsConfig.pixelId = pixelId;

      const res = await fetch(`/api/lp/${lpId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, analyticsConfig: Object.keys(analyticsConfig).length ? analyticsConfig : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { publishedUrl } = await res.json();
      onPublished(publishedUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '失敗');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">公開設定</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        <label className="block">
          <span className="text-xs text-slate-400">slug（URL の末尾）</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
          />
          <span className="text-[10px] text-slate-500">3-60 字、小文字英数とハイフンのみ</span>
        </label>

        <details className="bg-slate-800 rounded p-3">
          <summary className="text-xs font-bold text-slate-300 cursor-pointer">アナリティクス設定（任意）</summary>
          <div className="mt-3 space-y-2">
            {[
              { label: 'GTM ID', value: gtmId, set: setGtmId, ph: 'GTM-XXXXX' },
              { label: 'GA4 ID', value: ga4Id, set: setGa4Id, ph: 'G-XXXXXXXX' },
              { label: 'Clarity Project ID', value: clarityId, set: setClarityId, ph: 'xxxxxxxxxx' },
              { label: 'Meta Pixel ID', value: pixelId, set: setPixelId, ph: '1234567890' },
            ].map((f) => (
              <label key={f.label} className="block">
                <span className="text-[10px] text-slate-400">{f.label}</span>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.ph}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                />
              </label>
            ))}
          </div>
        </details>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded p-3 text-sm text-red-300">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={submitting}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-sm disabled:opacity-50"
          >
            {submitting ? '公開中…' : '✨ 公開する'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: EditClient に PublishModal を統合**

`src/app/lp-maker/[id]/edit/EditClient.tsx` の header に「公開」ボタンを追加:

```tsx
import { PublishModal } from '@/components/lp-maker/PublishModal';
// ...
const [showPublish, setShowPublish] = useState(false);
const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

// header に追加
<button
  type="button"
  onClick={() => setShowPublish(true)}
  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-sm"
>
  公開する
</button>

{showPublish && (
  <PublishModal
    lpId={lpId}
    initialSlug={initialSlug}
    onClose={() => setShowPublish(false)}
    onPublished={(url) => { setPublishedUrl(url); setShowPublish(false); }}
  />
)}

{publishedUrl && (
  <div className="fixed bottom-4 right-4 bg-emerald-500 text-slate-950 p-4 rounded shadow-2xl">
    🎉 公開しました: <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="underline">{publishedUrl}</a>
  </div>
)}
```

- [ ] **Step 6: Build + Commit**

```bash
npm run build
git add src/lib/lp/og-generator.ts src/lib/lp/publish.ts src/app/api/lp/\[id\]/publish/ src/components/lp-maker/PublishModal.tsx src/app/lp-maker/\[id\]/edit/EditClient.tsx
git commit -m "feat(D9-T13): add publish flow (slug + OGP gen + analytics config + PublishModal)"
```

---

## Day 10 — Task 14: 公開 LP SSR

**Files:**
- 作成: `src/app/site/[user]/[slug]/page.tsx`
- 作成: `src/components/lp-maker/AnalyticsInjector.tsx`
- 作成: `src/app/sitemap.ts`
- 変更: `src/middleware.ts` (PUBLIC_PATH_PREFIXES に `/site/` 追加)

- [ ] **Step 1: middleware 修正**

```bash
grep -n "PUBLIC_PATH_PREFIXES\|PUBLIC_PATHS" src/middleware.ts
```

該当箇所に `/site/` を追加:

```diff
 const PUBLIC_PATH_PREFIXES = [
   '/lp01',
   '/lp02',
   '/legal',
+  '/site',
   '/api/billing/webhook',
   '/api/admin/batch-generate',
 ];
```

- [ ] **Step 2: AnalyticsInjector.tsx**

```tsx
import Script from 'next/script';

interface Props {
  config: {
    gtmId?: string;
    ga4Id?: string;
    clarityId?: string;
    pixelId?: string;
  };
}

export function AnalyticsInjector({ config }: Props) {
  return (
    <>
      {config.gtmId && (
        <Script
          id="gtm-injector"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtmId}');`,
          }}
        />
      )}
      {config.ga4Id && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-injector"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${config.ga4Id}');`,
            }}
          />
        </>
      )}
      {config.clarityId && (
        <Script
          id="clarity-injector"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${config.clarityId}");`,
          }}
        />
      )}
      {config.pixelId && (
        <Script
          id="pixel-injector"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${config.pixelId}');fbq('track', 'PageView');`,
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: 公開 LP page.tsx**

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPrisma } from '@/lib/prisma';
import type { LpSection } from '@/lib/lp/types';
import { SectionRenderer } from '@/components/lp-maker/SectionRenderer';
import { AnalyticsInjector } from '@/components/lp-maker/AnalyticsInjector';

export const dynamic = 'force-static';
export const revalidate = 60;

async function fetchPublishedLp(userSlug: string, lpSlug: string) {
  const prisma = getPrisma();
  // userSlug は userId の末尾 8 文字
  // セキュリティ: 公開 published のみ取得
  const user = await prisma.user.findFirst({
    where: { id: { endsWith: userSlug } },
    select: { id: true },
  });
  if (!user) return null;

  const lp = await prisma.landingPage.findFirst({
    where: { userId: user.id, slug: lpSlug, status: 'published' },
  });
  return lp;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string; slug: string }>;
}): Promise<Metadata> {
  const { user, slug } = await params;
  const lp = await fetchPublishedLp(user, slug);
  if (!lp) return { title: 'Not Found' };

  return {
    title: lp.title,
    openGraph: {
      title: lp.title,
      images: lp.ogImageUrl ? [{ url: lp.ogImageUrl, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: lp.title,
      images: lp.ogImageUrl ? [lp.ogImageUrl] : [],
    },
  };
}

export default async function PublicLpPage({
  params,
}: {
  params: Promise<{ user: string; slug: string }>;
}) {
  const { user, slug } = await params;
  const lp = await fetchPublishedLp(user, slug);
  if (!lp) notFound();

  const sections = (lp.sections as unknown as LpSection[])
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const config = (lp.analyticsConfig as unknown as Record<string, string>) ?? {};

  return (
    <>
      <AnalyticsInjector config={config} />
      <main>
        {sections.map((s, i) => (
          <SectionRenderer key={`${s.type}-${i}`} section={s} />
        ))}
        <footer className="bg-slate-950 text-slate-500 text-xs text-center py-4">
          Powered by{' '}
          <a href="https://lpmaker-pro.com" className="text-emerald-400 hover:underline">
            LP Maker Pro
          </a>
        </footer>
      </main>
    </>
  );
}
```

- [ ] **Step 4: sitemap.ts**

```typescript
import type { MetadataRoute } from 'next';
import { getPrisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const prisma = getPrisma();
  const lps = await prisma.landingPage.findMany({
    where: { status: 'published' },
    select: { slug: true, userId: true, publishedAt: true, updatedAt: true },
    take: 1000,
  });

  return lps.map((lp) => ({
    url: `https://lpmaker-pro.com/site/${lp.userId.slice(-8)}/${lp.slug}`,
    lastModified: lp.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));
}
```

- [ ] **Step 5: Build + Commit**

```bash
npm run build
git add src/app/site/ src/components/lp-maker/AnalyticsInjector.tsx src/app/sitemap.ts src/middleware.ts
git commit -m "feat(D10-T14): add public LP SSR + AnalyticsInjector + sitemap + middleware /site PUBLIC_PATH"
```

---

## Sprint 2 完了基準 (Definition of Done)

- [ ] Punch list I-1〜I-5 + Minor が全て fix 済
- [ ] 11 個の LP-maker 専用 section components が動く
- [ ] `/lp-maker/[id]/edit` で 3-pane 編集が機能（ON/OFF / 並べ替え / コピー編集 / auto-save）
- [ ] 「もう一案」ボタンで 3 案生成、ワンクリック採用が動く
- [ ] `/api/lp/[id]/publish` で公開状態遷移、OGP 画像生成
- [ ] `/site/[user]/[slug]` SSR で公開 LP が閲覧可能
- [ ] GTM / GA4 / Clarity / Pixel ID が公開 LP に動的注入される
- [ ] sitemap.xml が公開 LP を列挙する
- [ ] middleware で `/site/` が公開 path として動く
- [ ] `npm run build` clean

---

## Sprint 2 → Sprint 3 への引き継ぎ事項

Sprint 3 (D11-D15) では:
- D11: Stripe Meter `lp_generation_overage` 連携 + Webhook + Pro Subscription 3-item
- D12: Free/Starter/Pro usage gate + ハードキャップ + Free 公開 LP 透かし焼き込み
- D13: 「広告も作る」ボタン → `/ironclad?prefill=<lpId>` 連携
- D14: Slack 通知 5 種拡張 + 法務監査
- D15: Production E2E 検証 + Pre-Sprint P-1 (DNS) / P-2 (rewrites) / P-3 (Stripe Live)

Sprint 3 D11 で admin gate (Sprint 1 C-2 fix) を Free/Starter/Pro plan-based に置換する。

---

## リスク・注意点

| リスク | 緩和策 |
|---|---|
| Gemini を 3 並列で叩く regenerate が rate limit に当たる | `Promise.allSettled` で部分成功でも返す（最低 1 案） |
| sharp build error on Vercel | banner-tsukurukun は既に sharp 利用中 (Phase A.14 watermark)。互換性確認済 |
| 公開 LP の userSlug = userId 末尾 8 文字、衝突リスク | 8 文字 cuid 末尾の衝突確率は ~10^-12 で実害なし。Phase 2 で正規 userSlug カラム追加検討 |
| middleware `/site/` PUBLIC_PATH 追加で他 route の認証が緩む懸念 | matcher は prefix のみなので影響範囲限定 |
| auto-save の race condition | 1.5 秒 debounce + lastSaved cache で実質防御。本格的な OT/CRDT は YAGNI |
| 公開 LP の SSR キャッシュが古い (`revalidate = 60`) | 編集→公開→閲覧の流れで 1 分遅延あり。即時反映が必要なら `revalidatePath()` を publish API に追加可 |
