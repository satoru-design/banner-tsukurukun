# Phase A: 画像モデル Dual 化 + 基盤整備 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LP → 4 アングル → 画像生成フローで、ユーザーが Imagen 4 Ultra / FLUX 1.1 pro を選択でき、生成品質が目視で banavo.net 相当になる状態を作る。

**Architecture:** `src/lib/image-providers/` に共通インターフェースを持つ 2 実装（`imagen4.ts` / `flux.ts`）を置き、`/api/generate-image/route.ts` は provider 引数で振り分ける薄いルーターに書き換える。`page.tsx` はステップ別コンポーネントに分割、Prisma は Neon Postgres に移行、`middleware.ts` で Basic Auth をかける。

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript / Prisma / Neon Postgres / Google AI Studio (Imagen 4) / Replicate (FLUX 1.1 pro) / Tailwind v4 / shadcn/ui

**Spec reference:** `docs/superpowers/specs/2026-04-21-banner-tsukurukun-v2-design.md`

---

## File Structure

### New files

| パス | 責務 |
|---|---|
| `src/lib/image-providers/types.ts` | `ImageProvider` インターフェース・型定義・エラー型 |
| `src/lib/image-providers/imagen4.ts` | Google AI Studio Imagen 4 呼び出し実装 |
| `src/lib/image-providers/flux.ts` | Replicate FLUX 1.1 pro 呼び出し実装 |
| `src/lib/image-providers/index.ts` | プロバイダレジストリ + フォールバックルーター |
| `src/components/steps/Step1Input.tsx` | LP URL / 商材入力・解析ステップ UI |
| `src/components/steps/Step2Angles.tsx` | 4 アングル選択・コピー生成ステップ UI |
| `src/components/steps/Step3Editor.tsx` | 画像生成・編集・エクスポートステップ UI |
| `src/components/steps/ModelSelector.tsx` | Imagen 4 / FLUX 切替トグル |
| `src/lib/banner-state.ts` | ステップ間で共有する state 型と初期値 |
| `middleware.ts` | Basic Auth |
| `scripts/test-image-providers.ts` | プロバイダ動作確認ハーネス（手動実行） |
| `scripts/capture-baseline.md` | ベースライン記録手順 |
| `_archive/README.md` | アーカイブ理由のメモ |
| `docs/baselines/2026-04-21-before-phase-a/` | 改善前キャプチャ置き場 |
| `docs/baselines/2026-04-21-after-phase-a/` | 改善後キャプチャ置き場 |

### Modified files

| パス | 変更内容 |
|---|---|
| `src/app/page.tsx` | ステップ別コンポーネントに委譲するオーケストレーターに縮小 |
| `src/app/api/generate-image/route.ts` | provider 引数で振り分け、フォールバック対応 |
| `src/app/api/save-banner/route.ts` | `imageModel` フィールドを受けて保存 |
| `prisma/schema.prisma` | `imageModel` カラム追加・`provider = "postgresql"` へ変更 |
| `.env.example` | 新規環境変数を追加（`REPLICATE_API_TOKEN`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`, `DATABASE_URL` 等） |
| `package.json` | `tsx` 依存追加（スクリプト実行用） |

### Archived (moved to `_archive/`)

ルート直下の AI エディタ作業残骸：`fix-e.js`, `fix-radio.js`, `fix-types.js`, `fix.js`, `migrate-frontend.js`, `patch-aesthetics.js`, `patch-final.js`, `patch-generate-copy.js`, `patch-page-lp.js`, `patch-prompt-engine.js`, `patch-responsive.js`, `patch2.js`, `restore.js`, `scratch.js`, `scratch.ts`, `scratch-gemini.ts`, `scratch-gemini2.ts`, `scratch-replicate.ts`, `test-anthropic.js`, `update-layout-engine.js`, `update-multiple-images.js`, `update-prisma.js`, `update.js`, `update2.js`。旧 `src/app/api/analyze/route.ts`（`analyze-lp` で置換済み）も移動。

---

## Task 0: ブランチ作成

- [ ] **Step 1: 現状の main がきれいか確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git status
```
Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Phase A 用ブランチを切る**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git checkout -b feature/phase-a-image-dual
```
Expected: `Switched to a new branch 'feature/phase-a-image-dual'`

- [ ] **Step 3: `.env.local` が存在するか確認（存在しなければ既存鍵を小池さんに聞く）**

```bash
ls -la /c/Users/strkk/claude_pjt/banner-tsukurukun/.env*
```
Expected: `.env` または `.env.local` が存在し、`GEMINI_API_KEY` が設定されている。

---

## Task A0: ベースライン録画（改善前キャプチャ）

**Files:**
- Create: `docs/baselines/2026-04-21-before-phase-a/`
- Create: `scripts/capture-baseline.md`

- [ ] **Step 1: ベースライン記録ディレクトリを作成**

```bash
mkdir -p /c/Users/strkk/claude_pjt/banner-tsukurukun/docs/baselines/2026-04-21-before-phase-a
mkdir -p /c/Users/strkk/claude_pjt/banner-tsukurukun/docs/baselines/2026-04-21-after-phase-a
```

- [ ] **Step 2: `scripts/capture-baseline.md` を作成**

```markdown
# ベースライン録画手順（Phase A 前後の比較用）

## テスト対象 LP（3 本）
1. <LP1 URL>  ← 美容系・人物ベース想定
2. <LP2 URL>  ← BtoB・オフィス/UI系想定
3. <LP3 URL>  ← サプリ・ダイナミックビジュアル想定

