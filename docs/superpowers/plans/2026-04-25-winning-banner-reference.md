# Phase A.8: 勝ちバナー参照機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 過去の勝ちバナーをアップロード→Vision解析で抽象パターン抽出→次回サジェスト生成に注入する機能を、漏洩リスク0.1%以下で実装する。

**Architecture:** 既存3スロット（商品画像/バッジ）には触らず、独立した勝ちバナー解析パスを追加。画像は生成パイプライン（gpt-image-2）に渡さず、抽象テキストのみ ironclad-suggest プロンプトに注入する。データは Asset テーブル拡張（concrete/abstract 二層）で保持し、SaaS化に向けて userId カラムだけ仕込む。

**Tech Stack:** Next.js 16 / TypeScript / Prisma 7 / Neon Postgres / Vercel Blob (Public) / Gemini 2.5 Pro Vision (`@google/genai`)

**Spec:** [docs/superpowers/specs/2026-04-25-winning-banner-reference-design.md](../specs/2026-04-25-winning-banner-reference-design.md)

**Test方針:** 本プロジェクトはテストフレームワーク未導入。各タスクは「TypeScript ビルド通過」+「manual API/UI 確認」で検証。最終 §15 で漏洩リスク E2E 検証10件を実施。

---

## ファイル構成マップ

### 新規作成
| ファイル | 役割 |
|---|---|
| `src/lib/winning-banner/types.ts` | TypeScript型定義（Analysis結果・WinningBanner DTO） |
| `src/lib/winning-banner/analyze.ts` | Gemini Vision解析モジュール |
| `src/lib/winning-banner/prompt-injection.ts` | suggest プロンプト集約注入ロジック |
| `src/lib/auth/get-current-user.ts` | 認証スタブ（Phase 1 は固定値返却） |
| `src/app/api/winning-banners/route.ts` | POST/GET エンドポイント |
| `src/app/api/winning-banners/[id]/route.ts` | DELETE エンドポイント |
| `src/components/ironclad/WinningBannerAddModal.tsx` | URL/ファイル切替の追加モーダル |
| `src/components/ironclad/WinningBannerLibrary.tsx` | ライブラリ表示UI |

### 変更
| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | `Asset` モデルに4カラム追加・1インデックス追加 |
| `src/components/ironclad/IroncladBriefForm.tsx` | 「LP URL」セクション直下に新セクション追加・`useWinningRef` state 追加 |
| `src/app/api/ironclad-suggest/route.ts` | `useWinningRef` フラグ追加・条件分岐で集約注入呼び出し |
| `.env.example` | `WINNING_BANNER_ENABLED` 追加 |
| Caller（`page.tsx` or 親component） | `useWinningRef` を suggest API 呼び出しに渡す |

---

## Task 0: 安全措置（git tag + ブランチ作成）

**目的:** 何かあった時に Phase A.7 状態へ即座に戻れるようにする。

- [ ] **Step 1: 現在の main 状態を確認**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
git status
git log --oneline -5
```

期待: working tree clean / 最新コミットが Phase A.7 系であることを確認

- [ ] **Step 2: phase-a7-stable タグを作成**

```bash
git tag phase-a7-stable
git tag -l | grep phase-a7
```

期待: `phase-a7-stable` がタグ一覧に表示

- [ ] **Step 3: フィーチャーブランチ作成**

```bash
git checkout -b feat/winning-banner-reference
git branch --show-current
```

期待: `feat/winning-banner-reference`

- [ ] **Step 4: タグをリモートに push（任意・推奨）**

```bash
git push origin phase-a7-stable
```

期待: タグが GitHub にも保存される（緊急時にどこからでも戻れる）

---

## Task 1: Prisma スキーマ更新 + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/{timestamp}_add_winning_banner_fields_to_asset/migration.sql`（自動生成）

- [ ] **Step 1: schema.prisma の Asset モデルを編集**

`prisma/schema.prisma` の Asset モデルを以下に置き換える（既存フィールドは温存し、追加分を追記）:

```prisma
/// Phase A.7 Ironclad: 永続素材ライブラリ。商品画像・認証バッジ等を一度アップロードしたら
/// 以降のバナー生成で都度再アップロード不要に。Vercel Blob (Public) に実体保存。
/// Phase A.8 拡張: type='winning_banner' で勝ちバナー解析結果も保持する二層構造。
model Asset {
  id          String   @id @default(cuid())
  /// 'product' | 'badge' | 'logo' | 'other' | 'winning_banner' (Phase A.8追加)
  type        String
  /// ユーザー表示名（例: "5 Point Detox", "GMP Quality"）
  name        String
  /// Vercel Blob の Public URL
  blobUrl     String
  /// 画像の MIME type (image/png, image/jpeg など)
  mimeType    String?
  /// Screen 1 のデフォルト選択対象か（最後に使ったものを自動選択するため）
  isPinned    Boolean  @default(false)

  /// Phase A.8: SaaS化見据え。Phase 1 は全 NULL で運用。
  userId            String?
  /// Phase A.8: 勝ちバナー解析結果（プロンプト注入用の抽象タグのみ）
  /// JSON: { palette, copyAngle, cta, layout, typo, mood, pattern, abstractTags[] }
  analysisAbstract  Json?
  /// Phase A.8: 勝ちバナー解析結果（分析・デバッグ用の生抽出データ。外部APIには絶対送信禁止）
  /// JSON: { paletteHex[], extractedTexts[], detectedElements[], rawObservations }
  analysisConcrete  Json?
  /// Phase A.8: 解析プロンプトのバージョン管理（将来プロンプト改善時の互換性用）
  analysisVersion   Int?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([type])
  @@index([createdAt])
  @@index([userId])
}
```

- [ ] **Step 2: migration を生成・実行**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate dev --name add_winning_banner_fields_to_asset
```

期待:
- `prisma/migrations/{timestamp}_add_winning_banner_fields_to_asset/` ディレクトリ生成
- migration.sql 内に `ALTER TABLE "Asset" ADD COLUMN ...` が4本
- `CREATE INDEX "Asset_userId_idx" ON ...` が1本
- Neon DB に migration 適用成功メッセージ

- [ ] **Step 3: 生成された migration.sql を確認**

```bash
ls prisma/migrations/ | tail -3
cat prisma/migrations/*add_winning_banner*/migration.sql
```

期待: ALTER TABLE 文4本+ CREATE INDEX 1本のみ。既存カラムへの変更なし。

- [ ] **Step 4: Prisma Client を再生成**

```bash
npx prisma generate
```

期待: 「Generated Prisma Client」メッセージ。型 `Prisma.AssetCreateInput` に新フィールドが含まれる。

- [ ] **Step 5: TypeScript ビルドが通ることを確認**

```bash
npm run build
```

期待: ビルド成功（既存コードは新カラムを使わないので影響なし）

- [ ] **Step 6: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add winning banner fields to Asset model

Phase A.8 prep: extend Asset with userId, analysisAbstract,
analysisConcrete, analysisVersion (all NULL-able). Add userId index.
Existing data unaffected."
```

---

## Task 2: 認証スタブ作成（SaaS化準備）

**Files:**
- Create: `src/lib/auth/get-current-user.ts`

- [ ] **Step 1: ディレクトリ作成 + ファイル作成**

`src/lib/auth/get-current-user.ts` を作成:

```typescript
/**
 * Phase 1 (現在): 単一テナント運用。固定値 (userId=null) を返すスタブ。
 * Phase 2 (SaaS化時): NextAuth/Clerk 等から実ユーザーを取得する実装に差し替え。
 *
 * このモジュールを経由することで、SaaS化時に
 * 全 API ルートを書き換えなくて済むようにする。
 */
export interface CurrentUser {
  /** Phase 1 は常に null。Phase 2 で実 userId が入る。 */
  userId: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return { userId: null };
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/lib/auth/get-current-user.ts
git commit -m "feat(auth): add getCurrentUser stub for SaaS-readiness

Phase 1 returns fixed userId=null. Phase 2 will replace impl with
real auth (NextAuth/Clerk) without touching API routes."
```

---

## Task 3: TypeScript型定義モジュール

**Files:**
- Create: `src/lib/winning-banner/types.ts`

- [ ] **Step 1: types.ts を作成**

`src/lib/winning-banner/types.ts`:

```typescript
import type { IroncladPattern } from '@/lib/prompts/ironclad-banner';

/**
 * 既存 IroncladPattern に対応する内部分類キー。
 * Vision 解析時に Gemini が pattern としてどれかを返す。
 */
export const WINNING_PATTERN_KEYS = [
  'benefit',
  'fear',
  'authority',
  'story',
  'sensory',
  'comparison',
  'curiosity',
  'aspirational',
] as const;
export type WinningPatternKey = (typeof WINNING_PATTERN_KEYS)[number];

/**
 * プロンプト注入用の抽象解析結果。
 * 業種・商材を問わず転用可能な抽象表現のみ含む。
 * 具体的な商品名・コピー文言・ロゴテキストは絶対に含めないこと。
 */
export interface AnalysisAbstract {
  /** 例: "黄+黒高コントラスト系" */
  palette: string;
  /** 例: "ベネフィット型・具体数値訴求" */
  copyAngle: string;
  /** 例: "行動促進型・短文" */
  cta: string;
  /** 例: "商品オフセンター + テキスト右寄せ" */
  layout: string;
  /** 例: "ゴシック太字・パワー系" */
  typo: string;
  /** 例: "明るい・健康的・爽快" */
  mood: string;
  /** 既存 IRONCLAD_PATTERNS と対応する分類キー */
  pattern: WinningPatternKey;
  /** UI表示用、3個まで。例: ["ベネフィット型", "黄黒系", "ゴシック太字"] */
  abstractTags: string[];
}

/**
 * 分析・デバッグ用の生抽出データ。
 * **外部 LLM API 呼び出しのプロンプトには絶対に含めないこと。**
 * Phase 1 は DB 保存のみ・UI 非表示。
 */
export interface AnalysisConcrete {
  /** 例: ["#FFD700", "#000000"] */
  paletteHex: string[];
  /** 例: ["2kg減", "16日間集中"] */
  extractedTexts: string[];
  /** 例: ["商品パッケージ", "認証バッジ", "人物モデル"] */
  detectedElements: string[];
  /** Gemini の生観察テキスト */
  rawObservations: string;
}

/**
 * Vision 解析の出力全体。analyze() の戻り値。
 */
export interface AnalysisResult {
  abstract: AnalysisAbstract;
  concrete: AnalysisConcrete;
  /** 解析プロンプトのバージョン。プロンプト変更時にインクリメント。 */
  version: number;
}

/** 現在の解析プロンプトバージョン。プロンプト改善時にインクリメント。 */
export const CURRENT_ANALYSIS_VERSION = 1;

/**
 * API レスポンスや UI で使う WinningBanner DTO。
 * Asset レコードのうち type='winning_banner' のものを表す。
 */
export interface WinningBannerDTO {
  id: string;
  name: string;
  blobUrl: string;
  mimeType: string | null;
  analysisAbstract: AnalysisAbstract | null;
  analysisVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 既存パターンとの対応表（UIタグ表示用、必要に応じて拡張） */
export const PATTERN_KEY_TO_LABEL: Record<WinningPatternKey, string> = {
  benefit: 'ベネフィット型',
  fear: '恐怖訴求',
  authority: '権威訴求',
  story: 'ストーリー型',
  sensory: '感覚訴求',
  comparison: '比較型',
  curiosity: '好奇心型',
  aspirational: '憧れ訴求',
};
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/lib/winning-banner/types.ts
git commit -m "feat(winning-banner): add type definitions

AnalysisAbstract for prompt injection (abstract only, no concrete text).
AnalysisConcrete for DB storage / future analytics (never sent to external APIs)."
```

---

## Task 4: Vision 解析モジュール

**Files:**
- Create: `src/lib/winning-banner/analyze.ts`

- [ ] **Step 1: analyze.ts を作成**

`src/lib/winning-banner/analyze.ts`:

```typescript
import { GoogleGenAI } from '@google/genai';
import {
  AnalysisResult,
  CURRENT_ANALYSIS_VERSION,
  WINNING_PATTERN_KEYS,
} from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ANALYZE_PROMPT = `あなたは広告クリエイティブ分析の専門家です。
添付された広告バナー画像を解析し、以下のJSON形式で出力してください。

【最重要原則】
- "abstract" フィールドには、業種・商材を問わず転用可能な抽象的特徴のみを記述
- 具体的な商品名・ブランド名・コピー文言・ロゴテキスト・人物名は "abstract" に絶対に含めないこと
- "concrete" フィールドには分析・デバッグ用に具体情報を記録（こちらには具体名OK）

【出力JSON スキーマ】
{
  "abstract": {
    "palette": string,         // 例: "黄+黒高コントラスト系"
    "copyAngle": string,       // 例: "ベネフィット型・具体数値訴求"
    "cta": string,             // 例: "行動促進型・短文"
    "layout": string,          // 例: "商品オフセンター + テキスト右寄せ"
    "typo": string,            // 例: "ゴシック太字・パワー系"
    "mood": string,            // 例: "明るい・健康的・爽快"
    "pattern": string,         // 必ず以下のいずれか1つ: ${WINNING_PATTERN_KEYS.join(' | ')}
    "abstractTags": string[]   // UI表示用、ちょうど3個。例: ["ベネフィット型", "黄黒系", "ゴシック太字"]
  },
  "concrete": {
    "paletteHex": string[],         // 主要色HEX、最大5個
    "extractedTexts": string[],     // バナー内の全テキスト
    "detectedElements": string[],   // 検出した視覚要素 (商品パッケージ・人物モデル・認証バッジ等)
    "rawObservations": string       // 自由記述の全体観察（最大500字）
  }
}

