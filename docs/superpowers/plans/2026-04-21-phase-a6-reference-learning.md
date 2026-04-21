# Phase A.6: リファレンス学習モード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参考バナー 3〜5 枚を一度アップロードすれば、その商材の生成はすべて参考水準で量産される「StyleProfile」機能を実装する。

**Architecture:** Prisma に `StyleProfile` モデルを追加し、参考画像を Vercel Blob に保管、Gemini 2.5 Pro Vision で 6 要素（visualStyle/typography/priceBadge/cta/layout/copyTone）を抽出。プロファイル選択時に generate-copy / generate-image へ JSON 合流させ、Step3Editor 初期化時に配置デフォルトを読み込む。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Prisma 7 / Neon Postgres / Vercel Blob (`@vercel/blob`) / Gemini 2.5 Pro Vision / Imagen 4 / FLUX 1.1 pro

**Spec reference:** `docs/superpowers/specs/2026-04-21-phase-a6-reference-learning.md`

---

## File Structure

### New files

| パス | 責務 |
|---|---|
| `src/lib/style-profile/schema.ts` | StyleProfile 全型定義（VisualStyle / Typography / PriceBadgeSpec / CtaSpec / LayoutSpec / CopyTone） |
| `src/lib/style-profile/defaults.ts` | 抽出失敗時・欠損補完用のデフォルト StyleProfile |
| `src/lib/style-profile/blob-client.ts` | Vercel Blob SDK ラッパー（put / del） |
| `src/lib/style-profile/extractor.ts` | Gemini 2.5 Pro Vision で 6 要素抽出 + 正規化 |
| `src/lib/style-profile/injector.ts` | generate-copy / generate-image への合流ロジック |
| `src/app/api/style-profile/extract/route.ts` | POST 参考画像アップ→Blob 保存→抽出→StyleProfile 返却（DB 未保存） |
| `src/app/api/style-profile/route.ts` | POST create / GET list |
| `src/app/api/style-profile/[id]/route.ts` | GET / PUT / DELETE 単体 |
| `src/components/style/ReferenceImageUploader.tsx` | D&D + プレビュー（2〜7 枚） |
| `src/components/style/StyleProfileEditor.tsx` | 全画面モーダル（6 要素編集 UI） |
| `src/components/steps/StyleProfileSelector.tsx` | Step1 上部のセレクタ（ラジオ + 新規作成） |
| `docs/baselines/2026-04-21-phase-a6/evaluation.md` | 手動受入テスト評価シート |

### Modified files

| パス | 変更内容 |
|---|---|
| `prisma/schema.prisma` | `StyleProfile` モデル追加、`Banner.styleProfileId` 追加 |
| `src/app/api/generate-copy/route.ts` | body に `styleProfileId` を受領、`injector.injectIntoCopyPrompt` を呼ぶ |
| `src/app/api/generate-image/route.ts` | body に `styleProfileId` を受領、`injector.injectIntoImagePrompt` を呼ぶ |
| `src/app/api/save-banner/route.ts` | `styleProfileId` を永続化 |
| `src/components/steps/Step3Editor.tsx` | プロファイル読込時に priceBadge.primary/secondary / cta / typography を Rnd 要素として配置 |
| `src/app/page.tsx` | `selectedStyleProfile` state 追加、各 fetch で styleProfileId を渡す |
| `package.json` | `@vercel/blob` 追加 |
| `.env.example` | `BLOB_READ_WRITE_TOKEN` 追加 |

---

## Task 0: Vercel Blob 有効化 + ブランチ作成

**Files:**
- 環境設定のみ（手動作業含む）
- Modify: `.env.example`

- [ ] **Step 1: main がクリーンか確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git status
git branch --show-current
```
Expected: `main`, `nothing to commit`

- [ ] **Step 2: Phase A.6 用ブランチを切る**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git checkout -b feature/phase-a6-reference-learning
```
Expected: `Switched to a new branch 'feature/phase-a6-reference-learning'`

- [ ] **Step 3: Vercel Blob 有効化（小池さんの手動作業）**

1. https://vercel.com/satoru-designs-projects/banner-tsukurukun/stores を開く
2. 「Create Database」→「Blob」選択
3. 名前: `banner-tsukurukun-blob`
4. 作成すると環境変数 `BLOB_READ_WRITE_TOKEN` が自動で Vercel に紐づく
5. ダッシュボードから Token をコピーし、ローカル `.env` に `BLOB_READ_WRITE_TOKEN=...` を追加

**※ このステップは人間作業。エージェント実行時はユーザーに依頼。**

- [ ] **Step 4: `@vercel/blob` パッケージ追加**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm install @vercel/blob
```

- [ ] **Step 5: `.env.example` に追記**

```env
GEMINI_API_KEY=
REPLICATE_API_TOKEN=
GOOGLE_AI_STUDIO_API_KEY=
ANTHROPIC_API_KEY=
DATABASE_URL=
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 6: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

- [ ] **Step 7: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add package.json package-lock.json .env.example
git commit -m "chore(A6-Day0): add @vercel/blob dep + env var"
```

---

## Task 1 (Day 1): Prisma StyleProfile モデル + 型定義

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/style-profile/schema.ts`

- [ ] **Step 1: `prisma/schema.prisma` に `StyleProfile` モデル追加**

`prisma/schema.prisma` の末尾（Banner モデルの後）に追加：

```prisma
model StyleProfile {
  id                  String   @id @default(cuid())
  name                String   @unique
  productContext      String?

  // Vercel Blob URLs, JSON.stringify(string[])
  referenceImageUrls  String

  // Extracted 6 elements, JSON.stringify
  visualStyle         String
  typography          String
  priceBadge          String
  cta                 String
  layout              String
  copyTone            String

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  banners             Banner[]
}
```

- [ ] **Step 2: `Banner` モデルに `styleProfileId` カラム追加**

同ファイル内の `Banner` モデル末尾に追加（既存フィールドの後、`@@...` より前）：

```prisma
  styleProfileId   String?
  styleProfile     StyleProfile? @relation(fields: [styleProfileId], references: [id])
```

- [ ] **Step 3: マイグレーション生成 + Neon 適用**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate dev --name add_style_profile
```
Expected: `prisma/migrations/<ts>_add_style_profile/` 作成、Neon に適用。

- [ ] **Step 4: `src/lib/style-profile/schema.ts` を作成**

```typescript
// src/lib/style-profile/schema.ts

export type LightingType = 'high-key' | 'low-key' | 'natural' | 'dramatic' | 'studio';

export interface VisualStyle {
  colorPalette: {
    primary: string;
    accents: string[];
    background: string;
  };
  lighting: LightingType;
  mood: string;
  composition: string;
  imagePromptKeywords: string;
}

export type FontFamily =
  | 'mincho'
  | 'gothic'
  | 'brush'
  | 'modern-serif'
  | 'hand-written';