（実際のテスト用 LP URL は小池さんから指定、この 3 本は差し替え可）

## 手順（Phase A 着手前）
1. `npm run dev` でローカル起動
2. 各 LP で 4 アングル × 1 枚ずつ = 12 枚生成
3. Step3 で画像確定 → ブラウザ右クリックで画像保存
4. ファイル名: `before-<LP番号>-<アングル名>.jpg`（例: `before-1-benefit.jpg`）
5. 保存先: `docs/baselines/2026-04-21-before-phase-a/`

## 手順（Phase A 完了後）
同じ LP・同じアングルで、`imagen4` と `flux` 両方で再生成：
- ファイル名: `after-<LP番号>-<アングル名>-<モデル>.jpg`
- 保存先: `docs/baselines/2026-04-21-after-phase-a/`
- 合計: 3 LP × 4 アングル × 2 モデル = 24 枚

## 評価基準
- [ ] 人物の顔・手指の破綻（Flash 系でよくある）が減っているか
- [ ] テキスト用ネガティブスペース指示（"left half empty" 等）に従っているか
- [ ] ライティングの品質（広告クリエイティブ水準か）
- [ ] 日本的トーン指定（和風・清潔感等）への追従度
```

- [ ] **Step 3: ローカル起動してベースライン 12 枚を手動キャプチャ**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm install
npm run dev
```
ブラウザで http://localhost:3000 → 上記手順で 12 枚保存。

**※ このステップは人間作業。**

- [ ] **Step 4: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add docs/baselines/ scripts/capture-baseline.md
git commit -m "chore(A0): capture baseline outputs before Phase A (Gemini Flash)"
```

---

## Task A1: レガシーファイルのアーカイブ退避

**Files:**
- Create: `_archive/README.md`
- Move: ルート直下の `fix-*.js` / `patch-*.js` / `update*.js` / `scratch*.ts/js` / `test-anthropic.js` / `restore.js` / `migrate-frontend.js`
- Move: `src/app/api/analyze/route.ts` → `_archive/app-api-analyze-route.ts`

- [ ] **Step 1: `_archive/` ディレクトリと README を作成**

```bash
mkdir -p /c/Users/strkk/claude_pjt/banner-tsukurukun/_archive
```

`_archive/README.md` の内容：

```markdown
# _archive/

Phase A 着手時（2026-04-21）に、プロトタイプ開発中の AI エディタ作業残骸をここに退避した。

## 退避対象
- `fix-*.js`, `patch-*.js`, `update*.js`, `scratch*.ts/js`, `test-anthropic.js`, `restore.js`, `migrate-frontend.js`
  - いずれもプロトタイプ改造時の一時スクリプト、本番ロジック非依存
- `app-api-analyze-route.ts`（旧 `src/app/api/analyze/route.ts`）
  - `analyze-lp` に完全置換済み、page.tsx からの呼び出しなし

## 復元方法
削除せず保持しているので、必要になったら元の場所に戻せば動作するはず。
ただし依存パッケージのバージョンは本体と一致している前提。
```

- [ ] **Step 2: ルート直下のゴミファイルを一括移動**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git mv fix-e.js fix-radio.js fix-types.js fix.js _archive/
git mv migrate-frontend.js _archive/
git mv patch-aesthetics.js patch-final.js patch-generate-copy.js patch-page-lp.js patch-prompt-engine.js patch-responsive.js patch2.js _archive/
git mv restore.js _archive/
git mv scratch.js scratch.ts scratch-gemini.ts scratch-gemini2.ts scratch-replicate.ts _archive/
git mv test-anthropic.js _archive/
git mv update-layout-engine.js update-multiple-images.js update-prisma.js update.js update2.js _archive/
```

- [ ] **Step 3: 旧 analyze ルートを退避**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git mv src/app/api/analyze/route.ts _archive/app-api-analyze-route.ts
rmdir src/app/api/analyze
```

- [ ] **Step 4: アプリが壊れていないか確認（ビルド）**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add _archive/ src/app/api/
git commit -m "chore(A1): archive legacy scratch/patch/update scripts and obsolete /api/analyze"
```

---

## Task A2: page.tsx をステップ別コンポーネントに分割

**Files:**
- Create: `src/lib/banner-state.ts`
- Create: `src/components/steps/Step1Input.tsx`
- Create: `src/components/steps/Step2Angles.tsx`
- Create: `src/components/steps/Step3Editor.tsx`
- Modify: `src/app/page.tsx`

**方針**: state と handler はすべて親 `page.tsx` に残し、子コンポーネントは **JSX をレンダリングするだけの純粋な props 受け取り役**にする。ロジック変更は一切なし。

- [ ] **Step 1: state と handler の型を `banner-state.ts` に抽出**

`src/lib/banner-state.ts`:

```typescript
// src/lib/banner-state.ts
import React from 'react';

export type CanvasSize = { w: number; h: number; name: string };

export const SIZES: CanvasSize[] = [
  { name: 'Instagram (1080x1080)', w: 1080, h: 1080 },
  { name: 'FB/GDN (1200x628)', w: 1200, h: 628 },
  { name: 'Stories (1080x1920)', w: 1080, h: 1920 },
];

export type CanvasElement = {
  id: string;
  type: string;
  content: string;
  style: string;
  composeMode?: string;
  textStyle: {
    color: string;
    backgroundColor: string;
    fontSize: number;
    fontWeight: string;
    textAlign: 'left' | 'center' | 'right';
    fontFamily?: string;
    textStrokeWidth?: number;
    textStrokeColor?: string;
    textShadow?: string;
  };
  defaultPos: { x: number; y: number; w: number | string; h: number | string };
};

export const PROMPT_SAMPLES = [
  { label: 'クリーンな美容・コスメ系', text: 'A radiant healthy woman standing in soft golden morning light, glowing skin, clean white background with subtle botanical elements, lifestyle wellness photography, high resolution' },
  { label: '信頼感のある BtoB 系', text: 'A modern bright office interior with abstract glass reflection, minimalist corporate background, blue and silver color palette, depth of field, 8k resolution' },
  { label: '力強いサプリ・ダイエット系', text: 'Dynamic burst of energy and water splash, vibrant colors, dark background with glowing particle effects, dramatic lighting, highly detailed 3d render' },
];

export const readAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
};

export const renderRichText = (text: string, accentColor: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(<mark>.*?<\/mark>)/);
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return React.createElement('span', {
        key: i,
        style: { color: accentColor, fontSize: '1.5em', display: 'inline-block', lineHeight: 1.2 }
      }, part.replace(/<\/?mark>/g, ''));
    }
    return React.createElement('span', { key: i }, part);
  });
};
```

- [ ] **Step 2: 既存 `page.tsx` を読み、Step1 / Step2 / Step3 の JSX ブロック境界を特定**

```bash
grep -n "step === 1\|step === 2\|step === 3\|{step ===" /c/Users/strkk/claude_pjt/banner-tsukurukun/src/app/page.tsx
```
Expected: 3 つのブロック境界行番号が出力される。

- [ ] **Step 3: `Step1Input.tsx` を作成（URL / 商材入力部分の JSX）**

`src/components/steps/Step1Input.tsx`:

```tsx
// src/components/steps/Step1Input.tsx
'use client';

import React from 'react';

type Props = {
  inputMode: 'lp' | 'image';
  setInputMode: (v: 'lp' | 'image') => void;
  url: string;
  setUrl: (v: string) => void;
  productName: string;
  setProductName: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  insightData: unknown;
  onAnalyzeLp: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateCopy: () => void;
};

export function Step1Input(props: Props) {
  // 実装時: 既存 page.tsx の `step === 1` に対応するブロックの JSX をここへ移植
  // 変数 `url` → `props.url`、`setUrl` → `props.setUrl` のように書き換える
  // JSX 構造は一切変えない
  return <div data-step="1">{/* 移植対象の JSX */}</div>;
}
```

- [ ] **Step 4: `Step2Angles.tsx` を同パターンで作成**

`src/components/steps/Step2Angles.tsx`:

```tsx
'use client';

import React from 'react';
import { renderRichText } from '@/lib/banner-state';

type Props = {
  variations: Array<{
    strategy: { angle: string; target_insight: string };
    copy: { main_copy: string; sub_copy: string; cta_text: string };
    design_specs: Record<string, unknown>;
  }>;
  onSelectAngle: (index: number) => void;
  onBack: () => void;
};

export function Step2Angles(props: Props) {
  return <div data-step="2">{/* 移植対象の JSX */}</div>;
}
```

- [ ] **Step 5: `Step3Editor.tsx` を同パターンで作成**

`src/components/steps/Step3Editor.tsx`:

```tsx
'use client';

import React from 'react';
import { Rnd } from 'react-rnd';
import { CanvasElement, CanvasSize } from '@/lib/banner-state';

type Props = {
  canvasSize: CanvasSize;
  setCanvasSize: (s: CanvasSize) => void;
  editorTexts: CanvasElement[];
  setEditorTexts: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  generatedBg: string | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewScale: number;
  manualMainCopy: string;
  setManualMainCopy: (v: string) => void;
  manualSubCopy: string;
  setManualSubCopy: (v: string) => void;
  manualImagePrompt: string;
  setManualImagePrompt: (v: string) => void;
  layoutStyle: 'left' | 'right' | 'center';
  setLayoutStyle: (v: 'left' | 'right' | 'center') => void;
  hasPerson: 'yes' | 'no' | 'any';
  setHasPerson: (v: 'yes' | 'no' | 'any') => void;
  personAttr: string;
  setPersonAttr: (v: string) => void;
  bannerTone: string;
  setBannerTone: (v: string) => void;
  additionalInstructions: string;
  setAdditionalInstructions: (v: string) => void;
  ctaText: string;
  setCtaText: (v: string) => void;
  selectedElementId: string | null;
  setSelectedElementId: (v: string | null) => void;
  onGenerateBg: () => void;
  onSaveList: () => void;
  onExport: () => void;
  // Phase A5 で追加
  imageModel: 'imagen4' | 'flux';
  setImageModel: (v: 'imagen4' | 'flux') => void;
  lastProviderUsed: string | null;
  lastFallback: boolean;
};

export function Step3Editor(props: Props) {
  return <div data-step="3">{/* 移植対象の JSX */}</div>;
}
```

- [ ] **Step 6: `page.tsx` を書き換えて子コンポーネントに委譲**

`src/app/page.tsx` の return 文を以下のパターンに書き換える。state と handler は**すべて残す**：