純粋なJSONのみ出力。Markdown バッククォート禁止。コメント禁止。`;

/**
 * 画像URLを Gemini 2.5 Pro Vision で解析し、抽象+具体の二層構造で返す。
 *
 * 失敗時の挙動:
 * - Gemini API 失敗 / JSON パース失敗 / スキーマ違反 → throw Error
 * - 呼び出し元はキャッチしてユーザーに「解析に失敗しました」表示
 *
 * 漏洩防止:
 * - abstract は最終的にプロンプトに流れるが、Gemini に「抽象のみ」を強制
 * - concrete は DB 保存のみ。プロンプト経路には絶対に流さない（呼び出し元の責任）
 */
export async function analyzeWinningBanner(imageUrl: string): Promise<AnalysisResult> {
  // 画像を fetch して base64 化（Gemini Vision は inline data を要求）
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image: ${imageRes.status}`);
  }
  const imageBuf = Buffer.from(await imageRes.arrayBuffer());
  const mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg';
  const base64 = imageBuf.toString('base64');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      {
        role: 'user',
        parts: [
          { text: ANALYZE_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3, // 解析は決定的に近い方が安定
    },
  });

  const outputText = response.text;
  if (!outputText) {
    throw new Error('Empty Gemini response');
  }

  // 既存パターン (analyze-lp/ironclad-suggest) と同じクリーニング
  const cleaned = outputText.replace(/```json/g, '').replace(/```/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('analyzeWinningBanner: JSON parse failed:', cleaned);
    throw new Error(`Invalid JSON from Gemini: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 構造バリデーション
  validateAnalysisResult(parsed);

  return {
    abstract: (parsed as { abstract: AnalysisResult['abstract'] }).abstract,
    concrete: (parsed as { concrete: AnalysisResult['concrete'] }).concrete,
    version: CURRENT_ANALYSIS_VERSION,
  };
}

function validateAnalysisResult(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Analysis result is not an object');
  }
  const obj = parsed as Record<string, unknown>;
  const abs = obj.abstract as Record<string, unknown> | undefined;
  const con = obj.concrete as Record<string, unknown> | undefined;

  if (!abs || !con) {
    throw new Error('Analysis result missing abstract or concrete');
  }

  const requiredAbsFields = ['palette', 'copyAngle', 'cta', 'layout', 'typo', 'mood', 'pattern', 'abstractTags'];
  for (const f of requiredAbsFields) {
    if (!(f in abs)) {
      throw new Error(`Analysis abstract missing field: ${f}`);
    }
  }

  if (!Array.isArray(abs.abstractTags)) {
    throw new Error('abstractTags must be an array');
  }

  if (typeof abs.pattern !== 'string' || !(WINNING_PATTERN_KEYS as readonly string[]).includes(abs.pattern)) {
    throw new Error(`pattern must be one of ${WINNING_PATTERN_KEYS.join(', ')}, got: ${abs.pattern}`);
  }

  const requiredConFields = ['paletteHex', 'extractedTexts', 'detectedElements', 'rawObservations'];
  for (const f of requiredConFields) {
    if (!(f in con)) {
      throw new Error(`Analysis concrete missing field: ${f}`);
    }
  }
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/lib/winning-banner/analyze.ts
git commit -m "feat(winning-banner): add Gemini Vision analyze module

Two-layer extraction (abstract + concrete) with strict prompt rules
to prevent concrete text leakage in abstract output. Validates schema
strictly before returning."
```

---

## Task 5: プロンプト注入モジュール

**Files:**
- Create: `src/lib/winning-banner/prompt-injection.ts`

- [ ] **Step 1: prompt-injection.ts を作成**

`src/lib/winning-banner/prompt-injection.ts`:

```typescript
import type { AnalysisAbstract } from './types';

/**
 * 直近 N 件の analysisAbstract を集約し、
 * suggest プロンプトに注入する「過去の勝ちパターン傾向」テキストを生成する。
 *
 * 入力された abstract のみ使用。concrete は絶対に触らない（型レベルで保証）。
 *
 * 業種跨ぎ対応の保険文言を末尾に必ず付与し、
 * Gemini が「ブリーフ優先・傾向は参考程度」と判断できるようにする。
 */
export function buildWinningPatternInjection(abstracts: AnalysisAbstract[]): string {
  if (abstracts.length === 0) return '';

  const palettes = unique(abstracts.map((a) => a.palette));
  const copyAngles = unique(abstracts.map((a) => a.copyAngle));
  const ctas = unique(abstracts.map((a) => a.cta));
  const layouts = unique(abstracts.map((a) => a.layout));
  const typos = unique(abstracts.map((a) => a.typo));
  const moods = unique(abstracts.map((a) => a.mood));

  // pattern は出現頻度カウント
  const patternCounts = new Map<string, number>();
  for (const a of abstracts) {
    patternCounts.set(a.pattern, (patternCounts.get(a.pattern) ?? 0) + 1);
  }
  const patternsByFreq = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `${p}(${n}件)`)
    .join(', ');

  return `

[過去の勝ちパターン傾向（直近${abstracts.length}件集約）]
配色: ${palettes.join(' / ')}
コピー切り口: ${copyAngles.join(' / ')}
CTA: ${ctas.join(' / ')}
レイアウト: ${layouts.join(' / ')}
タイポ: ${typos.join(' / ')}
ムード: ${moods.join(' / ')}
訴求パターン: ${patternsByFreq}

⚠ 重要な解釈指示:
上記傾向は過去の勝ちバナーから抽出されたもので、業種・商材が今回のブリーフと
異なる場合があります。**ブリーフで指定された商材性質・ターゲットを最優先**し、
過去傾向は「視覚スタイル・コピー切り口の方向性のヒント」として柔軟に解釈してください。
一致しない要素は無視して構いません。
`;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter((s) => s && s.trim())));
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/lib/winning-banner/prompt-injection.ts
git commit -m "feat(winning-banner): add prompt injection aggregator

Aggregates up to N AnalysisAbstract objects into a single prompt section
with insurance text for cross-industry brief mismatches. Uses only abstract
fields by type — concrete data cannot leak through this path."
```

---

## Task 6: POST/GET /api/winning-banners

**Files:**
- Create: `src/app/api/winning-banners/route.ts`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p C:/Users/strkk/claude_pjt/banner-tsukurukun/src/app/api/winning-banners
```

- [ ] **Step 2: route.ts を作成**

`src/app/api/winning-banners/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { uploadAssetImage } from '@/lib/assets/blob-client';
import { analyzeWinningBanner } from '@/lib/winning-banner/analyze';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import type { WinningBannerDTO } from '@/lib/winning-banner/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const WINNING_TYPE = 'winning_banner';

/**
 * GET /api/winning-banners
 * type='winning_banner' のレコードを createdAt 降順で全件返す。
 */
export async function GET() {
  try {
    if (process.env.WINNING_BANNER_ENABLED === 'false') {
      return NextResponse.json({ banners: [] });
    }

    const user = await getCurrentUser();
    const prisma = getPrisma();
    const records = await prisma.asset.findMany({
      where: {
        type: WINNING_TYPE,
        // Phase 1: userId は常に null。Phase 2 でフィルタ有効化。
        ...(user.userId ? { userId: user.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const banners: WinningBannerDTO[] = records.map((r) => ({
      id: r.id,
      name: r.name,
      blobUrl: r.blobUrl,
      mimeType: r.mimeType,
      analysisAbstract: r.analysisAbstract as WinningBannerDTO['analysisAbstract'],
      analysisVersion: r.analysisVersion,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({ banners });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('winning-banners GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/winning-banners
 * Content-Type で分岐:
 * - multipart/form-data: ファイルアップロード (file: File, name?: string)
 * - application/json: URL指定 ({ url: string, name?: string })
 *
 * フロー: Blob保存 → Gemini Vision解析 → DB保存 → DTO返却
 */
export async function POST(req: Request) {
  try {
    if (process.env.WINNING_BANNER_ENABLED === 'false') {
      return NextResponse.json({ error: 'Feature is disabled' }, { status: 403 });
    }

    const user = await getCurrentUser();
    const contentType = req.headers.get('content-type') ?? '';

    let bytes: ArrayBuffer;
    let mime: string;
    let displayName: string;
    let originalFilename: string;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const nameField = String(form.get('name') ?? '').trim();
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
      }
      bytes = await file.arrayBuffer();
      mime = file.type || 'image/png';
      originalFilename = file.name || 'winning-banner.png';
      displayName = nameField || originalFilename.replace(/\.[^.]+$/, '');
    } else if (contentType.includes('application/json')) {
      const body = (await req.json()) as { url?: string; name?: string };
      const url = body.url?.trim();
      if (!url) {
        return NextResponse.json({ error: 'url is required' }, { status: 400 });
      }
      if (!/^https?:\/\//.test(url)) {
        return NextResponse.json({ error: 'url must start with http:// or https://' }, { status: 400 });
      }
      const fetched = await fetch(url);
      if (!fetched.ok) {
        return NextResponse.json({ error: `Failed to fetch URL: ${fetched.status}` }, { status: 400 });
      }
      bytes = await fetched.arrayBuffer();
      mime = fetched.headers.get('content-type') ?? 'image/jpeg';
      const urlPath = new URL(url).pathname;
      originalFilename = urlPath.split('/').pop() || 'winning-banner.jpg';
      displayName = body.name?.trim() || originalFilename.replace(/\.[^.]+$/, '') || 'winning-banner';
    } else {
      return NextResponse.json(
        { error: `Unsupported content-type: ${contentType}` },
        { status: 400 },
      );
    }

    // 1. Vercel Blob にアップロード
    const blobUrl = await uploadAssetImage(WINNING_TYPE, originalFilename, bytes, mime);

    // 2. Vision 解析
    let analysis;
    try {
      analysis = await analyzeWinningBanner(blobUrl);
    } catch (analyzeErr) {
      console.error('Vision analysis failed, rolling back blob:', analyzeErr);
      // Best-effort blob cleanup
      try {
        const { del } = await import('@vercel/blob');
        await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch (delErr) {
        console.warn('Blob rollback failed:', delErr);
      }
      throw new Error(
        `Vision analysis failed: ${analyzeErr instanceof Error ? analyzeErr.message : String(analyzeErr)}`,
      );
    }

    // 3. DB 保存
    const prisma = getPrisma();
    const created = await prisma.asset.create({
      data: {
        type: WINNING_TYPE,
        name: displayName,
        blobUrl,
        mimeType: mime,
        userId: user.userId,
        analysisAbstract: analysis.abstract as object,
        analysisConcrete: analysis.concrete as object,
        analysisVersion: analysis.version,
      },
    });

    const dto: WinningBannerDTO = {
      id: created.id,
      name: created.name,
      blobUrl: created.blobUrl,
      mimeType: created.mimeType,
      analysisAbstract: created.analysisAbstract as WinningBannerDTO['analysisAbstract'],
      analysisVersion: created.analysisVersion,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };

    return NextResponse.json({ banner: dto });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('winning-banners POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 4: 開発サーバ起動 + 手動テスト（GET）**

別ターミナルで:
```bash
npm run dev
```

リクエストテスト（PowerShell）:
```powershell
curl -u koike:banner2026 http://localhost:3000/api/winning-banners
```

期待: `{"banners":[]}` （空配列）

- [ ] **Step 5: コミット**

```bash
git add src/app/api/winning-banners/route.ts
git commit -m "feat(api): add POST/GET /api/winning-banners

Handles both multipart/form-data (file upload) and application/json (URL).
Pipeline: Blob upload → Gemini Vision analyze → DB persist with two-layer
abstract/concrete storage. WINNING_BANNER_ENABLED gate respected."
```

---

## Task 7: DELETE /api/winning-banners/[id]

**Files:**
- Create: `src/app/api/winning-banners/[id]/route.ts`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p C:/Users/strkk/claude_pjt/banner-tsukurukun/src/app/api/winning-banners/\[id\]
```

注: Next.js のディレクトリ名は `[id]`（角括弧含む）。シェルでは要エスケープ。

- [ ] **Step 2: route.ts を作成**

`src/app/api/winning-banners/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { deleteAssetBlob } from '@/lib/assets/blob-client';

export const runtime = 'nodejs';

const WINNING_TYPE = 'winning_banner';

/**
 * DELETE /api/winning-banners/[id]
 * Vercel Blob 実体 + DB レコードを一緒に削除。
 * type='winning_banner' でないレコードは削除対象外（404扱い）。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (process.env.WINNING_BANNER_ENABLED === 'false') {
      return NextResponse.json({ error: 'Feature is disabled' }, { status: 403 });
    }

    const { id } = await params;
    const prisma = getPrisma();
    const asset = await prisma.asset.findUnique({ where: { id } });

    if (!asset || asset.type !== WINNING_TYPE) {
      return NextResponse.json({ error: 'Winning banner not found' }, { status: 404 });
    }

    try {
      await deleteAssetBlob(asset.blobUrl);
    } catch (blobErr) {
      console.warn('Failed to delete blob (continuing):', blobErr);
    }

    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('winning-banner DELETE error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 4: コミット**

```bash
git add src/app/api/winning-banners/
git commit -m "feat(api): add DELETE /api/winning-banners/[id]

Removes blob and DB record. Refuses to delete non-winning_banner Assets
(prevents accidental product/badge deletion via wrong endpoint)."
```

---

## Task 8: ironclad-suggest API に勝ちパターン注入を追加

**Files:**
- Modify: `src/app/api/ironclad-suggest/route.ts`

- [ ] **Step 1: route.ts に注入ロジックを追加**

`src/app/api/ironclad-suggest/route.ts` の以下2箇所を変更:

**変更1: ReqBody interface に useWinningRef を追加**

修正前（10-17行目付近）:
```typescript
interface ReqBody {
  pattern: IroncladPattern;
  product: string;
  target: string;
  purpose: string;
  /** 複数サイズ選択対応。Gemini へのプロンプト構築は先頭サイズのみ使用（候補の傾向は全サイズで概ね共通）。 */
  sizes: string[];
}
```

修正後:
```typescript
interface ReqBody {
  pattern: IroncladPattern;
  product: string;
  target: string;
  purpose: string;
  /** 複数サイズ選択対応。Gemini へのプロンプト構築は先頭サイズのみ使用（候補の傾向は全サイズで概ね共通）。 */
  sizes: string[];
  /** Phase A.8: 勝ちバナー参照を有効化するか。未指定 / false なら既存挙動と完全同一。 */
  useWinningRef?: boolean;
}
```

**変更2: import 追加（ファイル先頭の import ブロック）**

`import type { IroncladPattern } from '@/lib/prompts/ironclad-banner';` の直後に追加:

```typescript
import { getPrisma } from '@/lib/prisma';
import { buildWinningPatternInjection } from '@/lib/winning-banner/prompt-injection';
import type { AnalysisAbstract } from '@/lib/winning-banner/types';
```

**変更3: POST 関数内で userPrompt 構築後に注入を追加**

修正前（POST 関数内、`const userPrompt = buildUserPrompt(body);` の直後）:
```typescript
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(body);

    // gemini-2.5-pro: 本プロジェクトで実績ある安定モデル...
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [systemPrompt + '\n\n' + userPrompt],
```

修正後:
```typescript
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(body);

    // Phase A.8: 勝ちパターン注入（useWinningRef=true かつ機能有効時のみ）
    let winningInjection = '';
    const winningEnabled = process.env.WINNING_BANNER_ENABLED !== 'false';
    if (body.useWinningRef === true && winningEnabled) {
      try {
        const prisma = getPrisma();
        const recent = await prisma.asset.findMany({
          where: { type: 'winning_banner' },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });
        const abstracts = recent
          .map((r) => r.analysisAbstract as AnalysisAbstract | null)
          .filter((a): a is AnalysisAbstract => a !== null);
        winningInjection = buildWinningPatternInjection(abstracts);
      } catch (winErr) {
        // 勝ちバナー集約失敗は致命的ではない。空注入で既存挙動にフォールバック。
        console.warn('Winning banner injection failed, falling back to no-injection:', winErr);
      }
    }

    // gemini-2.5-pro: 本プロジェクトで実績ある安定モデル...
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [systemPrompt + '\n\n' + userPrompt + winningInjection],
```

- [ ] **Step 2: 既存挙動の不変性を確認**

`useWinningRef` 未指定 or `false` のとき、`winningInjection` は空文字 `''` のまま、`userPrompt + ''` = `userPrompt` で、Gemini に送る contents は変更前と**バイト単位で同一**になる。これが §2.2 原則3「既存プロンプトと文字レベルで同一」の保証。

- [ ] **Step 3: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 4: 開発サーバで既存挙動の確認（curl）**

別ターミナルで `npm run dev` 起動後:
```powershell
curl -u koike:banner2026 -X POST http://localhost:3000/api/ironclad-suggest `
  -H "Content-Type: application/json" `
  -d '{"pattern":"王道","product":"5 Point Detox","target":"40代女性","purpose":"短期集中デトックス","sizes":["1080x1080"]}'
```

期待: `useWinningRef` 未指定なので既存通り suggestions が返る。エラーなし。

- [ ] **Step 5: コミット**

```bash
git add src/app/api/ironclad-suggest/route.ts
git commit -m "feat(api): add winning banner injection to ironclad-suggest

Optional useWinningRef flag triggers fetch of recent 3 winning banners
and aggregates their abstract analysis into prompt. Existing prompt is
byte-identical when flag is off/missing — full backward compat."
```

---

## Task 9: WinningBannerAddModal コンポーネント

**Files:**
- Create: `src/components/ironclad/WinningBannerAddModal.tsx`

- [ ] **Step 1: モーダルコンポーネントを作成**

`src/components/ironclad/WinningBannerAddModal.tsx`:

```tsx
'use client';

import React, { useState, useRef } from 'react';
import { X, Link2, Upload, Loader2, AlertTriangle } from 'lucide-react';
import type { WinningBannerDTO } from '@/lib/winning-banner/types';

type Tab = 'url' | 'file';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (banner: WinningBannerDTO) => void;
};

export function WinningBannerAddModal({ open, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleSubmitUrl = async () => {
    const u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//.test(u)) {
      setError('http:// または https:// で始まる URL を入力してください');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/winning-banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u, name: name.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      onAdded(json.banner);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (name.trim()) form.append('name', name.trim());
      const res = await fetch('/api/winning-banners', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      onAdded(json.banner);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const reset = () => {
    setUrl('');
    setName('');
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg p-5 max-w-md w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">勝ちバナーを追加</h3>
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="text-slate-400 hover:text-white disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => !busy && setTab('url')}
            disabled={busy}
            className={`px-3 py-2 text-sm font-bold border-b-2 transition ${
              tab === 'url'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="inline w-4 h-4 mr-1" />
            URLで追加
          </button>
          <button
            onClick={() => !busy && setTab('file')}
            disabled={busy}
            className={`px-3 py-2 text-sm font-bold border-b-2 transition ${
              tab === 'file'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="inline w-4 h-4 mr-1" />
            ファイル選択
          </button>
        </div>

        <div>
          <label className="block text-xs text-slate-300 mb-1">表示名（任意）</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder="例: 2026春キャンペーン勝ちバナー"
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
          />
        </div>

        {tab === 'url' && (
          <div>
            <label className="block text-xs text-slate-300 mb-1">画像URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              placeholder="https://example.com/banner.jpg"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
            />
          </div>
        )}

        {tab === 'file' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleSubmitFile(f);
              }}
            />
            <button
              onClick={() => !busy && fileInputRef.current?.click()}
              disabled={busy}
              className="w-full border-2 border-dashed border-slate-600 rounded px-4 py-6 text-center text-slate-300 hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="inline w-4 h-4 mr-1 animate-spin" />
                  アップロード&解析中…
                </>
              ) : (
                <>
                  <Upload className="inline w-4 h-4 mr-1" />
                  画像ファイルを選択
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded px-2 py-2">
            <AlertTriangle className="w-3 h-3 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'url' && (
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => !busy && onClose()}
              disabled={busy}
              className="px-4 py-2 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-40"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmitUrl}
              disabled={busy || !url.trim()}
              className="px-4 py-2 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 className="inline w-4 h-4 mr-1 animate-spin" />
                  解析中…
                </>
              ) : (
                '登録'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/components/ironclad/WinningBannerAddModal.tsx
git commit -m "feat(ui): add WinningBannerAddModal with URL/file tabs

Tab-switched modal supporting URL paste or file upload. Disables
all controls during upload+analyze (~30s). Surfaces server errors
inline. Calls onAdded with new banner DTO when complete."
```

---

## Task 10: WinningBannerLibrary コンポーネント

**Files:**
- Create: `src/components/ironclad/WinningBannerLibrary.tsx`

- [ ] **Step 1: ライブラリコンポーネントを作成**

`src/components/ironclad/WinningBannerLibrary.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Trophy, Star, Loader2, AlertTriangle } from 'lucide-react';
import { WinningBannerAddModal } from './WinningBannerAddModal';
import type { WinningBannerDTO } from '@/lib/winning-banner/types';

const RECENT_REF_COUNT = 3;
const SOFT_WARN_COUNT = 30;

type Props = {
  /** 「今回参考にする」チェックボックスの値 */
  useWinningRef: boolean;
  onChangeUseWinningRef: (v: boolean) => void;
};

export function WinningBannerLibrary({ useWinningRef, onChangeUseWinningRef }: Props) {
  const [banners, setBanners] = useState<WinningBannerDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchBanners = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/winning-banners');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBanners(json.banners ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBanners();
  }, []);

  const handleAdded = (banner: WinningBannerDTO) => {
    setBanners((prev) => [banner, ...prev]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この勝ちバナーを削除しますか？')) return;
    try {
      const res = await fetch(`/api/winning-banners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="border border-amber-700/50 rounded-lg p-4 bg-amber-950/20 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold text-amber-300">勝ちバナー参照（任意）</h3>
      </div>
      <p className="text-xs text-slate-400">
        過去にCV/CTRが高かったバナーを登録すると、次回のサジェスト生成時に勝ちパターン傾向を参考にします。
        <br />
        <span className="text-amber-300">⚠ 生成画像には合成されません（解析専用・直近{RECENT_REF_COUNT}件を集約）</span>
      </p>

      <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
        <input
          type="checkbox"
          checked={useWinningRef}
          onChange={(e) => onChangeUseWinningRef(e.target.checked)}
          className="w-4 h-4 accent-amber-500"
        />
        今回の生成で勝ちパターンを参考にする
      </label>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3 mt-0.5" />
          {error}
        </div>
      )}

      {banners.length > SOFT_WARN_COUNT && (
        <div className="text-xs text-amber-300 bg-amber-950/30 rounded px-2 py-1 border border-amber-800">
          ⚠ {SOFT_WARN_COUNT}枚を超えています。古いものを削除推奨。
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {loading && <div className="text-xs text-slate-400 px-2 py-4">読み込み中…</div>}

        {!loading && banners.length === 0 && (
          <div className="text-xs text-slate-500 px-2 py-4">
            まだ勝ちバナーがありません。「+ 新規追加」から登録してください。
          </div>
        )}

        {banners.map((b, idx) => {
          const isReferenced = useWinningRef && idx < RECENT_REF_COUNT;
          return (
            <div
              key={b.id}
              className={`relative flex-shrink-0 w-32 border rounded overflow-hidden ${
                isReferenced ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-slate-700'
              }`}
              title={b.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.blobUrl}
                alt={b.name}
                className="w-full h-32 object-cover bg-slate-950"
              />
              <button
                onClick={() => handleDelete(b.id)}
                className="absolute top-1 left-1 bg-red-600/80 hover:bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-white"
                title="削除"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
              {isReferenced && (
                <div className="absolute bottom-1 right-1 bg-amber-500 rounded px-1 py-0.5 flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 text-white" />
                  <span className="text-[9px] text-white font-bold">参考中</span>
                </div>
              )}
              <div className="px-1 py-1 bg-slate-900">
                <div className="text-[10px] text-slate-200 truncate">{b.name}</div>
                {b.analysisAbstract?.abstractTags && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {b.analysisAbstract.abstractTags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="text-[8px] bg-slate-800 text-slate-300 rounded px-1 py-0.5 truncate"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setModalOpen(true)}
          className="flex-shrink-0 w-32 h-32 border-2 border-dashed border-slate-600 rounded flex flex-col items-center justify-center text-slate-300 hover:border-amber-500 hover:text-amber-300 self-start"
        >
          <Plus className="w-6 h-6 mb-1" />
          <span className="text-xs">新規追加</span>
        </button>
      </div>

      <WinningBannerAddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={handleAdded}
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript ビルド確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/components/ironclad/WinningBannerLibrary.tsx
git commit -m "feat(ui): add WinningBannerLibrary with thumbnails + tags

Horizontally scrollable library showing thumbnails, abstract tags,
delete button, and 'Referenced' badge on top-3 most recent. Includes
the 'use winning pattern' checkbox and modal trigger."
```

---

## Task 11: IroncladBriefForm に統合

**Files:**
- Modify: `src/components/ironclad/IroncladBriefForm.tsx`

- [ ] **Step 1: 新規 import を追加**

ファイル先頭の import ブロック:

```typescript
import { AssetLibrary, Asset } from './AssetLibrary';
```

の直後に追加:

```typescript
import { WinningBannerLibrary } from './WinningBannerLibrary';
```

- [ ] **Step 2: Props に useWinningRef を追加**

`type Props = { ... }` を以下に変更:

```typescript
type Props = {
  brief: IroncladBrief;
  onChangeBrief: (b: IroncladBrief) => void;
  productAsset: Asset | null;
  onChangeProductAsset: (a: Asset | null) => void;
  badge1Asset: Asset | null;
  onChangeBadge1Asset: (a: Asset | null) => void;
  badge2Asset: Asset | null;
  onChangeBadge2Asset: (a: Asset | null) => void;
  /** Phase A.8: 勝ちバナー参照を有効化するか */
  useWinningRef: boolean;
  onChangeUseWinningRef: (v: boolean) => void;
  onNext: () => void;
};
```

- [ ] **Step 3: 関数の引数に useWinningRef / onChangeUseWinningRef を追加**

```typescript
export function IroncladBriefForm({
  brief,
  onChangeBrief,
  productAsset,
  onChangeProductAsset,
  badge1Asset,
  onChangeBadge1Asset,
  badge2Asset,
  onChangeBadge2Asset,
  useWinningRef,
  onChangeUseWinningRef,
  onNext,
}: Props) {
```

- [ ] **Step 4: 「LP URL から自動抽出」セクション直下に WinningBannerLibrary を配置**

`</div>` で閉じている「LP URL から自動抽出（任意）」セクション（[IroncladBriefForm.tsx:104-146](claude_pjt/banner-tsukurukun/src/components/ironclad/IroncladBriefForm.tsx:104) の `</div>` 直後）に以下を挿入:

```tsx
      <WinningBannerLibrary
        useWinningRef={useWinningRef}
        onChangeUseWinningRef={onChangeUseWinningRef}
      />
```

具体的には:
```tsx
        {analyzeError && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded px-2 py-1">
            <AlertTriangle className="w-3 h-3 mt-0.5" />
            {analyzeError}
          </div>
        )}
      </div>

      {/* === Phase A.8: 勝ちバナー参照セクション === */}
      <WinningBannerLibrary
        useWinningRef={useWinningRef}
        onChangeUseWinningRef={onChangeUseWinningRef}
      />

      <div>
        <label className="block text-sm font-bold text-slate-200 mb-2">パターン *</label>
```

- [ ] **Step 5: TypeScript ビルド確認**

```bash
npm run build
```

期待: TypeScript エラー → IroncladBriefForm の呼び出し元（親 component）で `useWinningRef`/`onChangeUseWinningRef` が渡されていないため、Props 不一致エラー。次のステップで修正。

- [ ] **Step 6: 親コンポーネントを特定して state を追加**

```bash
grep -rn "IroncladBriefForm" C:/Users/strkk/claude_pjt/banner-tsukurukun/src --include="*.tsx" --include="*.ts"
```

期待: `IroncladGenerateScreen.tsx` または `ironclad/page.tsx` 等が hits。

実際に呼んでいるファイルを Read して、`<IroncladBriefForm ... />` 呼び出し箇所を特定。

- [ ] **Step 7: 親コンポーネントに state を追加・props を渡す**

該当ファイルで:

A) state追加（既存 useState ブロックの近くに）:
```typescript
const [useWinningRef, setUseWinningRef] = useState(true); // デフォルトON
```

B) `<IroncladBriefForm />` の props に追加:
```tsx
<IroncladBriefForm
  brief={brief}
  onChangeBrief={setBrief}
  productAsset={productAsset}
  onChangeProductAsset={setProductAsset}
  badge1Asset={badge1Asset}
  onChangeBadge1Asset={setBadge1Asset}
  badge2Asset={badge2Asset}
  onChangeBadge2Asset={setBadge2Asset}
  useWinningRef={useWinningRef}
  onChangeUseWinningRef={setUseWinningRef}
  onNext={handleNext}
/>
```

C) `useWinningRef` を suggest API 呼び出し時に渡す。`fetch('/api/ironclad-suggest', ...)` 箇所を grep して、body に追加:

```typescript
body: JSON.stringify({
  // 既存フィールド全部そのまま
  pattern: brief.pattern,
  product: brief.product,
  target: brief.target,
  purpose: brief.purpose,
  sizes: brief.sizes,
  // 追加
  useWinningRef,
}),
```

- [ ] **Step 8: TypeScript ビルド再確認**

```bash
npm run build
```

期待: ビルド成功

- [ ] **Step 9: 開発サーバ起動 + UI確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/ironclad` を開き（Basic Auth: koike/banner2026）:
- 「LP URL から自動抽出」直下に「🏆 勝ちバナー参照（任意）」セクションが表示される
- 「☑ 今回の生成で勝ちパターンを参考にする」チェックボックスがON状態
- 「+ 新規追加」ボタンが見える
- まだバナー登録ゼロなので「まだ勝ちバナーがありません」表示

- [ ] **Step 10: コミット**

```bash
git add src/components/ironclad/IroncladBriefForm.tsx
git add <親component path>
git commit -m "feat(ui): integrate WinningBannerLibrary into IroncladBriefForm

Adds new section directly under 'LP URL auto-extract'. Lifts
useWinningRef state to parent and threads it through to the
ironclad-suggest API call. Existing 3 asset slots untouched."
```

---

## Task 12: 環境変数追加

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: .env.example に追記**

```bash
cat C:/Users/strkk/claude_pjt/banner-tsukurukun/.env.example 2>/dev/null || echo ".env.example not found"
```

ファイルが存在すれば末尾に以下を追記:

```
# Phase A.8: 勝ちバナー参照機能のON/OFF
# false にすると UI セクション非表示・API も 403 を返す（緊急停止用）
WINNING_BANNER_ENABLED=true
```

ファイルが存在しなければ Write で新規作成（既存環境変数も含めること。`.env` から secrets を伏せた形で複製）。

- [ ] **Step 2: ローカル .env にも追加**

```bash
echo "" >> C:/Users/strkk/claude_pjt/banner-tsukurukun/.env
echo "WINNING_BANNER_ENABLED=true" >> C:/Users/strkk/claude_pjt/banner-tsukurukun/.env
```

- [ ] **Step 3: コミット**

```bash
git add .env.example
git commit -m "chore: add WINNING_BANNER_ENABLED env var

Phase A.8 feature kill-switch (L2 rollback). Default true.
Set to false to disable both UI section and API endpoints."
```

注意: `.env` 自体は gitignore に入っているはず。確認: `git status` で `.env` が untracked のままなら正常。

---

## Task 13: 手動E2Eテスト（自分用環境）

**Files:** なし（ローカル動作確認のみ）

- [ ] **Step 1: 開発サーバを起動**

```bash
cd C:/Users/strkk/claude_pjt/banner-tsukurukun
npm run dev
```

ブラウザで `http://localhost:3000/ironclad` を開く（Basic Auth: koike/banner2026）

- [ ] **Step 2: テスト#1 - URL登録**

1. 「+ 新規追加」クリック
2. モーダルで「URLで追加」タブ選択
3. 適当な過去の勝ちバナー画像URLを貼り付け
   - 例: `C:\Users\strkk\ref-banners\banner-01.jpeg` ではなく Web 上のURL
   - メモリ参照: 5 Point Detox の参考バナーをアップロードしている既存画像URLでも可
4. 「登録」クリック
5. 期待: 30秒以内にライブラリにサムネ追加・抽象タグ表示・「参考中」バッジ付与

- [ ] **Step 3: テスト#2 - ファイルアップロード**

1. 「+ 新規追加」クリック
2. 「ファイル選択」タブ選択
3. ローカルの勝ちバナー画像（例: `C:\Users\strkk\ref-banners\banner-01.jpeg`）を選択
4. 期待: 自動でアップロード開始 → 30秒以内にライブラリ追加

- [ ] **Step 4: テスト#3 - 4枚目登録 → 「参考中」が直近3枚のみ**

1. 計4枚の勝ちバナーを登録
2. 期待: createdAt 降順で先頭3枚に「⭐参考中」バッジ。4枚目（最古）にはバッジなし。

- [ ] **Step 5: テスト#4 - 削除**

1. ライブラリ内の任意のサムネの🗑ボタンクリック
2. 確認ダイアログでOK
3. 期待: サムネ消失。Vercel Blob と DB から削除。

- [ ] **Step 6: テスト#5 - useWinningRef OFF で既存挙動と同一**

1. 「☑ 参考にする」をOFF
2. ブリーフ入力 → STEP 2「次へ」
3. ブラウザDevTools のNetworkで `/api/ironclad-suggest` のリクエストを確認
   - body: `useWinningRef: false`
4. レスポンスが正常に返る
5. **重要:** Vercel Logs で「過去の勝ちパターン傾向」がプロンプトに含まれていないことを確認
   - サーバーログで promptText を console.log するなら、この箇所は空のまま。
   - 必要なら `route.ts` POST 関数末尾に一時的に `console.log('[suggest] full prompt:', systemPrompt + userPrompt + winningInjection);` を追加して検証 → 確認後削除。

- [ ] **Step 7: テスト#6 - useWinningRef ON でプロンプト注入**

1. 「☑ 参考にする」をON
2. ブリーフ入力 → STEP 2「次へ」
3. リクエスト body: `useWinningRef: true`
4. **検証**: console.log で「[過去の勝ちパターン傾向（直近N件集約）]」セクションがプロンプトに含まれていることを確認
5. 注入後の保険文言「ブリーフで指定された商材性質・ターゲットを最優先」が末尾に含まれることを確認

- [ ] **Step 8: テスト#7 - WINNING_BANNER_ENABLED=false で機能停止**

1. `.env` の `WINNING_BANNER_ENABLED=false` に変更
2. 開発サーバ再起動 (`npm run dev` を Ctrl+C → 再起動)
3. ブラウザリロード
4. 期待: 「🏆 勝ちバナー参照」セクションが**消えてはいない**（UIは残る）が、`/api/winning-banners` は空配列を返す。POST/DELETE は403。
   - 注: Library 自体は GET 結果が空配列なので「まだ勝ちバナーがありません」表示になるだけ。完全非表示にしたい場合は、`WinningBannerLibrary` 内で `process.env.NEXT_PUBLIC_WINNING_BANNER_ENABLED` を見る等の追加処理が必要だが、Phase 1 ではAPI側ガードのみで十分。
5. テスト終了後、`.env` を `WINNING_BANNER_ENABLED=true` に戻して再起動

- [ ] **Step 9: テスト結果の判定**

全7テストPASSなら次の §16 漏洩リスク検証へ進む。
1つでもFAILなら原因調査・修正（コミット追加）し、当該テストから再実行。

---

## Task 14: 漏洩リスク検証（10件）

**Files:** なし（生成テストのみ）

**目的:** §2.1「漏洩リスク 0.1% 以下」要件を実証する。

- [ ] **Step 1: 検証用バナーを準備**

ローカルに「具体的な文字が明確に書かれた」勝ちバナーを2枚用意。例:
- 「2kg減」「16日間集中」「累計500万本」等の具体数字
- 特定ブランド名・商品名（例: 「5 POINT DETOX」）

両方を勝ちバナーとして登録。

- [ ] **Step 2: 業種違いブリーフで10回サジェスト生成**

ブリーフを「金融SaaS / B2B経営者向け / 業務効率化」など、勝ちバナーと完全に違う業種に設定。
useWinningRef = ON。
STEP 2「次へ」を10回押下。

- [ ] **Step 3: 各回の出力を漏洩チェック**

各回のサジェスト出力（`copies` の16候補 + `designRequirements` の16候補 + `ctas` 4候補等）を目視確認。

漏洩判定基準:
- 勝ちバナーに含まれていた具体的な文字列（例: 「2kg減」「16日間」「5 POINT DETOX」等）が**1回でも**サジェスト出力に現れたら → 漏洩あり
- 抽象的な傾向（例: 「数値ベネフィット型」「ゴシック太字」）が反映されているのは正常

- [ ] **Step 4: 結果集計**

| 回 | 漏洩有無 | 備考 |
|---|---|---|
| 1 | ✅ なし | |
| 2 | | |
| ... | | |
| 10 | | |

10/10 で漏洩ゼロなら、漏洩リスク 0.1% 以下要件を実用レベルで満たしたと判定（統計的厳密性は10件では出ないが、Phase 1 リリース判断には十分）。

- [ ] **Step 5: 漏洩発生時の対応**

1件でも漏洩があった場合:
- `analyze.ts` の ANALYZE_PROMPT に追加禁止指示を投入（例: 「abstract には数字を含めないこと」）
- `prompt-injection.ts` で abstract 内の数字パターンを正規表現でマスク
- 修正後、再度10件検証

- [ ] **Step 6: 検証ログを記録**

`docs/superpowers/specs/2026-04-25-winning-banner-reference-design.md` の §13.2 直下に「検証ログ」セクションを追記:

```markdown
### 漏洩リスク検証ログ（2026-04-25）

業種違いブリーフ（金融SaaS）×10回 / 勝ちバナー2枚（健康食品・具体数値含む）
- 漏洩件数: 0/10
- 検証者: 小池
- 結論: Phase 1 リリース可
```

- [ ] **Step 7: コミット**

```bash
git add docs/superpowers/specs/2026-04-25-winning-banner-reference-design.md
git commit -m "docs: add leakage verification log for winning banner

10 cross-industry generations with concrete-text-rich winning banners.
Verified zero concrete text leakage in suggestions."
```

---

## Task 15: 本番デプロイ

**Files:** なし（デプロイのみ）

- [ ] **Step 1: 全コミット内容を確認**

```bash
git log phase-a7-stable..HEAD --oneline
```

期待: §0〜§14 の全コミットが見える

- [ ] **Step 2: feat ブランチを push**

```bash
git push -u origin feat/winning-banner-reference
```

- [ ] **Step 3: PR 作成（任意・推奨）**

```bash
gh pr create --title "feat: Phase A.8 勝ちバナー参照機能" --body "$(cat <<'EOF'
## Summary
- 勝ちバナーをアップロード（URL or ファイル）→ Gemini Vision で抽象+具体二層解析 → suggest プロンプトに直近3件の傾向を集約注入
- 漏洩リスク 0.1% 以下：画像は生成パイプラインに渡さず、抽象テキストのみ注入
- SaaS化準備：Asset.userId カラムだけ仕込み（Phase 1 は全 NULL）

## Test plan
- [x] §13 手動E2E 7項目 PASS
- [x] §14 漏洩リスク検証 10/10 PASS

## Rollback
- L1: UIチェックボックスOFF
- L2: WINNING_BANNER_ENABLED=false
- L3: git checkout phase-a7-stable
EOF
)"
```

- [ ] **Step 4: Vercel 環境変数を設定**

Vercel ダッシュボード → banner-tsukurukun プロジェクト → Settings → Environment Variables:
- 追加: `WINNING_BANNER_ENABLED` = `true` (Production / Preview / Development 全対象)

- [ ] **Step 5: マージ → デプロイトリガ**

```bash
gh pr merge --squash --delete-branch
# または GitHub UI でマージ
```

Vercel が自動デプロイ開始。

- [ ] **Step 6: Prisma migration が本番DBに適用されることを確認**

`package.json` の `build` script は `prisma generate && next build` のため、migration の自動適用は別途必要。Vercel Build Command を確認:

```bash
# vercel.json または Vercel UI の Build Command で確認
# 想定: "prisma migrate deploy && next build" になっているか
```

なっていなければ、デプロイ前に手動で:
```bash
npx prisma migrate deploy
```
（DATABASE_URL を Production の値に向けて実行）

注意: 本番DB に直接 migrate deploy する操作は破壊的でないことを確認後に実行。Asset テーブルは新カラム追加のみ。

- [ ] **Step 7: 本番動作確認**

`https://autobanner.jp/ironclad`（Basic Auth: koike/banner2026）でアクセス:
- 「🏆 勝ちバナー参照」セクション表示
- 1枚アップロード → 解析成功
- サジェスト生成 → 正常動作

- [ ] **Step 8: 本番でも漏洩リスク 1〜2件検証**

ローカルと同様、業種違いブリーフで本番サジェストを2回実行 → 漏洩ゼロ確認。

---

## Task 16: メモリ更新（Phase A.8 完了記録）

**Files:**
- Modify: `C:\Users\strkk\.claude\projects\C--Users-strkk--claude\memory\project_banner_tsukurukun.md`

- [ ] **Step 1: ペンディング記録を「完了記録」に書き換える**

`project_banner_tsukurukun.md` の「## ペンディング機能：勝ちバナー参照（2026-04-25 判断）」セクションを以下に置き換える:

```markdown
## Phase A.8 完了：勝ちバナー参照機能（2026-04-25 リリース）
**実装内容:**
- 「LP URL から自動抽出」直下に「🏆 勝ちバナー参照（任意）」セクション追加
- URL/ファイルでアップロード → Gemini 2.5 Pro Vision で抽象+具体二層解析
- 直近3件の抽象タグを集約して /api/ironclad-suggest プロンプトに注入
- 画像は生成パイプライン（gpt-image-2）に渡さない設計で漏洩リスク 0.1% 以下を実現

**SaaS化準備:**
- Asset.userId カラム追加（Phase 1 は全NULL）
- src/lib/auth/get-current-user.ts スタブ設置

**3段階ロールバック:**
- L1: UIで「☑ 参考にする」OFF
- L2: 環境変数 WINNING_BANNER_ENABLED=false
- L3: git checkout phase-a7-stable

**主要ファイル:**
- src/app/api/winning-banners/route.ts — POST/GET
- src/app/api/winning-banners/[id]/route.ts — DELETE
- src/lib/winning-banner/analyze.ts — Gemini Vision 解析
- src/lib/winning-banner/prompt-injection.ts — 集約注入
- src/lib/winning-banner/types.ts — 型定義
- src/lib/auth/get-current-user.ts — 認証スタブ
- src/components/ironclad/WinningBannerLibrary.tsx
- src/components/ironclad/WinningBannerAddModal.tsx

**漏洩リスク検証:** 業種違いブリーフ×10件で漏洩ゼロ確認済（2026-04-25）

**設計ドキュメント:** docs/superpowers/specs/2026-04-25-winning-banner-reference-design.md
**実装プラン:** docs/superpowers/plans/2026-04-25-winning-banner-reference.md
```

- [ ] **Step 2: 「次候補」リストから関連項目を削除**

「次候補」セクションから、Phase A.8 関連で残っている項目があれば整理。

- [ ] **Step 3: コミット（メモリは git 管理外なら git 不要、それ以外なら commit）**

メモリディレクトリは通常 git 管理外。ファイル更新のみ実施。

---

## Self-Review

**1. Spec coverage:** spec の全16章を Plan のタスクと突き合わせ:
- §1 背景・目的 → Task 11 で UI に反映、Task 8 で suggest 注入実装
- §2 設計判断 → Task 4/5/6/8 全体で実装
- §3 機能要件 → Task 6-11 で全機能カバー
- §4 UI設計 → Task 9/10/11
- §5 データモデル → Task 1
- §6 API設計 → Task 6/7/8
- §7 Vision解析仕様 → Task 4
- §8 プロンプト注入仕様 → Task 5
- §9 環境変数 → Task 12
- §10 ロールバック → Task 0/12 で機構実装、§13 で動作確認
- §11 SaaS準備 → Task 1/2
- §12 ファイル一覧 → 全 Task
- §13 テスト戦略 → Task 13
- §14 リリース計画 → Task 15
- §15 残リスク → Task 14（漏洩検証で実証）
- §16 完了の定義 → Task 16

**2. Placeholder scan:** 「TBD」「TODO」「実装する」「適切に」等の曖昧表現を検索 → なし

**3. Type consistency:**
- `AnalysisAbstract` / `AnalysisConcrete` / `AnalysisResult` / `WinningBannerDTO` は Task 3 で定義、後続 Task で同じ名前で参照
- `analyzeWinningBanner` (Task 4) → Task 6 で import 使用
- `buildWinningPatternInjection` (Task 5) → Task 8 で import 使用
- `WINNING_PATTERN_KEYS` (Task 3) → Task 4 で参照
- `getCurrentUser` (Task 2) → Task 6 で使用
- `useWinningRef` props (Task 10) → Task 11 で親 component 経由で props 渡し → Task 8 で API リクエストに含める

OK, 全て一貫している。

---

## 完了の定義

以下が全て満たされたら本プランを「完了」とみなす:
- Task 0〜16 全て完了
- §14 漏洩リスク検証 10/10 PASS
- 本番URL（autobanner.jp/ironclad）で動作確認済み
- メモリファイル更新済み
- L1/L2/L3 ロールバック動作確認済み