export type TextOrientation = 'horizontal' | 'vertical';

export type FontWeight = 'normal' | 'bold' | 'black';

export type EmphasisRatio = '2x' | '3x' | '4x';

export interface MainCopyStyle {
  family: FontFamily;
  orientation: TextOrientation;
  weight: FontWeight;
  emphasisRatio: EmphasisRatio;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface SubCopyStyle {
  family: 'mincho' | 'gothic' | 'modern-serif';
  size: 'small' | 'medium' | 'large';
  color: string;
}

export interface Typography {
  mainCopyStyle: MainCopyStyle;
  subCopyStyle: SubCopyStyle;
  microCopyExamples: string[];
}

export type PriceBadgeShape =
  | 'circle-red'
  | 'circle-gold'
  | 'rect-red'
  | 'ribbon-orange'
  | 'capsule-navy';

export type PriceBadgePosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center-right'
  | 'floating-product';

export type SecondaryBadgeShape = 'circle-flower' | 'ribbon' | 'circle' | 'rect';

export interface PriceBadgeSpec {
  primary: {
    shape: PriceBadgeShape;
    color: string;
    textPattern: string;
    position: PriceBadgePosition;
  };
  secondary?: {
    shape: SecondaryBadgeShape;
    color: string;
    textPattern: string;
    position: PriceBadgePosition;
  };
}

export type CtaTemplateId =
  | 'cta-green-arrow'
  | 'cta-orange-arrow'
  | 'cta-red-urgent'
  | 'cta-gold-premium'
  | 'cta-navy-trust';

export type CtaPosition = 'bottom-center' | 'bottom-left' | 'bottom-right';

export interface CtaSpec {
  templateId: CtaTemplateId;
  textPattern: string;
  position: CtaPosition;
}

export type Zone = 'left' | 'right' | 'center' | 'none' | 'bottom' | 'top';

export type BrandLogoPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'none';

export interface LayoutDecoration {
  type: 'ribbon' | 'diagonal-line' | 'frame' | 'particle';
  position: string;
  color: string;
}

export interface LayoutSpec {
  personZone: Zone;
  productZone: Zone;
  mainCopyZone: Zone;
  brandLogoPosition: BrandLogoPosition;
  decorations: LayoutDecoration[];
}

export type FormalityLevel = 'casual' | 'neutral' | 'formal';

export interface CopyTone {
  formalityLevel: FormalityLevel;
  vocabulary: string[];
  taboos: string[];
  targetDemographic: string;
}

// Full StyleProfile as returned from DB (values already JSON-parsed)
export interface StyleProfile {
  id: string;
  name: string;
  productContext?: string;
  referenceImageUrls: string[];
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
  createdAt: Date;
  updatedAt: Date;
}

// StyleProfile before DB persistence (no id / createdAt / updatedAt)
export type StyleProfileInput = Omit<StyleProfile, 'id' | 'createdAt' | 'updatedAt'>;
```

- [ ] **Step 5: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

- [ ] **Step 6: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add prisma/ src/lib/style-profile/schema.ts
git commit -m "feat(A6-Day1): add StyleProfile Prisma model + TypeScript schema"
```

---

## Task 2 (Day 2): Vercel Blob + extract API

**Files:**
- Create: `src/lib/style-profile/blob-client.ts`
- Create: `src/lib/style-profile/defaults.ts`
- Create: `src/lib/style-profile/extractor.ts`
- Create: `src/app/api/style-profile/extract/route.ts`

- [ ] **Step 1: `src/lib/style-profile/defaults.ts` を作成**

抽出失敗時や欠損補完用のデフォルト値：

```typescript
// src/lib/style-profile/defaults.ts
import type {
  VisualStyle,
  Typography,
  PriceBadgeSpec,
  CtaSpec,
  LayoutSpec,
  CopyTone,
} from './schema';

export const DEFAULT_VISUAL_STYLE: VisualStyle = {
  colorPalette: {
    primary: '#1A5F3F',
    accents: ['#E67E22', '#F4C430'],
    background: '#F8F7F2',
  },
  lighting: 'natural',
  mood: 'clean and approachable',
  composition: 'left-text, right-product',
  imagePromptKeywords:
    'high-quality Japanese advertising, clean composition, natural lighting',
};

export const DEFAULT_TYPOGRAPHY: Typography = {
  mainCopyStyle: {
    family: 'gothic',
    orientation: 'horizontal',
    weight: 'black',
    emphasisRatio: '2x',
    color: '#1B1B1B',
  },
  subCopyStyle: {
    family: 'gothic',
    size: 'medium',
    color: '#2B2B2B',
  },
  microCopyExamples: [],
};

export const DEFAULT_PRICE_BADGE: PriceBadgeSpec = {
  primary: {
    shape: 'circle-red',
    color: '#E63946',
    textPattern: '初回限定 ¥{NUMBER}',
    position: 'bottom-left',
  },
};

export const DEFAULT_CTA: CtaSpec = {
  templateId: 'cta-orange-arrow',
  textPattern: '今すぐ{ACTION}',
  position: 'bottom-center',
};

export const DEFAULT_LAYOUT: LayoutSpec = {
  personZone: 'right',
  productZone: 'right',
  mainCopyZone: 'left',
  brandLogoPosition: 'top-left',
  decorations: [],
};

export const DEFAULT_COPY_TONE: CopyTone = {
  formalityLevel: 'neutral',
  vocabulary: [],
  taboos: ['激安', '絶対', '必ず'],
  targetDemographic: '一般消費者',
};

export function fillDefaults(partial: Partial<{
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
}>): {
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
} {
  return {
    visualStyle: partial.visualStyle ?? DEFAULT_VISUAL_STYLE,
    typography: partial.typography ?? DEFAULT_TYPOGRAPHY,
    priceBadge: partial.priceBadge ?? DEFAULT_PRICE_BADGE,
    cta: partial.cta ?? DEFAULT_CTA,
    layout: partial.layout ?? DEFAULT_LAYOUT,
    copyTone: partial.copyTone ?? DEFAULT_COPY_TONE,
  };
}
```

- [ ] **Step 2: `src/lib/style-profile/blob-client.ts` を作成**

```typescript
// src/lib/style-profile/blob-client.ts
import { put, del } from '@vercel/blob';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB per image

function ensureToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  return token;
}

/**
 * 参考画像を Vercel Blob にアップロードして URL を返す。
 * ファイル名衝突を避けるため pathname にランダム suffix を付与。
 */
export async function uploadReferenceImage(
  filename: string,
  bytes: Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<string> {
  const token = ensureToken();

  const buf =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(
      `Image too large: ${buf.byteLength} bytes (max ${MAX_BYTES})`,
    );
  }

  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `style-profile-refs/${Date.now()}-${safeName}`;

  const result = await put(path, buf, {
    access: 'public',
    contentType,
    token,
  });

  return result.url;
}

export async function deleteBlob(url: string): Promise<void> {
  const token = ensureToken();
  await del(url, { token });
}
```

- [ ] **Step 3: `src/lib/style-profile/extractor.ts` を作成**

```typescript
// src/lib/style-profile/extractor.ts
import { GoogleGenAI } from '@google/genai';
import {
  VisualStyle,
  Typography,
  PriceBadgeSpec,
  CtaSpec,
  LayoutSpec,
  CopyTone,
} from './schema';
import { fillDefaults } from './defaults';

const MODEL = 'gemini-2.5-pro';

function ensureKey(): string {
  const key =
    process.env.GOOGLE_AI_STUDIO_API_KEY ||
    process.env.GEMINI_API_KEY ||
    '';
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return key;
}

const EXTRACTION_PROMPT = `
あなたは広告クリエイティブ分析のプロフェッショナルです。
提供された参考バナー画像を精読し、共通する「スタイル仕様」を
以下の JSON スキーマで抽出してください。
Markdown ブロックを含めず、純粋な JSON テキストのみ出力してください。

【JSON スキーマ】
{
  "visualStyle": {
    "colorPalette": {
      "primary": "Hex color string",
      "accents": ["Hex", "Hex"],
      "background": "Hex color string"
    },
    "lighting": "high-key | low-key | natural | dramatic | studio",
    "mood": "自由記述・日本語",
    "composition": "自由記述・日本語（例：人物左+商品中央+テキスト右）",
    "imagePromptKeywords": "英語、画像生成プロンプト注入用"
  },
  "typography": {
    "mainCopyStyle": {
      "family": "mincho | gothic | brush | modern-serif | hand-written",
      "orientation": "horizontal | vertical",
      "weight": "normal | bold | black",
      "emphasisRatio": "2x | 3x | 4x",
      "color": "Hex",
      "strokeColor": "Hex or null",
      "strokeWidth": "number or null"
    },
    "subCopyStyle": {
      "family": "mincho | gothic | modern-serif",
      "size": "small | medium | large",
      "color": "Hex"
    },
    "microCopyExamples": ["画像内で実際に読み取れた文字列 3-5 例"]
  },
  "priceBadge": {
    "primary": {
      "shape": "circle-red | circle-gold | rect-red | ribbon-orange | capsule-navy",
      "color": "Hex",
      "textPattern": "初回 ¥{NUMBER} のようなプレースホルダを含むテンプレート",
      "position": "top-left | top-right | bottom-left | bottom-right | center-right | floating-product"
    },
    "secondary": {
      "shape": "circle-flower | ribbon | circle | rect",
      "color": "Hex",
      "textPattern": "累計 {NUMBER} 本突破!! のような",
      "position": "top-left | top-right | bottom-left | bottom-right | center-right | floating-product"
    }
  },
  "cta": {
    "templateId": "cta-green-arrow | cta-orange-arrow | cta-red-urgent | cta-gold-premium | cta-navy-trust",
    "textPattern": "{ACTION}で始める → のような",
    "position": "bottom-center | bottom-left | bottom-right"
  },
  "layout": {
    "personZone": "left | right | center | none",
    "productZone": "left | right | center | bottom",
    "mainCopyZone": "left | right | top | bottom | center",
    "brandLogoPosition": "top-left | top-right | bottom-left | bottom-right | none",
    "decorations": [
      { "type": "ribbon | diagonal-line | frame | particle", "position": "自由記述", "color": "Hex" }
    ]
  },
  "copyTone": {
    "formalityLevel": "casual | neutral | formal",
    "vocabulary": ["よく使われる語彙 3-7 語"],
    "taboos": ["推測される NG 表現 2-3 語"],
    "targetDemographic": "年齢層・性別・悩み等"
  }
}

【抽出ルール】
- 画像ごとに違う要素は多数決で決定
- 色は Hex コードで推定（必ず "#" で始める）
- 判定不能な場合は最も近いデフォルト値を選ぶ（null は使わない）
- secondary バッジが画像に無ければ undefined（キーごと省略）
- decorations が無ければ空配列 []
`;

export interface ExtractedStyle {
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
}

/**
 * 参考画像の URL 配列を受け取り、Gemini Vision で 6 要素を抽出する。
 * 失敗時は defaults にフォールバック、部分欠損は defaults で補完する。
 */
export async function extractStyleFromReferences(
  referenceImageUrls: string[],
): Promise<ExtractedStyle> {
  if (referenceImageUrls.length < 2) {
    throw new Error('At least 2 reference images are required');
  }

  const ai = new GoogleGenAI({ apiKey: ensureKey() });

  // Fetch images and convert to inline data parts
  const imageParts = await Promise.all(
    referenceImageUrls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      const buf = await res.arrayBuffer();
      const base64 = Buffer.from(buf).toString('base64');
      const mime = res.headers.get('content-type') ?? 'image/jpeg';
      return { inlineData: { data: base64, mimeType: mime } };
    }),
  );

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: EXTRACTION_PROMPT },
      ...imageParts,
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  let parsed: Partial<ExtractedStyle>;
  try {
    parsed = JSON.parse(
      text.replace(/```json/g, '').replace(/```/g, '').trim(),
    );
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini JSON: ${err instanceof Error ? err.message : err}`,
    );
  }

  // Fill missing fields with defaults
  const filled = fillDefaults(parsed);
  return filled;
}
```

- [ ] **Step 4: `src/app/api/style-profile/extract/route.ts` を作成**

```typescript
// src/app/api/style-profile/extract/route.ts
import { NextResponse } from 'next/server';
import { uploadReferenceImage } from '@/lib/style-profile/blob-client';
import { extractStyleFromReferences } from '@/lib/style-profile/extractor';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MIN_IMAGES = 2;
const MAX_IMAGES = 7;