```tsx
return (
  <main className="...">
    {loading && <LoadingOverlay msg={loadingMsg} />}
    {step === 1 && (
      <Step1Input
        inputMode={inputMode} setInputMode={setInputMode}
        url={url} setUrl={setUrl}
        productName={productName} setProductName={setProductName}
        target={target} setTarget={setTarget}
        insightData={insightData}
        onAnalyzeLp={handleAnalyzeLp}
        onImageUpload={handleImageUpload}
        onGenerateCopy={handleGenerateCopy}
      />
    )}
    {step === 2 && (
      <Step2Angles
        variations={variations}
        onSelectAngle={selectAngle}
        onBack={() => setStep(1)}
      />
    )}
    {step === 3 && (
      <Step3Editor /* 全 props を渡す */ />
    )}
  </main>
);
```

- [ ] **Step 7: 型エラーがないかビルド**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 8: ローカル起動して目視確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run dev
```
ブラウザで http://localhost:3000 を開き、Step1 → Step2 → Step3 の遷移が分割前と同一に動くこと。LP 1 本で最後まで通すこと。

- [ ] **Step 9: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/
git commit -m "refactor(A2): split page.tsx into Step1Input / Step2Angles / Step3Editor (no behavior change)"
```

---

## Task A3: 画像プロバイダの共通インターフェースと実装

**Files:**
- Create: `src/lib/image-providers/types.ts`
- Create: `src/lib/image-providers/imagen4.ts`
- Create: `src/lib/image-providers/flux.ts`
- Create: `src/lib/image-providers/index.ts`
- Create: `scripts/test-image-providers.ts`
- Modify: `package.json`

- [ ] **Step 1: 共通型を定義**

`src/lib/image-providers/types.ts`:

```typescript
export type ImageProviderId = 'imagen4' | 'flux';

export type AspectRatio = '1:1' | '16:9' | '9:16';

export interface GenerateParams {
  prompt: string;
  aspectRatio: AspectRatio;
  seed?: number;
  negativePrompt?: string;
}

export interface GenerateResult {
  base64: string; // data:image/... URL 形式
  providerId: ImageProviderId;
  providerMetadata: Record<string, unknown>;
}

export class ImageProviderError extends Error {
  constructor(
    public readonly providerId: ImageProviderId,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${providerId}] ${message}`);
    this.name = 'ImageProviderError';
  }
}

export interface ImageProvider {
  readonly id: ImageProviderId;
  readonly displayName: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
}
```

- [ ] **Step 2: Imagen 4 実装**

`src/lib/image-providers/imagen4.ts`:

```typescript
import { GoogleGenAI } from '@google/genai';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
} from './types';

const GOOGLE_AI_KEY =
  process.env.GOOGLE_AI_STUDIO_API_KEY ||
  process.env.GEMINI_API_KEY ||
  '';

function ensureKey(): string {
  if (!GOOGLE_AI_KEY) {
    throw new ImageProviderError(
      'imagen4',
      'GOOGLE_AI_STUDIO_API_KEY (or GEMINI_API_KEY) is not set',
    );
  }
  return GOOGLE_AI_KEY;
}

export const imagen4Provider: ImageProvider = {
  id: 'imagen4',
  displayName: 'Google Imagen 4 Ultra',

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const ai = new GoogleGenAI({ apiKey: ensureKey() });
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-ultra-generate-001',
        prompt: params.prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: params.aspectRatio,
          ...(params.seed !== undefined ? { seed: params.seed } : {}),
          ...(params.negativePrompt
            ? { negativePrompt: params.negativePrompt }
            : {}),
        },
      });

      const firstImage = response.generatedImages?.[0];
      const bytes = firstImage?.image?.imageBytes;
      const mimeType = firstImage?.image?.mimeType ?? 'image/png';
      if (!bytes) {
        throw new ImageProviderError(
          'imagen4',
          'No image bytes returned from Imagen 4',
        );
      }

      return {
        base64: `data:${mimeType};base64,${bytes}`,
        providerId: 'imagen4',
        providerMetadata: {
          model: 'imagen-4.0-ultra-generate-001',
          aspectRatio: params.aspectRatio,
          seed: params.seed,
        },
      };
    } catch (err) {
      if (err instanceof ImageProviderError) throw err;
      throw new ImageProviderError(
        'imagen4',
        err instanceof Error ? err.message : 'Unknown error',
        err,
      );
    }
  },
};
```

※ `imagen-4.0-ultra-generate-001` のモデル ID は 2026-04 時点の想定値。Google AI Studio の最新 doc で名前がずれていたら、Task A3 実行時に公式ドキュメントで現行の Imagen 4 Ultra のモデル ID を確認して差し替える。

- [ ] **Step 3: FLUX 実装**

`src/lib/image-providers/flux.ts`:

```typescript
import Replicate from 'replicate';
import {
  ImageProvider,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
} from './types';

function ensureKey(): string {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) {
    throw new ImageProviderError('flux', 'REPLICATE_API_TOKEN is not set');
  }
  return key;
}

function aspectToFluxArgs(ratio: GenerateParams['aspectRatio']): {
  aspect_ratio: string;
} {
  const map: Record<GenerateParams['aspectRatio'], string> = {
    '1:1': '1:1',
    '16:9': '16:9',
    '9:16': '9:16',
  };
  return { aspect_ratio: map[ratio] };
}

export const fluxProvider: ImageProvider = {
  id: 'flux',
  displayName: 'Replicate FLUX 1.1 pro',

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const replicate = new Replicate({ auth: ensureKey() });
    try {
      const input = {
        prompt: params.prompt,
        ...aspectToFluxArgs(params.aspectRatio),
        output_format: 'png',
        safety_tolerance: 2,
        ...(params.seed !== undefined ? { seed: params.seed } : {}),
      };

      const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
        input,
      });

      const url =
        typeof output === 'string'
          ? output
          : Array.isArray(output)
            ? (output[0] as string)
            : null;

      if (!url) {
        throw new ImageProviderError(
          'flux',
          `Unexpected output shape: ${JSON.stringify(output).slice(0, 200)}`,
        );
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new ImageProviderError(
          'flux',
          `Failed to fetch result image: ${res.status}`,
        );
      }
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      const contentType = res.headers.get('content-type') ?? 'image/png';

      return {
        base64: `data:${contentType};base64,${b64}`,
        providerId: 'flux',
        providerMetadata: {
          model: 'black-forest-labs/flux-1.1-pro',
          aspectRatio: params.aspectRatio,
          seed: params.seed,
          sourceUrl: url,
        },
      };
    } catch (err) {
      if (err instanceof ImageProviderError) throw err;
      throw new ImageProviderError(
        'flux',
        err instanceof Error ? err.message : 'Unknown error',
        err,
      );
    }
  },
};
```

- [ ] **Step 4: レジストリ + フォールバックルーター**

`src/lib/image-providers/index.ts`:

```typescript
import { imagen4Provider } from './imagen4';
import { fluxProvider } from './flux';
import {
  ImageProvider,
  ImageProviderId,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
} from './types';

export * from './types';

const REGISTRY: Record<ImageProviderId, ImageProvider> = {
  imagen4: imagen4Provider,
  flux: fluxProvider,
};

export function getProvider(id: ImageProviderId): ImageProvider {
  const p = REGISTRY[id];
  if (!p) {
    throw new ImageProviderError(id, `Unknown provider id: ${id}`);
  }
  return p;
}

export function listProviders(): ImageProvider[] {
  return Object.values(REGISTRY);
}

export async function generateWithFallback(
  preferred: ImageProviderId,
  params: GenerateParams,
): Promise<GenerateResult> {
  const order: ImageProviderId[] =
    preferred === 'imagen4' ? ['imagen4', 'flux'] : ['flux', 'imagen4'];

  let lastError: unknown = null;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    try {
      const result = await getProvider(id).generate(params);
      if (i > 0) {
        result.providerMetadata = {
          ...result.providerMetadata,
          fallback: true,
          preferredProvider: preferred,
        };
      }
      return result;
    } catch (err) {
      lastError = err;
    }
  }
  throw (
    lastError ??
    new ImageProviderError(
      preferred,
      'All providers failed and no error captured',
    )
  );
}
```

- [ ] **Step 5: 手動検証スクリプトを作成**

`scripts/test-image-providers.ts`:

```typescript
// 実行: npx tsx scripts/test-image-providers.ts
import { listProviders } from '../src/lib/image-providers';
import * as fs from 'fs';
import * as path from 'path';

const TEST_PROMPT =
  'A clean minimalist product hero photo, softly lit studio environment, empty negative space on the left half, high-end advertising photography, 4k';