export async function POST(req: Request) {
  try {
    // multipart/form-data で画像複数を受け取る
    const formData = await req.formData();
    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) files.push(value);
    }

    if (files.length < MIN_IMAGES) {
      return NextResponse.json(
        { error: `${MIN_IMAGES} 枚以上の画像が必要です` },
        { status: 400 },
      );
    }
    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `${MAX_IMAGES} 枚までしか受け付けられません` },
        { status: 400 },
      );
    }

    // Upload each image to Vercel Blob
    const referenceImageUrls = await Promise.all(
      files.map(async (file) => {
        const buf = await file.arrayBuffer();
        return uploadReferenceImage(file.name, buf, file.type || 'image/jpeg');
      }),
    );

    // Extract style with Gemini Vision
    const extracted = await extractStyleFromReferences(referenceImageUrls);

    return NextResponse.json({ referenceImageUrls, ...extracted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Style profile extract error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

- [ ] **Step 6: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/lib/style-profile/ src/app/api/style-profile/
git commit -m "feat(A6-Day2): add Vercel Blob upload + Gemini Vision extraction API"
```

---

## Task 3 (Day 3): StyleProfile CRUD API

**Files:**
- Create: `src/app/api/style-profile/route.ts`（POST / GET）
- Create: `src/app/api/style-profile/[id]/route.ts`（GET / PUT / DELETE）

- [ ] **Step 1: `src/app/api/style-profile/route.ts` を作成**

```typescript
// src/app/api/style-profile/route.ts
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type {
  VisualStyle,
  Typography,
  PriceBadgeSpec,
  CtaSpec,
  LayoutSpec,
  CopyTone,
} from '@/lib/style-profile/schema';

export const runtime = 'nodejs';

interface CreateBody {
  name: string;
  productContext?: string;
  referenceImageUrls: string[];
  visualStyle: VisualStyle;
  typography: Typography;
  priceBadge: PriceBadgeSpec;
  cta: CtaSpec;
  layout: LayoutSpec;
  copyTone: CopyTone;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBody;
    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const prisma = getPrisma();
    const created = await prisma.styleProfile.create({
      data: {
        name: body.name,
        productContext: body.productContext,
        referenceImageUrls: JSON.stringify(body.referenceImageUrls),
        visualStyle: JSON.stringify(body.visualStyle),
        typography: JSON.stringify(body.typography),
        priceBadge: JSON.stringify(body.priceBadge),
        cta: JSON.stringify(body.cta),
        layout: JSON.stringify(body.layout),
        copyTone: JSON.stringify(body.copyTone),
      },
    });

    return NextResponse.json({ id: created.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    if (message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'このプロファイル名は既に使用されています' },
        { status: 409 },
      );
    }
    console.error('StyleProfile POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const prisma = getPrisma();
    const profiles = await prisma.styleProfile.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        productContext: true,
        referenceImageUrls: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const normalized = profiles.map((p) => ({
      ...p,
      referenceImageUrls: JSON.parse(p.referenceImageUrls) as string[],
    }));
    return NextResponse.json({ profiles: normalized });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: `src/app/api/style-profile/[id]/route.ts` を作成**

```typescript
// src/app/api/style-profile/[id]/route.ts
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { StyleProfileInput } from '@/lib/style-profile/schema';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();
    const p = await prisma.styleProfile.findUnique({ where: { id } });
    if (!p) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: p.id,
      name: p.name,
      productContext: p.productContext,
      referenceImageUrls: JSON.parse(p.referenceImageUrls),
      visualStyle: JSON.parse(p.visualStyle),
      typography: JSON.parse(p.typography),
      priceBadge: JSON.parse(p.priceBadge),
      cta: JSON.parse(p.cta),
      layout: JSON.parse(p.layout),
      copyTone: JSON.parse(p.copyTone),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Partial<StyleProfileInput>;
    const prisma = getPrisma();

    const data: Record<string, string | undefined> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.productContext !== undefined) data.productContext = body.productContext;
    if (body.referenceImageUrls !== undefined)
      data.referenceImageUrls = JSON.stringify(body.referenceImageUrls);
    if (body.visualStyle !== undefined) data.visualStyle = JSON.stringify(body.visualStyle);
    if (body.typography !== undefined) data.typography = JSON.stringify(body.typography);
    if (body.priceBadge !== undefined) data.priceBadge = JSON.stringify(body.priceBadge);
    if (body.cta !== undefined) data.cta = JSON.stringify(body.cta);
    if (body.layout !== undefined) data.layout = JSON.stringify(body.layout);
    if (body.copyTone !== undefined) data.copyTone = JSON.stringify(body.copyTone);

    const updated = await prisma.styleProfile.update({ where: { id }, data });
    return NextResponse.json({ id: updated.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const prisma = getPrisma();

    // Check if any banners reference this profile
    const bannerCount = await prisma.banner.count({ where: { styleProfileId: id } });
    if (bannerCount > 0) {
      return NextResponse.json(
        { error: `このプロファイルで生成された ${bannerCount} 件のバナーが存在します` },
        { status: 409 },
      );
    }

    await prisma.styleProfile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/app/api/style-profile/
git commit -m "feat(A6-Day3): add StyleProfile CRUD API (create/list/get/update/delete)"
```

---

## Task 4 (Day 4): ReferenceImageUploader + StyleProfileSelector

**Files:**
- Create: `src/components/style/ReferenceImageUploader.tsx`
- Create: `src/components/steps/StyleProfileSelector.tsx`

- [ ] **Step 1: `ReferenceImageUploader` を作成**

```tsx
// src/components/style/ReferenceImageUploader.tsx
'use client';

import React, { useState, useRef } from 'react';

type Props = {
  onChange: (files: File[]) => void;
  min?: number;
  max?: number;
};

export function ReferenceImageUploader({ onChange, min = 2, max = 7 }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: File[]) => {
    const combined = [...files, ...newFiles].slice(0, max);
    setFiles(combined);
    const urls = combined.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    onChange(combined);
  };

  const removeAt = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith('image/'),
          );
          handleFiles(dropped);
        }}
        onClick={() => inputRef.current?.click()}
        className="p-8 border-2 border-dashed border-slate-600 rounded-lg text-center cursor-pointer hover:border-sky-400 transition-colors"
      >
        <div className="text-slate-300 text-sm">
          参考バナー画像を D&D または クリックして選択（{min}〜{max} 枚）
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            handleFiles(picked);
          }}
        />
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {previews.map((url, i) => (
            <div key={i} className="relative group">
              <img
                src={url}
                alt=""
                className="w-full aspect-square object-cover rounded border border-slate-700"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`remove-${i}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-400">
        {files.length} / {max} 枚
        {files.length < min && ` （あと ${min - files.length} 枚必要）`}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `StyleProfileSelector` を作成**

```tsx
// src/components/steps/StyleProfileSelector.tsx
'use client';

import React, { useEffect, useState } from 'react';

export interface ProfileListItem {
  id: string;
  name: string;
  productContext?: string;
  referenceImageUrls: string[];
}

type Props = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew: () => void;
};

export function StyleProfileSelector({ selectedId, onSelect, onCreateNew }: Props) {
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/style-profile');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);
      setProfiles(data.profiles ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  return (
    <div className="p-4 rounded-lg border border-slate-700 bg-slate-900/40 space-y-2">
      <div className="text-sm font-bold text-slate-200 flex items-center justify-between">
        <span>スタイルプロファイル</span>
        <button
          type="button"
          onClick={loadProfiles}
          className="text-xs text-sky-400 hover:underline"
        >
          更新
        </button>
      </div>

      {loading && <div className="text-xs text-slate-400">読み込み中...</div>}
      {error && <div className="text-xs text-red-400">エラー: {error}</div>}

      <label className="flex items-center gap-2 p-2 rounded hover:bg-slate-800 cursor-pointer">
        <input
          type="radio"
          name="styleProfile"
          checked={selectedId === null}
          onChange={() => onSelect(null)}
          data-testid="profile-none"
        />
        <span className="text-sm text-slate-300">プロファイル無し（Phase A.5 挙動）</span>
      </label>

      {profiles.map((p) => (
        <label
          key={p.id}
          className="flex items-center gap-2 p-2 rounded hover:bg-slate-800 cursor-pointer"
        >
          <input
            type="radio"
            name="styleProfile"
            checked={selectedId === p.id}
            onChange={() => onSelect(p.id)}
            data-testid={`profile-${p.id}`}
          />
          <span className="text-sm text-slate-200 flex-1">{p.name}</span>
          <span className="text-xs text-slate-500">
            {p.referenceImageUrls.length} 枚
          </span>
        </label>
      ))}

      <button
        type="button"
        onClick={onCreateNew}
        className="w-full mt-2 px-3 py-2 rounded-md border border-dashed border-sky-400 text-sky-400 text-sm hover:bg-sky-400/10 transition-colors"
        data-testid="create-new-profile"
      >
        + 新規プロファイル作成
      </button>
    </div>
  );
}
```

- [ ] **Step 3: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/components/
git commit -m "feat(A6-Day4): add ReferenceImageUploader + StyleProfileSelector components"
```

---

## Task 5 (Day 5): StyleProfileEditor 全画面モーダル

**Files:**
- Create: `src/components/style/StyleProfileEditor.tsx`
- Modify: `src/app/page.tsx`（モーダル呼び出し + 新 state）

- [ ] **Step 1: `StyleProfileEditor` を作成**

編集 UI は 6 要素それぞれに小さなフォームセクションを持つ全画面モーダル。Phase A.6 では以下の最小編集を許可：
- `name` / `productContext`（テキスト）
- `visualStyle.mood` / `composition` / `imagePromptKeywords`（テキスト）
- `typography.mainCopyStyle.family` / `orientation` / `emphasisRatio`（プルダウン）
- `priceBadge.primary.shape` / `textPattern` / `position`（プルダウン + テキスト）
- `cta.templateId` / `textPattern`（プルダウン + テキスト）
- `copyTone.vocabulary` / `taboos`（カンマ区切りテキスト → 配列）

```tsx
// src/components/style/StyleProfileEditor.tsx
'use client';

import React, { useState } from 'react';
import { ReferenceImageUploader } from './ReferenceImageUploader';
import type { StyleProfileInput } from '@/lib/style-profile/schema';

type Props = {
  onClose: () => void;
  onSaved: (id: string) => void;
};

type Stage = 'upload' | 'extracting' | 'edit' | 'saving';

export function StyleProfileEditor({ onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState('');
  const [productContext, setProductContext] = useState('');
  const [extracted, setExtracted] = useState<
    | (StyleProfileInput & { referenceImageUrls: string[] })
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const startExtraction = async () => {
    if (files.length < 2) {
      setError('画像を 2 枚以上アップロードしてください');
      return;
    }
    setError(null);
    setStage('extracting');
    try {
      const fd = new FormData();
      files.forEach((f, i) => fd.append(`image-${i}`, f));
      const res = await fetch('/api/style-profile/extract', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);

      setExtracted({
        name: name || '新規プロファイル',
        productContext: productContext || undefined,
        referenceImageUrls: data.referenceImageUrls,
        visualStyle: data.visualStyle,
        typography: data.typography,
        priceBadge: data.priceBadge,
        cta: data.cta,
        layout: data.layout,
        copyTone: data.copyTone,
      });
      setStage('edit');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setStage('upload');
    }
  };

  const saveProfile = async () => {
    if (!extracted) return;
    if (!extracted.name.trim()) {
      setError('プロファイル名を入力してください');
      return;
    }
    setError(null);
    setStage('saving');
    try {
      const res = await fetch('/api/style-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extracted),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);
      onSaved(data.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setStage('edit');
    }
  };

  const updateField = <K extends keyof StyleProfileInput>(
    key: K,
    value: StyleProfileInput[K],
  ) => {
    if (!extracted) return;
    setExtracted({ ...extracted, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl my-8 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {stage === 'upload' || stage === 'extracting'
              ? '参考画像をアップロード'
              : '抽出結果を確認・編集'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
            data-testid="close-editor"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 rounded bg-red-500/20 border border-red-500 text-red-200 text-sm">
            {error}
          </div>
        )}

        {stage === 'upload' && (
          <>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">プロファイル名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 5 Point Detox 用"
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white"
                data-testid="profile-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">商材メモ（任意）</label>
              <input
                type="text"
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
                placeholder="例: 健康食品 / デトックスドリンク / 40 代女性向け"
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white"
              />
            </div>
            <ReferenceImageUploader onChange={setFiles} min={2} max={7} />
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
              >
                キャンセル
              </button>
              <button
                onClick={startExtraction}
                disabled={files.length < 2}
                className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white"
                data-testid="start-extraction"
              >
                解析開始
              </button>
            </div>
          </>
        )}

        {stage === 'extracting' && (
          <div className="py-12 text-center text-slate-300">
            参考画像を解析中... (30〜60 秒)
          </div>
        )}

        {stage === 'edit' && extracted && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400">プロファイル名</label>
              <input
                type="text"
                value={extracted.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white"
              />
            </div>

            <details className="rounded border border-slate-700 p-3" open>
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                Visual Style
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={extracted.visualStyle.mood}
                  onChange={(e) =>
                    updateField('visualStyle', {
                      ...extracted.visualStyle,
                      mood: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="mood"
                />
                <input
                  type="text"
                  value={extracted.visualStyle.composition}
                  onChange={(e) =>
                    updateField('visualStyle', {
                      ...extracted.visualStyle,
                      composition: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="composition"
                />
                <input
                  type="text"
                  value={extracted.visualStyle.imagePromptKeywords}
                  onChange={(e) =>
                    updateField('visualStyle', {
                      ...extracted.visualStyle,
                      imagePromptKeywords: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="imagePromptKeywords (English)"
                />
              </div>
            </details>

            <details className="rounded border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                Typography (mainCopy)
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={extracted.typography.mainCopyStyle.family}
                  onChange={(e) =>
                    updateField('typography', {
                      ...extracted.typography,
                      mainCopyStyle: {
                        ...extracted.typography.mainCopyStyle,
                        family: e.target.value as 'mincho' | 'gothic' | 'brush' | 'modern-serif' | 'hand-written',
                      },
                    })
                  }
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="mincho">mincho (明朝)</option>
                  <option value="gothic">gothic (ゴシック)</option>
                  <option value="brush">brush (毛筆)</option>
                  <option value="modern-serif">modern-serif</option>
                  <option value="hand-written">hand-written</option>
                </select>
                <select
                  value={extracted.typography.mainCopyStyle.orientation}
                  onChange={(e) =>
                    updateField('typography', {
                      ...extracted.typography,
                      mainCopyStyle: {
                        ...extracted.typography.mainCopyStyle,
                        orientation: e.target.value as 'horizontal' | 'vertical',
                      },
                    })
                  }
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="horizontal">horizontal (横)</option>
                  <option value="vertical">vertical (縦)</option>
                </select>
                <select
                  value={extracted.typography.mainCopyStyle.emphasisRatio}
                  onChange={(e) =>
                    updateField('typography', {
                      ...extracted.typography,
                      mainCopyStyle: {
                        ...extracted.typography.mainCopyStyle,
                        emphasisRatio: e.target.value as '2x' | '3x' | '4x',
                      },
                    })
                  }
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="2x">2x</option>
                  <option value="3x">3x</option>
                  <option value="4x">4x</option>
                </select>
              </div>
            </details>

            <details className="rounded border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                Price Badge (primary)
              </summary>
              <div className="mt-2 space-y-2">
                <select
                  value={extracted.priceBadge.primary.shape}
                  onChange={(e) =>
                    updateField('priceBadge', {
                      ...extracted.priceBadge,
                      primary: {
                        ...extracted.priceBadge.primary,
                        shape: e.target.value as 'circle-red' | 'circle-gold' | 'rect-red' | 'ribbon-orange' | 'capsule-navy',
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="circle-red">circle-red</option>
                  <option value="circle-gold">circle-gold</option>
                  <option value="rect-red">rect-red</option>
                  <option value="ribbon-orange">ribbon-orange</option>
                  <option value="capsule-navy">capsule-navy</option>
                </select>
                <input
                  type="text"
                  value={extracted.priceBadge.primary.textPattern}
                  onChange={(e) =>
                    updateField('priceBadge', {
                      ...extracted.priceBadge,
                      primary: {
                        ...extracted.priceBadge.primary,
                        textPattern: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="例: 初回限定 ¥{NUMBER}"
                />
              </div>
            </details>

            <details className="rounded border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                CTA
              </summary>
              <div className="mt-2 space-y-2">
                <select
                  value={extracted.cta.templateId}
                  onChange={(e) =>
                    updateField('cta', {
                      ...extracted.cta,
                      templateId: e.target.value as 'cta-green-arrow' | 'cta-orange-arrow' | 'cta-red-urgent' | 'cta-gold-premium' | 'cta-navy-trust',
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="cta-green-arrow">cta-green-arrow</option>
                  <option value="cta-orange-arrow">cta-orange-arrow</option>
                  <option value="cta-red-urgent">cta-red-urgent</option>
                  <option value="cta-gold-premium">cta-gold-premium</option>
                  <option value="cta-navy-trust">cta-navy-trust</option>
                </select>
                <input
                  type="text"
                  value={extracted.cta.textPattern}
                  onChange={(e) =>
                    updateField('cta', {
                      ...extracted.cta,
                      textPattern: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="例: {ACTION}で始める →"
                />
              </div>
            </details>

            <details className="rounded border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                Copy Tone
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={extracted.copyTone.vocabulary.join(', ')}
                  onChange={(e) =>
                    updateField('copyTone', {
                      ...extracted.copyTone,
                      vocabulary: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="よく使う語彙（カンマ区切り）"
                />
                <input
                  type="text"
                  value={extracted.copyTone.taboos.join(', ')}
                  onChange={(e) =>
                    updateField('copyTone', {
                      ...extracted.copyTone,
                      taboos: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="避けるべき表現（カンマ区切り）"
                />
                <input
                  type="text"
                  value={extracted.copyTone.targetDemographic}
                  onChange={(e) =>
                    updateField('copyTone', {
                      ...extracted.copyTone,
                      targetDemographic: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="ターゲット層"
                />
              </div>
            </details>

            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
              >
                キャンセル
              </button>
              <button
                onClick={saveProfile}
                className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-white"
                data-testid="save-profile"
              >
                保存
              </button>
            </div>
          </div>
        )}

        {stage === 'saving' && (
          <div className="py-12 text-center text-slate-300">保存中...</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/app/page.tsx` にモーダル統合を追加**

`page.tsx` 先頭の import に追加：

```tsx
import { StyleProfileSelector } from '@/components/steps/StyleProfileSelector';
import { StyleProfileEditor } from '@/components/style/StyleProfileEditor';
```

既存 state 群に追加：

```tsx
const [selectedStyleProfileId, setSelectedStyleProfileId] = useState<string | null>(null);
const [showStyleEditor, setShowStyleEditor] = useState(false);
```

Step 1 の JSX の冒頭（`<Step1Input />` の直前 or return の冒頭）に挿入：

```tsx
{step === 1 && (
  <>
    <StyleProfileSelector
      selectedId={selectedStyleProfileId}
      onSelect={setSelectedStyleProfileId}
      onCreateNew={() => setShowStyleEditor(true)}
    />
    {/* 既存の Step1Input */}
  </>
)}

{showStyleEditor && (
  <StyleProfileEditor
    onClose={() => setShowStyleEditor(false)}
    onSaved={(id) => {
      setSelectedStyleProfileId(id);
      setShowStyleEditor(false);
    }}
  />
)}
```

- [ ] **Step 3: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/
git commit -m "feat(A6-Day5): add StyleProfileEditor modal with 3-stage flow (upload/extract/edit)"
```

---

## Task 6 (Day 6): injector + generate-copy/image 合流

**Files:**
- Create: `src/lib/style-profile/injector.ts`
- Modify: `src/app/api/generate-copy/route.ts`
- Modify: `src/app/api/generate-image/route.ts`
- Modify: `src/app/api/save-banner/route.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: `src/lib/style-profile/injector.ts` を作成**

```typescript
// src/lib/style-profile/injector.ts
import { getPrisma } from '@/lib/prisma';
import type { StyleProfile } from './schema';

/**
 * StyleProfile を DB から取得して JSON パースしたものを返す。
 * 見つからなければ null。
 */
export async function loadStyleProfile(id: string | null | undefined): Promise<StyleProfile | null> {
  if (!id) return null;
  const prisma = getPrisma();
  const p = await prisma.styleProfile.findUnique({ where: { id } });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    productContext: p.productContext ?? undefined,
    referenceImageUrls: JSON.parse(p.referenceImageUrls),
    visualStyle: JSON.parse(p.visualStyle),
    typography: JSON.parse(p.typography),
    priceBadge: JSON.parse(p.priceBadge),
    cta: JSON.parse(p.cta),
    layout: JSON.parse(p.layout),
    copyTone: JSON.parse(p.copyTone),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * generate-copy の system prompt に StyleProfile 由来の指示を合流させる。
 */
export function injectIntoCopyPrompt(
  basePrompt: string,
  profile: StyleProfile | null,
): string {
  if (!profile) return basePrompt;

  const styleHints = [
    `【この商材のスタイル指示】`,
    `- 商材メモ: ${profile.productContext ?? profile.name}`,
    `- 使うべき語彙: ${profile.copyTone.vocabulary.join(', ') || '(指定なし)'}`,
    `- 避けるべき表現: ${profile.copyTone.taboos.join(', ') || '(指定なし)'}`,
    `- ターゲット層: ${profile.copyTone.targetDemographic}`,
    `- 格式レベル: ${profile.copyTone.formalityLevel}`,
    `- 推奨 emphasisRatio: ${profile.typography.mainCopyStyle.emphasisRatio}（全アングル共通のベース、numeric/sensory/fear はそれに +1 段階）`,
    `- 推奨 priceBadge shape: ${profile.priceBadge.primary.shape}`,
    `- priceBadge text パターン: ${profile.priceBadge.primary.textPattern}`,
    ...(profile.priceBadge.secondary
      ? [
          `- 二次バッジ shape: ${profile.priceBadge.secondary.shape}（権威訴求に使用）`,
          `- 二次バッジ text パターン: ${profile.priceBadge.secondary.textPattern}`,
        ]
      : []),
    `- 推奨 CTA templateId: ${profile.cta.templateId}`,
    `- 推奨 CTA text パターン: ${profile.cta.textPattern}`,
    ``,
    `上記を踏まえて、8 アングルを生成してください。`,
    `参考銘柄のトーンに合わせ、vocabulary を可能な限り織り込み、taboos を避けてください。`,
  ].join('\n');

  return `${basePrompt}\n\n${styleHints}`;
}

/**
 * generate-image のメガプロンプトに StyleProfile 由来のキーワードを合流させる。
 */
export function injectIntoImagePrompt(
  basePrompt: string,
  profile: StyleProfile | null,
): string {
  if (!profile) return basePrompt;

  const hints = [
    profile.visualStyle.imagePromptKeywords,
    `lighting: ${profile.visualStyle.lighting}`,
    `mood: ${profile.visualStyle.mood}`,
    `composition: ${profile.visualStyle.composition}`,
    `dominant colors: primary ${profile.visualStyle.colorPalette.primary}, accents ${profile.visualStyle.colorPalette.accents.join('/')}, background ${profile.visualStyle.colorPalette.background}`,
    `person zone: ${profile.layout.personZone}, product zone: ${profile.layout.productZone}, main copy zone: ${profile.layout.mainCopyZone}`,
  ]
    .filter(Boolean)
    .join(', ');

  return `${basePrompt}\n\n[Style profile hints] ${hints}`;
}
```

- [ ] **Step 2: `src/app/api/generate-copy/route.ts` に合流ロジックを追加**

`src/app/api/generate-copy/route.ts` の POST 関数の冒頭（既存 `const { ... } = await req.json();` の直後）に：

```typescript
import { loadStyleProfile, injectIntoCopyPrompt } from '@/lib/style-profile/injector';

// ... 既存の POST 関数 ...

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productName, target, competitorInsights, lpText, styleProfileId } = body;

    // ... 既存の validation ...

    const profile = await loadStyleProfile(styleProfileId);

    const systemPrompt = `既存の 8 アングル prompt（そのまま）`;  // 既存を保持

    const userPrompt = `既存の userPrompt（そのまま）`;  // 既存を保持

    const extendedSystemPrompt = injectIntoCopyPrompt(systemPrompt, profile);

    const generateResponse = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [extendedSystemPrompt + '\n\n' + userPrompt],
      config: { responseMimeType: 'application/json', temperature: 0.7 },
    });

    // ... 既存の JSON parse ...
  }
}
```

実装時は、既存コードを維持しつつ `systemPrompt` → `injectIntoCopyPrompt(systemPrompt, profile)` に差し替える。

- [ ] **Step 3: `src/app/api/generate-image/route.ts` に合流ロジックを追加**

`src/app/api/generate-image/route.ts` の POST 内：

```typescript
import { loadStyleProfile, injectIntoImagePrompt } from '@/lib/style-profile/injector';

// POST 内:
const body = await req.json();
const { prompt, provider, aspectRatio, seed, negativePrompt, styleProfileId } = body;

// ... validation は既存のまま ...

const profile = await loadStyleProfile(styleProfileId);
const extendedPrompt = injectIntoImagePrompt(prompt, profile);

const result = await generateWithFallback(validProvider, {
  prompt: extendedPrompt,
  aspectRatio: validRatio,
  seed,
  negativePrompt,
});
```

- [ ] **Step 4: `src/app/api/save-banner/route.ts` に `styleProfileId` 永続化追加**

`src/app/api/save-banner/route.ts` の POST 内 destructuring と create data に `styleProfileId` を追加：

```typescript
const {
  productName, lpUrl, target, mainCopy, subCopy, elements, base64Image, angle, imageModel,
  angleId, priceBadge, ctaTemplateId, ctaText, emphasisRatio, urgency,
  styleProfileId,  // NEW
} = data;

const banner = await prisma.banner.create({
  data: {
    // ... 既存フィールド ...
    styleProfileId: styleProfileId ?? null,  // NEW
  },
});
```

- [ ] **Step 5: `src/app/page.tsx` の各 fetch で `styleProfileId` を送信**

`page.tsx` の `handleGenerateCopy` / `handleGenerateBg` / `handleSaveList` の fetch body に追加：

```tsx
// handleGenerateCopy
body: JSON.stringify({
  productName,
  target,
  competitorInsights: insightsStr,
  lpText: lpRawText,
  styleProfileId: selectedStyleProfileId,  // NEW
}),

// handleGenerateBg
body: JSON.stringify({
  prompt: masterPrompt,
  provider: imageModel,
  aspectRatio,
  styleProfileId: selectedStyleProfileId,  // NEW
}),

// handleSaveList
body: JSON.stringify({
  // ... 既存フィールド ...
  styleProfileId: selectedStyleProfileId,  // NEW
}),
```

- [ ] **Step 6: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

- [ ] **Step 7: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/
git commit -m "feat(A6-Day6): inject StyleProfile hints into generate-copy/generate-image + persist styleProfileId on banner"
```

---

## Task 7 (Day 7): Step3Editor 統合 + 手動受入テスト

**Files:**
- Modify: `src/components/steps/Step3Editor.tsx`（プロファイルからデフォルト値を読み込み）
- Modify: `src/app/page.tsx`（selectAngle でプロファイル参照して state 初期化）
- Create: `docs/baselines/2026-04-21-phase-a6/evaluation.md`

- [ ] **Step 1: `page.tsx` でプロファイルをロード**

`page.tsx` に、`selectedStyleProfileId` が変わったときにプロファイルをロードする useEffect を追加：

```tsx
import type { StyleProfile } from '@/lib/style-profile/schema';

const [activeStyleProfile, setActiveStyleProfile] = useState<StyleProfile | null>(null);

React.useEffect(() => {
  if (!selectedStyleProfileId) {
    setActiveStyleProfile(null);
    return;
  }
  fetch(`/api/style-profile/${selectedStyleProfileId}`)
    .then((r) => r.json())
    .then((data) => {
      if (data && !data.error) setActiveStyleProfile(data);
    })
    .catch(() => setActiveStyleProfile(null));
}, [selectedStyleProfileId]);
```

- [ ] **Step 2: `selectAngle` でプロファイル優先の初期化**

`page.tsx` の `selectAngle` 内で、プロファイルがあればそれを優先：

```tsx
const selectAngle = (index: number) => {
  setActiveAngleIdx(index);
  const v = variations[index] as Variation;
  // ... 既存の main_copy / sub_copy / image_gen_prompt 設定 ...

  // Phase A.5 の badge / CTA 初期化をプロファイル優先に変更
  if (activeStyleProfile) {
    // プロファイルの primary priceBadge を使う
    setActiveBadge({
      text: activeStyleProfile.priceBadge.primary.textPattern.replace(
        '{NUMBER}',
        String(v.priceBadge?.emphasisNumber ?? '980'),
      ),
      shape: activeStyleProfile.priceBadge.primary.shape,
      color: activeStyleProfile.priceBadge.primary.color,
      position: activeStyleProfile.priceBadge.primary.position,
      emphasisNumber: v.priceBadge?.emphasisNumber,
    });
    setActiveCtaTemplateId(activeStyleProfile.cta.templateId);
    setActiveCtaText(
      activeStyleProfile.cta.textPattern.replace('{ACTION}', v.ctaTemplate?.text ?? '購入'),
    );
    // プロファイルの emphasisRatio を使う
    setActiveEmphasisRatio(activeStyleProfile.typography.mainCopyStyle.emphasisRatio === '4x'
      ? '3x'  // Phase A.5 は 3x 上限
      : activeStyleProfile.typography.mainCopyStyle.emphasisRatio);
  } else {
    // 既存の Phase A.5 初期化（variation から読む）
    setActiveBadge(v.priceBadge ?? null);
    if (v.ctaTemplate) {
      setActiveCtaTemplateId(v.ctaTemplate.id);
      setActiveCtaText(v.ctaTemplate.text);
    }
    setActiveEmphasisRatio(v.copy?.emphasis_ratio ?? '2x');
  }

  setActiveAngleId(v.strategy?.angle_id ?? 'benefit');
  setActiveUrgency(v.urgency ?? 'low');
  setStep(3);
};
```

- [ ] **Step 3: `Step3Editor` でプロファイルの secondary バッジを追加配置**

`Step3Editor.tsx` の canvas JSX 内、既存の PriceBadge overlay のすぐ後に secondary バッジを追加。Props に `secondaryBadge?: PriceBadge | null` を追加：

```tsx
{/* 既存 primary badge の後 */}
{props.secondaryBadge && (
  <div
    className="absolute z-20"
    style={getBadgePositionStyle(props.secondaryBadge.position, props.canvasSize)}
  >
    <PriceBadge badge={props.secondaryBadge} />
  </div>
)}
```

`page.tsx` で `activeSecondaryBadge` state を追加し、プロファイルに secondary があれば設定：

```tsx
const [activeSecondaryBadge, setActiveSecondaryBadge] = useState<PriceBadge | null>(null);

// selectAngle 内:
if (activeStyleProfile?.priceBadge.secondary) {
  setActiveSecondaryBadge({
    text: activeStyleProfile.priceBadge.secondary.textPattern.replace('{NUMBER}', '3,000 万'),
    shape: 'circle-gold',  // Phase A.6 では circle-flower 等を Phase A.5 の 5 種にマッピング
    color: activeStyleProfile.priceBadge.secondary.color,
    position: activeStyleProfile.priceBadge.secondary.position,
  });
} else {
  setActiveSecondaryBadge(null);
}
```

Step3Editor の呼び出しに `secondaryBadge={activeSecondaryBadge}` を渡す。

- [ ] **Step 4: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 評価シート作成**

`docs/baselines/2026-04-21-phase-a6/evaluation.md`:

```markdown
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
- 参考画像 5 枚（小池さん提供の公式バナー）を D&D
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
```

- [ ] **Step 6: red-team + code-review + simplify 呼出**

```
@red-team Phase A.6 の実装を仕様書と突き合わせてレビューしてください。特に：
- Blob upload 失敗時の Gemini 呼び出し継続リスク
- StyleProfile JSON を文字列で持つことでの再帰的パース負荷
- injector.ts でプロファイル文字列が system prompt を不安定にする可能性
- Step3Editor で primary + secondary バッジが重なって描画されるケース
- プロファイル更新時の既存 Banner.styleProfileId の参照整合性
```

```
@superpowers:code-reviewer Phase A.6 の実装を spec と plan と突き合わせて照合レビューしてください。
```

```
/simplify src/lib/style-profile/ src/app/api/style-profile/ src/components/style/
```

指摘を踏まえて修正 → commit。

- [ ] **Step 7: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/ docs/
git commit -m "feat(A6-Day7): wire StyleProfile into Step3Editor + evaluation sheet"
```

- [ ] **Step 8: PR 作成 + マージ**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git push origin feature/phase-a6-reference-learning
```

GitHub で PR 作成、Vercel Preview で動作確認、問題なければ Merge。

- [ ] **Step 9: Phase A.6 完了タグ**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git checkout main
git pull
git tag phase-a6-complete -m "Phase A.6: Reference learning mode (StyleProfile) done"
git push origin phase-a6-complete
```

---

## Self-Review Checklist

プラン実行者は着手前に以下を確認：

- [ ] `docs/superpowers/specs/2026-04-21-phase-a6-reference-learning.md` を読んだ
- [ ] `.env.local` に `BLOB_READ_WRITE_TOKEN` が設定されている
- [ ] Vercel Blob が有効化されている
- [ ] 各タスク完了時に `npm run build` が通ることを確認
- [ ] `[ ]` を `[x]` に進捗ごとに更新する
- [ ] 不明点は Task を停止して user に確認する

## 既知の判断ポイント

1. **Gemini Vision の抽出精度**: Day 2 でプロンプトチューニングが必要になる可能性。出力がスキーマに沿わない場合、`extractor.ts` の prompt を強化して再試行
2. **Secondary badge の shape マッピング**: Phase A.6 の secondary shapes（circle-flower 等）は Phase A.5 の PriceBadge コンポーネントには無い。Day 7 で circle-gold にマッピング（MVP）、Phase A.7 以降で追加検討
3. **画像同時アップロード時の Blob timeout**: 7 枚 × 最大 10MB = 70MB を Vercel の function duration 60s で処理できるか。実機確認、超える場合は逐次アップロードに変更

## 変更履歴
- 2026-04-21: 初稿