async function main() {
  const outDir = path.join(
    __dirname,
    '../docs/baselines/2026-04-21-provider-smoke',
  );
  fs.mkdirSync(outDir, { recursive: true });

  for (const p of listProviders()) {
    console.log(`\n=== Testing provider: ${p.displayName} (${p.id}) ===`);
    try {
      const result = await p.generate({
        prompt: TEST_PROMPT,
        aspectRatio: '1:1',
        seed: 42,
      });
      const b64 = result.base64.replace(/^data:image\/\w+;base64,/, '');
      const outFile = path.join(outDir, `${p.id}.png`);
      fs.writeFileSync(outFile, Buffer.from(b64, 'base64'));
      console.log(`  ✓ Saved ${outFile}`);
      console.log(
        `  metadata: ${JSON.stringify(result.providerMetadata)}`,
      );
    } catch (err) {
      console.error(`  ✗ FAILED: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  }
}

main();
```

- [ ] **Step 6: `tsx` を devDependency に追加**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm install -D tsx
```

- [ ] **Step 7: 環境変数を確認**

`.env.local` に以下があることを確認：

```
GEMINI_API_KEY=xxx
REPLICATE_API_TOKEN=xxx
```

`.env.example` を更新：

```
GEMINI_API_KEY=
REPLICATE_API_TOKEN=
GOOGLE_AI_STUDIO_API_KEY=
ANTHROPIC_API_KEY=
DATABASE_URL=
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=
```

- [ ] **Step 8: スモークテスト実行**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npx tsx scripts/test-image-providers.ts
```
Expected: `docs/baselines/2026-04-21-provider-smoke/imagen4.png` と `flux.png` が生成される。

- [ ] **Step 9: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/lib/image-providers/ scripts/test-image-providers.ts .env.example package.json package-lock.json
git commit -m "feat(A3): add dual image provider abstraction (Imagen 4 + FLUX 1.1 pro)"
```

---

## Task A4: `/api/generate-image` をルーター化

**Files:**
- Modify: `src/app/api/generate-image/route.ts`

- [ ] **Step 1: 現在の route.ts を完全に書き換え**

`src/app/api/generate-image/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import {
  ImageProviderId,
  AspectRatio,
  generateWithFallback,
} from '@/lib/image-providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_PROVIDERS: ImageProviderId[] = ['imagen4', 'flux'];
const VALID_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16'];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string | undefined = body.prompt;
    const providerRaw: string = body.provider ?? 'imagen4';
    const ratioRaw: string = body.aspectRatio ?? '1:1';
    const seed: number | undefined =
      typeof body.seed === 'number' ? body.seed : undefined;
    const negativePrompt: string | undefined = body.negativePrompt;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const provider = VALID_PROVIDERS.includes(providerRaw as ImageProviderId)
      ? (providerRaw as ImageProviderId)
      : 'imagen4';
    const aspectRatio = VALID_RATIOS.includes(ratioRaw as AspectRatio)
      ? (ratioRaw as AspectRatio)
      : '1:1';

    const result = await generateWithFallback(provider, {
      prompt,
      aspectRatio,
      seed,
      negativePrompt,
    });

    return NextResponse.json({
      imageUrl: result.base64,
      provider: result.providerId,
      fallback: result.providerMetadata.fallback === true,
      metadata: result.providerMetadata,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    console.error('API Error (generate-image):', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 3: ローカル起動 + 動作確認**

```bash
curl -X POST http://localhost:3000/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A serene mountain landscape, morning light","provider":"imagen4","aspectRatio":"1:1"}' \
  | head -c 200
```
Expected: レスポンス先頭に `{"imageUrl":"data:image/...` が含まれる。`flux` でも同様に確認。

- [ ] **Step 4: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/app/api/generate-image/route.ts
git commit -m "feat(A4): route /api/generate-image through dual provider with fallback"
```

---

## Task A5: Step3 にモデル選択 UI を追加

**Files:**
- Create: `src/components/steps/ModelSelector.tsx`
- Modify: `src/components/steps/Step3Editor.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: `ModelSelector` コンポーネントを作成**

`src/components/steps/ModelSelector.tsx`:

```tsx
'use client';

import React from 'react';

type Props = {
  value: 'imagen4' | 'flux';
  onChange: (v: 'imagen4' | 'flux') => void;
  disabled?: boolean;
};

export function ModelSelector({ value, onChange, disabled }: Props) {
  const options: Array<{
    id: 'imagen4' | 'flux';
    label: string;
    hint: string;
  }> = [
    { id: 'imagen4', label: 'Imagen 4 Ultra', hint: '写実・人物・和風に強い' },
    { id: 'flux', label: 'FLUX 1.1 pro', hint: 'アート・ダイナミック・抽象に強い' },
  ];

  return (
    <div className="flex gap-2 p-2 rounded-lg border border-slate-700 bg-slate-900/50">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={[
            'flex-1 px-3 py-2 rounded-md text-sm transition',
            value === o.id
              ? 'bg-sky-500 text-white shadow'
              : 'bg-transparent text-slate-300 hover:bg-slate-800',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          data-testid={`model-${o.id}`}
        >
          <div className="font-medium">{o.label}</div>
          <div className="text-[10px] opacity-70">{o.hint}</div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `page.tsx` に state と provider 受け渡しを追加**

`src/app/page.tsx` の state 定義群の末尾に追加：

```tsx
const [imageModel, setImageModel] = useState<'imagen4' | 'flux'>('imagen4');
const [lastProviderUsed, setLastProviderUsed] = useState<string | null>(null);
const [lastFallback, setLastFallback] = useState<boolean>(false);
```

そして `handleGenerateBg` を以下に置き換え：

```tsx
const handleGenerateBg = async () => {
  const masterPrompt = manualImagePrompt;
  const aspectRatio: '1:1' | '16:9' | '9:16' =
    canvasSize.w === canvasSize.h
      ? '1:1'
      : canvasSize.w > canvasSize.h
        ? '16:9'
        : '9:16';

  setLoading(true);
  setLoadingMsg(`AI(${imageModel})が背景画像を生成中...`);
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: masterPrompt,
        provider: imageModel,
        aspectRatio,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    setGeneratedBg(data.imageUrl);
    setLastProviderUsed(data.provider);
    setLastFallback(Boolean(data.fallback));
    enterEditor(data.imageUrl);
  } catch (err: unknown) {
    alert(
      '画像生成エラー: ' +
        (err instanceof Error ? err.message : String(err)),
    );
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 3: `Step3Editor.tsx` に `ModelSelector` を差し込む**

`Step3Editor.tsx` の背景画像生成ボタンのすぐ上に：

```tsx
<div className="mb-3">
  <div className="text-xs text-slate-400 mb-1">画像生成モデル</div>
  <ModelSelector
    value={props.imageModel}
    onChange={props.setImageModel}
    disabled={false}
  />
  {props.lastProviderUsed && props.lastFallback && (
    <div className="mt-1 text-xs text-amber-400">
      ※ {props.imageModel} 失敗のため {props.lastProviderUsed} にフォールバック
    </div>
  )}
</div>
```

import を追加：

```tsx
import { ModelSelector } from './ModelSelector';
```

- [ ] **Step 4: `page.tsx` の `<Step3Editor />` に新 props を渡す**

```tsx
<Step3Editor
  /* 既存 props */
  imageModel={imageModel}
  setImageModel={setImageModel}
  lastProviderUsed={lastProviderUsed}
  lastFallback={lastFallback}
/>
```

- [ ] **Step 5: ビルド + 動作確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build && npm run dev
```
ブラウザで Step3 に「画像生成モデル」トグルが表示され、切替後に生成ボタンを押すと、選んだモデルで生成されることを確認。

- [ ] **Step 6: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/
git commit -m "feat(A5): add image model selector (Imagen 4 / FLUX) to Step3 editor"
```

---

## Task A6: Prisma スキーマに `imageModel` カラム追加

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/save-banner/route.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: schema.prisma に imageModel を追加**

`prisma/schema.prisma` の Banner モデルに 1 行追加（Postgres 移行は Task A7 で行うので、ここでは provider は sqlite のまま）：

```prisma
model Banner {
  id          String   @id @default(cuid())
  productName String?
  lpUrl       String?
  target      String?
  mainCopy    String?
  subCopy     String?
  elements    String?
  base64Image String?
  angle       String?
  imageModel  String?  // NEW: "imagen4" | "flux"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: マイグレーション生成**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate dev --name add_image_model_column
```

- [ ] **Step 3: `save-banner/route.ts` で imageModel を受ける**

`src/app/api/save-banner/route.ts` の `POST` 内を更新：

```typescript
const data = await req.json();
const {
  productName,
  lpUrl,
  target,
  mainCopy,
  subCopy,
  elements,
  base64Image,
  angle,
  imageModel,  // NEW
} = data;

const banner = await prisma.banner.create({
  data: {
    productName,
    lpUrl,
    target,
    mainCopy,
    subCopy,
    elements: JSON.stringify(elements),
    base64Image,
    angle,
    imageModel,  // NEW
  },
});
```

- [ ] **Step 4: page.tsx の `handleSaveList` に imageModel を含める**

```tsx
const res = await fetch('/api/save-banner', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productName,
    lpUrl: url,
    target,
    mainCopy: manualMainCopy,
    subCopy: manualSubCopy,
    elements: editorTexts,
    base64Image: b64,
    angle: v?.strategy?.angle || 'Manual',
    imageModel: lastProviderUsed ?? imageModel,  // NEW
  }),
});
```

- [ ] **Step 5: ビルドと保存動作テスト**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build && npm run dev
```
ブラウザで 1 本生成 → 「マイリストに保存」 → Prisma Studio で確認：

```bash
npx prisma studio
```
Banner テーブルに新レコードがあり、`imageModel` が `imagen4` または `flux` で入っていること。

- [ ] **Step 6: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add prisma/ src/
git commit -m "feat(A6): add imageModel column to Banner and persist on save"
```

---

## Task A7: SQLite → Neon Postgres 移行

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.local` / `.env.example`

- [ ] **Step 1: Neon でプロジェクト作成（手動）**

1. https://console.neon.tech にログイン
2. 新プロジェクト作成: `banner-tsukurukun-v2`、Region: `Asia Pacific (Tokyo)`
3. 接続文字列をコピー（`postgresql://user:pass@host/db?sslmode=require`）
4. `.env.local` に追加：
   ```
   DATABASE_URL=postgresql://...（コピーした文字列）
   ```

**※ このステップは人間作業。**

- [ ] **Step 2: schema.prisma の provider を postgresql に変更**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 3: 既存の migrations フォルダを退避**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
mkdir -p _archive/prisma-sqlite-migrations
mv prisma/migrations _archive/prisma-sqlite-migrations/ 2>/dev/null || true
mv prisma/dev.db _archive/prisma-sqlite-migrations/dev.db.bak 2>/dev/null || true
mv prisma/dev.db-journal _archive/prisma-sqlite-migrations/ 2>/dev/null || true
```

- [ ] **Step 4: Postgres 向けに初期マイグレーションを生成**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate dev --name init_postgres
```
Expected: `prisma/migrations/<timestamp>_init_postgres/` が作成、Neon にテーブルが作られる。

- [ ] **Step 5: 動作確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run dev
```
1 本生成 → 保存 → Prisma Studio で Neon 側にレコードが入ることを確認：

```bash
npx prisma studio
```

- [ ] **Step 6: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add prisma/ _archive/ .env.example
git commit -m "feat(A7): migrate Prisma datasource from SQLite to Neon Postgres"
```

---

## Task A8: Basic Auth middleware

**Files:**
- Create: `middleware.ts`（プロジェクトルート）
- Modify: `.env.local` / `.env.example`

- [ ] **Step 1: `.env.local` に認証情報を追加**

```
BASIC_AUTH_USER=koike
BASIC_AUTH_PASSWORD=<任意の強度のパスワード>
```

- [ ] **Step 2: middleware.ts を作成**

プロジェクトルート（`src/` と同じ階層）に `middleware.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/_next', '/favicon.ico', '/api/health'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数未設定時は認証ナシ（開発時便利のため）
  if (!user || !pass) {
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString();
      const [u, p] = decoded.split(':');
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="banner-tsukurukun"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 3: 動作確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run dev
```
ブラウザで http://localhost:3000 を開くと Basic Auth プロンプトが出る。正しい認証情報で通過 → アプリが表示されること。

- [ ] **Step 4: Vercel 環境変数を設定（デプロイ先）**

Vercel ダッシュボードで：
- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASSWORD`
- `DATABASE_URL`（Neon 接続文字列）
- `GEMINI_API_KEY` / `REPLICATE_API_TOKEN`（ローカルと同じ）

を Production / Preview に追加。

**※ このステップは人間作業。**

- [ ] **Step 5: Commit & Push**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add middleware.ts .env.example
git commit -m "feat(A8): add Basic Auth middleware for single-password protection"
git push origin feature/phase-a-image-dual
```

---

## Task A9: Phase A 完了レビュー（実測と並走比較）

**Files:**
- Create: `docs/baselines/2026-04-21-after-phase-a/` 配下に 24 枚
- Create: `docs/baselines/2026-04-21-comparison.md`
- Create: `docs/reviews/2026-04-21-phase-a-red-team.md`
- Create: `docs/reviews/2026-04-21-phase-a-code-review.md`

- [ ] **Step 1: 24 枚生成（3 LP × 4 アングル × 2 モデル）**

Task A0 と同じ 3 本の LP を使い、各アングルごとに Imagen 4 / FLUX の両方で生成。ファイル名ルール：

```
after-<LP番号>-<アングル名>-<モデル>.jpg
例: after-1-benefit-imagen4.jpg / after-1-benefit-flux.jpg
```

合計 24 枚を `docs/baselines/2026-04-21-after-phase-a/` に保存。

**※ 人間作業。**

- [ ] **Step 2: `docs/baselines/2026-04-21-comparison.md` に比較を書く**

```markdown
# Phase A 完了比較

## LP 1: <URL>

| アングル | Before (Gemini Flash) | After: Imagen 4 | After: FLUX |
|---|---|---|---|
| Benefit | ![](2026-04-21-before-phase-a/before-1-benefit.jpg) | ![](2026-04-21-after-phase-a/after-1-benefit-imagen4.jpg) | ![](2026-04-21-after-phase-a/after-1-benefit-flux.jpg) |
| Fear | ... | ... | ... |
| Authority | ... | ... | ... |
| Empathy | ... | ... | ... |

### 評価
- 人物の破綻: Flash(×) / Imagen4(○) / FLUX(△)
- ネガティブスペース指示追従: ...
- 広告クリエイティブ水準: ...

## LP 2, LP 3 も同様

## 結論
- 人物ベース: （どちらが良いか）
- 抽象・ダイナミック: （どちらが良いか）
- Phase B 以降の既定モデル: （どちらを default に置くか）
```

- [ ] **Step 3: `red-team` エージェントで穴潰し**

Claude Code セッションで以下を実行：

```
@red-team Phase A の実装と比較レポートをレビューして、小池さんが日常運用に入った時に破綻しそうな箇所を列挙してください。特に：
- フォールバックの条件分岐で無限ループや二重請求が起きないか
- Basic Auth が API ルートまで守れているか
- imageModel 列が null のレガシーレコードでページが壊れないか
- Neon の接続プール枯渇リスク
```

指摘事項を `docs/reviews/2026-04-21-phase-a-red-team.md` に保存。Critical 指摘は同セッションで即対応してから次へ。

- [ ] **Step 4: `superpowers:code-reviewer` で仕様照合レビュー**

```
@superpowers:code-reviewer Phase A の実装を docs/superpowers/specs/2026-04-21-banner-tsukurukun-v2-design.md の Phase A 節と突き合わせて、仕様との差分・未実装・deviation を列挙してください。
```

指摘を `docs/reviews/2026-04-21-phase-a-code-review.md` に保存、対応済みまで完了扱いにしない。

- [ ] **Step 5: `simplify` skill で冗長コード掃除**

```
/simplify src/lib/image-providers/ src/app/api/generate-image/ src/components/steps/
```

掃除できる箇所があれば修正コミット：

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add -u
git commit -m "refactor(A9): apply simplify skill cleanup"
```

- [ ] **Step 6: PR を作成**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git push origin feature/phase-a-image-dual
```

GitHub UI で PR を作成（タイトル: `Phase A: dual image provider + baseline infra`）。本文は `docs/baselines/2026-04-21-comparison.md` へのリンクと、主要変更点を箇条書き。

- [ ] **Step 7: 本番デプロイ確認**

Vercel が Preview デプロイをかけるので、Preview URL にアクセスし Basic Auth 通過 → 1 本生成成功を確認。OK なら main にマージ。

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git checkout main
git merge feature/phase-a-image-dual
git push origin main
```

- [ ] **Step 8: Phase A 完了タグ**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git tag phase-a-complete -m "Phase A: dual image provider + Postgres + Basic Auth done"
git push origin phase-a-complete
```

---

## Self-Review Checklist

プラン実行者（subagent または手動）は着手前に以下を確認：

- [ ] `docs/superpowers/specs/2026-04-21-banner-tsukurukun-v2-design.md` を読んだ
- [ ] 必要な環境変数（`.env.local`）がすべて揃っている
- [ ] 各タスク完了時に `npm run build` が通ることを確認してから Commit する
- [ ] `[ ]` を `[x]` に進捗ごとに更新する
- [ ] 不明点は Task を停止して user に確認する

## 既知の TODO（Phase A 実装中に判明したら差し戻す対象）

- Imagen 4 Ultra のモデル ID (`imagen-4.0-ultra-generate-001`) が Google AI Studio で使えない場合、Task A3 Step 2 で正しい現行モデル ID に差し替える
- `@google/genai` SDK の `generateImages` メソッドが存在しない / 署名が違う場合、Task A3 Step 2 で SDK ドキュメントを見て正しい呼び出しに変える
- FLUX 1.1 pro の Replicate モデル文字列 (`black-forest-labs/flux-1.1-pro`) が非推奨化している場合、Task A3 Step 3 で現行モデルに差し替える

## 変更履歴

- 2026-04-21: 初稿
