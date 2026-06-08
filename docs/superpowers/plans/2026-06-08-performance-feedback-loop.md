# 配信成果フィードバックループ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成バナーをMeta広告に紐付け、日次でInsightsを蓄積し、週次でタグ×成果の勝ち要因を抽出して週一の自動生成プロンプトに注入する閉ループを実装する。

**Architecture:** banner-tsukurukun の Prisma に加算3テーブル（MetaAd / AdPerformanceSnapshot / WinningPattern）を追加。純ロジック（タグ抽出・勝ちスコア・Insights正規化）を `src/lib/feedback-loop/` に分離し vitest で TDD。紐付けAPI（C1）・日次Insights cron（C2）・週次抽出 cron（C3）を追加し、既存 batch-generate（C4）に勝ちパターン注入を `getRecentRejectReasons` と同型で組み込む。

**Tech Stack:** Next.js 16 (App Router) / Prisma 7 + @prisma/adapter-pg / Neon Postgres / Vercel Cron / Meta Graph Marketing API (Insights) / vitest（本計画で新規導入）/ zod

**Spec:** `docs/superpowers/specs/2026-06-08-performance-feedback-loop-design.md`

---

## 前提・規約（着手前に必読）

- DB アクセスは必ず `import { getPrisma } from '@/lib/prisma'` の `getPrisma()` 経由。`new PrismaClient()` 禁止。
- Cron route は `GET`、認証は `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` で 401。`export const runtime = 'nodejs'`。
- 外部（autopilot）からの POST 認証は既存 `verifyBatchGenerateAuth(req)`（`Bearer ${META_AUTOPILOT_API_KEY}`）を再利用。
- 新規 env（`.env` / Vercel Secrets。コード直書き禁止）:
  - `META_INSIGHTS_ACCESS_TOKEN` … Marketing API Standard Access トークン
  - `META_AD_ACCOUNT_ID` … 例 `1664983991362612`（act_ プレフィックスはコード側で付与）
  - `FEEDBACK_MIN_AD_COUNT`（既定 `3`）/ `FEEDBACK_MIN_CONVERSIONS`（既定 `10`）… 誤学習防止閾値
  - `FEEDBACK_SCORE_FORMULA`（既定 `cpa`。`ctr` / `roas` 切替用）
- テスト方針: **純ロジックは vitest で TDD**。DB upsert・route・外部 Insights fetch は test DB / Meta sandbox が未整備のため**統合/手動検証ステップ**で確認（コードベース現行慣習に準拠）。

---

## File Structure

新規 `src/lib/feedback-loop/`（純ロジック中心・各ファイル単一責務）:
- `types.ts` … 共有型（TagDim, InsightsRow, AggregatedTagStat, ScoredPattern）
- `tag-extract.ts` … briefSnapshot + GenerationImage → `TagDim[]`（純）
- `insights-normalize.ts` … Meta Insights 生レスポンス行 → `InsightsRow`（純）
- `insights-client.ts` … Graph API fetch（副作用。normalize を呼ぶ）
- `snapshot-upsert.ts` … `InsightsRow` → AdPerformanceSnapshot upsert（DB）
- `winning-score.ts` … `AggregatedTagStat[]` → `ScoredPattern[]`（純・閾値ガード・CPA主）
- `aggregate.ts` … snapshot+brief を窓集計 → winning-score → WinningPattern upsert（DB）
- `prompt-injection.ts` … 直近 WinningPattern → プロンプト接頭辞文字列（DB読み＋整形）
- `meta-ad-link.ts` … ad_id ↔ generationImageId を MetaAd へ記録（DB）

新規 API routes:
- `src/app/api/admin/meta-ad-link/route.ts` … C1（POST・autopilot 認証）
- `src/app/api/cron/ad-insights-daily/route.ts` … C2（GET・CRON_SECRET）
- `src/app/api/cron/winning-pattern-weekly/route.ts` … C3（GET・CRON_SECRET）

変更:
- `prisma/schema.prisma` … 3 モデル追加 + GenerationImage 逆リレーション
- `src/app/api/admin/batch-generate/route.ts` … C4 注入
- `vercel.json` … cron 2 本追加
- `package.json` … vitest devDep + `test` script

テスト:
- `tests/unit/feedback-loop/tag-extract.test.ts`
- `tests/unit/feedback-loop/winning-score.test.ts`
- `tests/unit/feedback-loop/insights-normalize.test.ts`
- `tests/unit/feedback-loop/prompt-injection.test.ts`

---

## Task 1: Prisma スキーマ加算（3モデル + 逆リレーション）

**Files:**
- Modify: `prisma/schema.prisma`（末尾に追加 + `GenerationImage` に1行）

- [ ] **Step 1: GenerationImage に逆リレーションを追加**

`model GenerationImage` の `createdAt DateTime @default(now())` の直後（`@@index` 群の前）に1行追加:

```prisma
  metaAds MetaAd[]
```

- [ ] **Step 2: スキーマ末尾に3モデルを追加**

`prisma/schema.prisma` の末尾に以下を追記:

```prisma
/// 配信成果フィードバックループ: 入稿された Meta 広告 ↔ 生成画像（1画像→N広告を許容）
model MetaAd {
  id                String   @id @default(cuid())
  adId              String   @unique
  adSetId           String?
  campaignId        String?
  adName            String?
  status            String?
  generationImageId String?
  generationImage   GenerationImage? @relation(fields: [generationImageId], references: [id], onDelete: SetNull)
  publishedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  snapshots         AdPerformanceSnapshot[]

  @@index([generationImageId])
  @@index([status])
}

/// 日次成果スナップショット（疲労検知・期間集計が可能）
model AdPerformanceSnapshot {
  id          String   @id @default(cuid())
  metaAdId    String
  metaAd      MetaAd   @relation(fields: [metaAdId], references: [id], onDelete: Cascade)
  statDate    DateTime @db.Date
  impressions Int      @default(0)
  clicks      Int      @default(0)
  spend       Decimal  @default(0) @db.Decimal(12, 2)
  conversions Int      @default(0)
  ctr         Decimal? @db.Decimal(8, 4)
  cpa         Decimal? @db.Decimal(12, 2)
  cpm         Decimal? @db.Decimal(12, 2)
  frequency   Decimal? @db.Decimal(8, 2)
  roas        Decimal? @db.Decimal(8, 2)
  raw         Json?
  createdAt   DateTime @default(now())

  @@unique([metaAdId, statDate])
  @@index([statDate])
}

/// 勝ち要因の集計結果（学習信号・監査ログ兼用）
model WinningPattern {
  id          String   @id @default(cuid())
  dimension   String
  value       String
  windowStart DateTime @db.Date
  windowEnd   DateTime @db.Date
  adCount     Int
  impressions Int
  conversions Int
  avgCtr      Decimal? @db.Decimal(8, 4)
  avgCpa      Decimal? @db.Decimal(12, 2)
  score       Decimal  @db.Decimal(8, 4)
  computedAt  DateTime @default(now())

  @@index([dimension, value, windowEnd])
}
```

- [ ] **Step 3: スキーマ検証**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: dev DB へマイグレーション**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx prisma migrate dev --name add_feedback_loop`
Expected: マイグレーション生成 + 適用成功、`prisma generate` 完了。
※ 本番反映は別途 `scripts/migrate-prod.mjs` 系で明示適用（MEMORY: Vercel build は migrate deploy 走らない）。計画末尾「本番適用」参照。

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add MetaAd/AdPerformanceSnapshot/WinningPattern for feedback loop"
```

---

## Task 2: vitest 導入（純ロジック TDD 基盤）

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/unit/feedback-loop/smoke.test.ts`

- [ ] **Step 1: vitest を devDependency に追加**

Run: `cd ~/claude_pjt/banner-tsukurukun && npm i -D vitest@^3`
Expected: インストール成功。

- [ ] **Step 2: package.json に test script 追加**

`scripts` に追加:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: vitest.config.ts を作成**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: スモークテスト作成**

`tests/unit/feedback-loop/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 実行して PASS 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npm test`
Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/unit/feedback-loop/smoke.test.ts
git commit -m "test: introduce vitest for feedback-loop pure logic"
```

---

## Task 3: 共有型 + タグ抽出（tag-extract）

**Files:**
- Create: `src/lib/feedback-loop/types.ts`
- Create: `src/lib/feedback-loop/tag-extract.ts`
- Test: `tests/unit/feedback-loop/tag-extract.test.ts`

- [ ] **Step 1: 共有型を作成**

`src/lib/feedback-loop/types.ts`:

```ts
/** タグ次元 v1 のキー */
export type TagDimension =
  | 'angleId'
  | 'ctaTemplateId'
  | 'urgency'
  | 'emphasisRatio'
  | 'priceBadge'
  | 'size'
  | 'provider';

/** 1 画像から抽出した (次元, 値) ペア */
export interface TagDim {
  dimension: TagDimension;
  value: string;
}

/** 正規化済み Insights 1 行（ad × 日） */
export interface InsightsRow {
  adId: string;
  statDate: string; // 'YYYY-MM-DD'
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number | null;
  cpa: number | null;
  cpm: number | null;
  frequency: number | null;
  roas: number | null;
  raw: unknown;
}

/** (次元, 値) ごとに窓集計した素データ */
export interface AggregatedTagStat {
  dimension: TagDimension;
  value: string;
  adCount: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

/** スコア付与後の勝ちパターン */
export interface ScoredPattern extends AggregatedTagStat {
  avgCtr: number | null;
  avgCpa: number | null;
  score: number; // 0..1（同一 dimension 内 min-max 正規化）
}
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/unit/feedback-loop/tag-extract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractTags } from '@/lib/feedback-loop/tag-extract';

describe('extractTags', () => {
  it('briefSnapshot と image から全次元を抽出する', () => {
    const brief = {
      angleId: 'benefit',
      ctaTemplateId: 'cta_buy_now',
      urgency: 'high',
      emphasisRatio: '3x',
      priceBadge: { type: 'discount' },
    };
    const tags = extractTags(brief, { size: '1080x1080', provider: 'gpt-image' });
    expect(tags).toEqual(
      expect.arrayContaining([
        { dimension: 'angleId', value: 'benefit' },
        { dimension: 'ctaTemplateId', value: 'cta_buy_now' },
        { dimension: 'urgency', value: 'high' },
        { dimension: 'emphasisRatio', value: '3x' },
        { dimension: 'priceBadge', value: 'present' },
        { dimension: 'size', value: '1080x1080' },
        { dimension: 'provider', value: 'gpt-image' },
      ]),
    );
  });

  it('priceBadge が null/未指定なら "absent" になる', () => {
    const tags = extractTags({ priceBadge: null }, { size: '1x1', provider: 'flux' });
    expect(tags).toContainEqual({ dimension: 'priceBadge', value: 'absent' });
  });

  it('欠損次元はスキップする（null/undefined を値にしない）', () => {
    const tags = extractTags({ angleId: 'fear' }, { size: '1x1', provider: 'flux' });
    expect(tags.find((t) => t.dimension === 'ctaTemplateId')).toBeUndefined();
    expect(tags.every((t) => typeof t.value === 'string' && t.value.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 3: 実行して FAIL 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/tag-extract.test.ts`
Expected: FAIL（`extractTags` is not a function / module not found）

- [ ] **Step 4: 実装**

`src/lib/feedback-loop/tag-extract.ts`:

```ts
import type { TagDim, TagDimension } from './types';

/** briefSnapshot から読む文字列次元（そのまま値として採用） */
const STRING_DIMS: TagDimension[] = ['angleId', 'ctaTemplateId', 'urgency', 'emphasisRatio'];

interface ImageMeta {
  size?: string | null;
  provider?: string | null;
}

/**
 * briefSnapshot（任意 JSON）と画像メタから タグ次元 v1 を抽出する。
 * - 文字列次元は値が非空ならそのまま採用
 * - priceBadge は有無を 'present' / 'absent' に正規化
 * - size / provider は画像メタから採用
 * 欠損（null/undefined/空文字）はスキップ。
 */
export function extractTags(brief: unknown, image: ImageMeta): TagDim[] {
  const b = (brief && typeof brief === 'object' ? brief : {}) as Record<string, unknown>;
  const out: TagDim[] = [];

  for (const dim of STRING_DIMS) {
    const v = b[dim];
    if (typeof v === 'string' && v.trim().length > 0) {
      out.push({ dimension: dim, value: v.trim() });
    }
  }

  // priceBadge: 値が存在すれば present、null/未指定/空文字なら absent
  const pb = b.priceBadge;
  const hasBadge =
    pb !== null &&
    pb !== undefined &&
    !(typeof pb === 'string' && pb.trim().length === 0);
  out.push({ dimension: 'priceBadge', value: hasBadge ? 'present' : 'absent' });

  if (typeof image.size === 'string' && image.size.length > 0) {
    out.push({ dimension: 'size', value: image.size });
  }
  if (typeof image.provider === 'string' && image.provider.length > 0) {
    out.push({ dimension: 'provider', value: image.provider });
  }

  return out;
}
```

- [ ] **Step 5: 実行して PASS 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/tag-extract.test.ts`
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add src/lib/feedback-loop/types.ts src/lib/feedback-loop/tag-extract.ts tests/unit/feedback-loop/tag-extract.test.ts
git commit -m "feat(feedback-loop): tag extraction from briefSnapshot (TDD)"
```

---

## Task 4: 勝ちスコア計算（winning-score・CPA主・閾値ガード）

**Files:**
- Create: `src/lib/feedback-loop/winning-score.ts`
- Test: `tests/unit/feedback-loop/winning-score.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/unit/feedback-loop/winning-score.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scorePatterns } from '@/lib/feedback-loop/winning-score';
import type { AggregatedTagStat } from '@/lib/feedback-loop/types';

const base = (over: Partial<AggregatedTagStat>): AggregatedTagStat => ({
  dimension: 'angleId',
  value: 'x',
  adCount: 5,
  impressions: 10000,
  clicks: 200,
  conversions: 50,
  spend: 50000,
  ...over,
});

describe('scorePatterns (CPA主)', () => {
  it('閾値未満(adCount<min または conversions<min)は除外する', () => {
    const stats = [
      base({ value: 'low_ads', adCount: 2, conversions: 50 }),
      base({ value: 'low_cv', adCount: 5, conversions: 3 }),
      base({ value: 'ok', adCount: 5, conversions: 50 }),
    ];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    expect(res.map((r) => r.value)).toEqual(['ok']);
  });

  it('CPAが低いほど score が高い（同一 dimension 内 min-max 正規化）', () => {
    const stats = [
      // CPA = spend/cv: good=500, bad=2000
      base({ value: 'good', spend: 50000, conversions: 100 }),
      base({ value: 'bad', spend: 100000, conversions: 50 }),
    ];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    const good = res.find((r) => r.value === 'good')!;
    const bad = res.find((r) => r.value === 'bad')!;
    expect(good.avgCpa).toBeCloseTo(500, 5);
    expect(bad.avgCpa).toBeCloseTo(2000, 5);
    expect(good.score).toBeCloseTo(1, 5);
    expect(bad.score).toBeCloseTo(0, 5);
  });

  it('avgCtr = clicks/impressions を計算する', () => {
    const stats = [base({ value: 'a', clicks: 300, impressions: 10000, conversions: 50, adCount: 5 })];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    expect(res[0].avgCtr).toBeCloseTo(0.03, 5);
  });

  it('単一値しかない dimension は score=1（min==max のとき）', () => {
    const stats = [base({ value: 'solo' })];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    expect(res[0].score).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: 実行して FAIL 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/winning-score.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**

`src/lib/feedback-loop/winning-score.ts`:

```ts
import type { AggregatedTagStat, ScoredPattern } from './types';

export type ScoreFormula = 'cpa' | 'ctr' | 'roas';

export interface ScoreOptions {
  minAdCount: number;
  minConversions: number;
  formula: ScoreFormula;
}

/** 高いほど良い metric を返す（CPA は逆数で「高いほど良い」へ統一） */
function rawMetric(s: AggregatedTagStat, formula: ScoreFormula): number {
  const ctr = s.impressions > 0 ? s.clicks / s.impressions : 0;
  const cpa = s.conversions > 0 ? s.spend / s.conversions : Infinity;
  switch (formula) {
    case 'ctr':
      return ctr;
    case 'roas':
      // spend あたり conversion 数を proxy とする（売上未取得のため CV/コスト）
      return s.spend > 0 ? s.conversions / s.spend : 0;
    case 'cpa':
    default:
      // CPA は低いほど良い → 逆数。CV0 は cpa=Inf → metric 0
      return cpa === Infinity ? 0 : 1 / cpa;
  }
}

/**
 * (次元,値) 集計に閾値ガードを適用し、同一 dimension 内で min-max 正規化した score を付与する。
 * - adCount < minAdCount または conversions < minConversions の行は除外（誤学習防止）
 * - score: 同一 dimension 内で rawMetric を 0..1 に正規化（min==max のときは 1）
 */
export function scorePatterns(
  stats: AggregatedTagStat[],
  opts: ScoreOptions,
): ScoredPattern[] {
  const eligible = stats.filter(
    (s) => s.adCount >= opts.minAdCount && s.conversions >= opts.minConversions,
  );

  // dimension ごとに rawMetric の min/max を求める
  const byDim = new Map<string, number[]>();
  for (const s of eligible) {
    const m = rawMetric(s, opts.formula);
    const arr = byDim.get(s.dimension) ?? [];
    arr.push(m);
    byDim.set(s.dimension, arr);
  }
  const range = new Map<string, { min: number; max: number }>();
  for (const [dim, arr] of byDim) {
    range.set(dim, { min: Math.min(...arr), max: Math.max(...arr) });
  }

  return eligible.map((s) => {
    const m = rawMetric(s, opts.formula);
    const { min, max } = range.get(s.dimension)!;
    const score = max === min ? 1 : (m - min) / (max - min);
    return {
      ...s,
      avgCtr: s.impressions > 0 ? s.clicks / s.impressions : null,
      avgCpa: s.conversions > 0 ? s.spend / s.conversions : null,
      score,
    };
  });
}
```

- [ ] **Step 4: 実行して PASS 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/winning-score.test.ts`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedback-loop/winning-score.ts tests/unit/feedback-loop/winning-score.test.ts
git commit -m "feat(feedback-loop): CPA-primary winning score with threshold gating (TDD)"
```

---

## Task 5: Insights 正規化 + クライアント（insights-normalize / insights-client）

**Files:**
- Create: `src/lib/feedback-loop/insights-normalize.ts`
- Create: `src/lib/feedback-loop/insights-client.ts`
- Test: `tests/unit/feedback-loop/insights-normalize.test.ts`

- [ ] **Step 1: 失敗するテストを書く（正規化の純ロジック）**

`tests/unit/feedback-loop/insights-normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeInsightsRow } from '@/lib/feedback-loop/insights-normalize';

describe('normalizeInsightsRow', () => {
  it('Graph API 行を InsightsRow に変換する', () => {
    const row = {
      ad_id: '120000111',
      date_start: '2026-06-01',
      impressions: '10000',
      clicks: '250',
      spend: '12345.67',
      ctr: '2.5',
      cpm: '1234.5',
      frequency: '1.8',
      actions: [
        { action_type: 'offsite_conversion.fb_pixel_purchase', value: '40' },
        { action_type: 'link_click', value: '250' },
      ],
    };
    const r = normalizeInsightsRow(row, 'offsite_conversion.fb_pixel_purchase');
    expect(r.adId).toBe('120000111');
    expect(r.statDate).toBe('2026-06-01');
    expect(r.impressions).toBe(10000);
    expect(r.clicks).toBe(250);
    expect(r.spend).toBeCloseTo(12345.67, 2);
    expect(r.conversions).toBe(40);
    expect(r.ctr).toBeCloseTo(0.025, 5); // Graph の % を比率へ
    expect(r.cpa).toBeCloseTo(12345.67 / 40, 2);
  });

  it('conversions アクションが無ければ 0、cpa は null', () => {
    const row = {
      ad_id: 'a',
      date_start: '2026-06-01',
      impressions: '100',
      clicks: '1',
      spend: '500',
    };
    const r = normalizeInsightsRow(row, 'offsite_conversion.fb_pixel_purchase');
    expect(r.conversions).toBe(0);
    expect(r.cpa).toBeNull();
  });
});
```

- [ ] **Step 2: 実行して FAIL 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/insights-normalize.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: 正規化を実装**

`src/lib/feedback-loop/insights-normalize.ts`:

```ts
import type { InsightsRow } from './types';

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

interface RawAction {
  action_type?: string;
  value?: string | number;
}

/**
 * Meta Graph Insights の 1 行（ad×日）を InsightsRow に正規化する。
 * - ctr は Graph が % なので /100 して比率に
 * - conversions は actions[] から指定 action_type の value を採用
 * - cpa = spend / conversions（conversions 0 のとき null）
 */
export function normalizeInsightsRow(
  row: Record<string, unknown>,
  conversionActionType: string,
): InsightsRow {
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const spend = num(row.spend);

  const actions = (Array.isArray(row.actions) ? row.actions : []) as RawAction[];
  const conv = actions.find((a) => a.action_type === conversionActionType);
  const conversions = conv ? num(conv.value) : 0;

  const ctrPct = row.ctr !== undefined ? num(row.ctr) : impressions > 0 ? (clicks / impressions) * 100 : 0;
  const ctr = ctrPct / 100;
  const cpm = row.cpm !== undefined ? num(row.cpm) : impressions > 0 ? (spend / impressions) * 1000 : null;
  const frequency = row.frequency !== undefined ? num(row.frequency) : null;
  const cpa = conversions > 0 ? spend / conversions : null;

  return {
    adId: String(row.ad_id ?? ''),
    statDate: String(row.date_start ?? ''),
    impressions,
    clicks,
    spend,
    conversions,
    ctr,
    cpa,
    cpm,
    frequency,
    roas: null, // 売上未取得。将来 purchase value 取得時に算出
    raw: row,
  };
}
```

- [ ] **Step 4: 実行して PASS 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/insights-normalize.test.ts`
Expected: `2 passed`

- [ ] **Step 5: Insights クライアント（副作用）を実装**

`src/lib/feedback-loop/insights-client.ts`:

```ts
import { normalizeInsightsRow } from './insights-normalize';
import type { InsightsRow } from './types';

const GRAPH_VERSION = 'v21.0';
const CONVERSION_ACTION_TYPE =
  process.env.FEEDBACK_CONVERSION_ACTION_TYPE ?? 'offsite_conversion.fb_pixel_purchase';

export class InsightsConfigError extends Error {}

/**
 * 指定日の ad 単位 Insights を取得して正規化行を返す。
 * @param dateYmd 'YYYY-MM-DD'（time_range の since/until を同日に設定 = その日の実績）
 * 設定不足（token/account 無し）は InsightsConfigError を投げる（cron 側で skip+log）。
 */
export async function fetchAdInsightsForDate(dateYmd: string): Promise<InsightsRow[]> {
  const token = process.env.META_INSIGHTS_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID;
  if (!token || !account) {
    throw new InsightsConfigError('META_INSIGHTS_ACCESS_TOKEN / META_AD_ACCOUNT_ID not set');
  }
  const actId = account.startsWith('act_') ? account : `act_${account}`;
  const fields = 'ad_id,impressions,clicks,spend,ctr,cpm,frequency,actions,date_start';
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateYmd, until: dateYmd }));

  const rows: InsightsRow[] = [];
  let url:
    | string
    | null = `https://graph.facebook.com/${GRAPH_VERSION}/${actId}/insights?level=ad&fields=${fields}&time_range=${timeRange}&limit=200&access_token=${token}`;

  // ページネーション（paging.next を辿る）
  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Insights API ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      data?: Record<string, unknown>[];
      paging?: { next?: string };
    };
    for (const row of json.data ?? []) {
      rows.push(normalizeInsightsRow(row, CONVERSION_ACTION_TYPE));
    }
    url = json.paging?.next ?? null;
  }
  return rows;
}
```

- [ ] **Step 6: 型チェック**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx tsc --noEmit`
Expected: エラーなし（feedback-loop 関連で型エラーが出ないこと）

- [ ] **Step 7: Commit**

```bash
git add src/lib/feedback-loop/insights-normalize.ts src/lib/feedback-loop/insights-client.ts tests/unit/feedback-loop/insights-normalize.test.ts
git commit -m "feat(feedback-loop): Meta Insights client + row normalization (TDD)"
```

---

## Task 6: スナップショット upsert（snapshot-upsert・DB）

**Files:**
- Create: `src/lib/feedback-loop/snapshot-upsert.ts`

- [ ] **Step 1: 実装**

`src/lib/feedback-loop/snapshot-upsert.ts`:

```ts
import { getPrisma } from '@/lib/prisma';
import type { InsightsRow } from './types';

export interface UpsertResult {
  matchedAds: number; // MetaAd が見つかり upsert した行数
  skippedNoAd: number; // 対応 MetaAd が無く skip した行数
}

/**
 * InsightsRow[] を AdPerformanceSnapshot に冪等 upsert する。
 * - adId → MetaAd を引き、無ければ skip（手動補完前提）
 * - @@unique([metaAdId, statDate]) により同日再実行で重複しない
 */
export async function upsertSnapshots(rows: InsightsRow[]): Promise<UpsertResult> {
  const prisma = getPrisma();
  let matchedAds = 0;
  let skippedNoAd = 0;

  for (const r of rows) {
    if (!r.adId || !r.statDate) {
      skippedNoAd++;
      continue;
    }
    const metaAd = await prisma.metaAd.findUnique({ where: { adId: r.adId } });
    if (!metaAd) {
      skippedNoAd++;
      continue;
    }
    const statDate = new Date(`${r.statDate}T00:00:00.000Z`);
    const data = {
      impressions: r.impressions,
      clicks: r.clicks,
      spend: r.spend,
      conversions: r.conversions,
      ctr: r.ctr ?? undefined,
      cpa: r.cpa ?? undefined,
      cpm: r.cpm ?? undefined,
      frequency: r.frequency ?? undefined,
      roas: r.roas ?? undefined,
      raw: r.raw as object,
    };
    await prisma.adPerformanceSnapshot.upsert({
      where: { metaAdId_statDate: { metaAdId: metaAd.id, statDate } },
      create: { metaAdId: metaAd.id, statDate, ...data },
      update: data,
    });
    matchedAds++;
  }
  return { matchedAds, skippedNoAd };
}
```

- [ ] **Step 2: 型チェック**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx tsc --noEmit`
Expected: エラーなし。`metaAdId_statDate` 複合ユニーク名が Prisma 生成型に存在すること（Task1 migrate 済が前提）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/feedback-loop/snapshot-upsert.ts
git commit -m "feat(feedback-loop): idempotent snapshot upsert keyed by (metaAd, statDate)"
```

---

## Task 7: 窓集計 + WinningPattern upsert（aggregate・DB）

**Files:**
- Create: `src/lib/feedback-loop/aggregate.ts`

- [ ] **Step 1: 実装**

`src/lib/feedback-loop/aggregate.ts`:

```ts
import { getPrisma } from '@/lib/prisma';
import { extractTags } from './tag-extract';
import { scorePatterns, type ScoreFormula } from './winning-score';
import type { AggregatedTagStat, TagDim } from './types';

export interface AggregateOptions {
  windowStart: Date; // 集計開始日（含む）
  windowEnd: Date; // 集計終了日（含む）
  minAdCount: number;
  minConversions: number;
  formula: ScoreFormula;
}

/** 環境変数からデフォルト ScoreFormula を読む */
export function defaultFormula(): ScoreFormula {
  const f = process.env.FEEDBACK_SCORE_FORMULA;
  return f === 'ctr' || f === 'roas' ? f : 'cpa';
}

/**
 * 窓内の snapshot を MetaAd→GenerationImage→Generation.briefSnapshot に辿り、
 * タグ次元ごとに成果を合算 → scorePatterns → WinningPattern upsert（窓単位で置換）。
 * 返り値は採用された WinningPattern 数。
 */
export async function aggregateWinningPatterns(opts: AggregateOptions): Promise<number> {
  const prisma = getPrisma();

  // 窓内 snapshot を MetaAd・GenerationImage・Generation 込みで取得
  const snapshots = await prisma.adPerformanceSnapshot.findMany({
    where: { statDate: { gte: opts.windowStart, lte: opts.windowEnd } },
    include: {
      metaAd: {
        include: {
          generationImage: { include: { generation: true } },
        },
      },
    },
  });

  // (dimension|value) ごとに成果を合算。adId 集合で adCount を数える。
  const acc = new Map<
    string,
    AggregatedTagStat & { _ads: Set<string> }
  >();

  for (const s of snapshots) {
    const gi = s.metaAd.generationImage;
    if (!gi || !gi.generation) continue;
    const brief = gi.generation.briefSnapshot;
    const tags: TagDim[] = extractTags(brief, { size: gi.size, provider: gi.provider });

    for (const t of tags) {
      const key = `${t.dimension}|${t.value}`;
      const cur =
        acc.get(key) ??
        ({
          dimension: t.dimension,
          value: t.value,
          adCount: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          _ads: new Set<string>(),
        } as AggregatedTagStat & { _ads: Set<string> });
      cur.impressions += s.impressions;
      cur.clicks += s.clicks;
      cur.conversions += s.conversions;
      cur.spend += Number(s.spend);
      cur._ads.add(s.metaAdId);
      acc.set(key, cur);
    }
  }

  const stats: AggregatedTagStat[] = [...acc.values()].map((a) => ({
    dimension: a.dimension,
    value: a.value,
    adCount: a._ads.size,
    impressions: a.impressions,
    clicks: a.clicks,
    conversions: a.conversions,
    spend: a.spend,
  }));

  const scored = scorePatterns(stats, {
    minAdCount: opts.minAdCount,
    minConversions: opts.minConversions,
    formula: opts.formula,
  });

  // 同一窓の既存を削除してから insert（窓単位で置換 = 冪等）
  await prisma.winningPattern.deleteMany({
    where: { windowStart: opts.windowStart, windowEnd: opts.windowEnd },
  });
  if (scored.length > 0) {
    await prisma.winningPattern.createMany({
      data: scored.map((p) => ({
        dimension: p.dimension,
        value: p.value,
        windowStart: opts.windowStart,
        windowEnd: opts.windowEnd,
        adCount: p.adCount,
        impressions: p.impressions,
        conversions: p.conversions,
        avgCtr: p.avgCtr ?? undefined,
        avgCpa: p.avgCpa ?? undefined,
        score: p.score,
      })),
    });
  }
  return scored.length;
}
```

- [ ] **Step 2: 型チェック**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 3: Commit**

```bash
git add src/lib/feedback-loop/aggregate.ts
git commit -m "feat(feedback-loop): aggregate snapshots by tag and upsert WinningPattern"
```

---

## Task 8: C1 紐付け API（meta-ad-link）

**Files:**
- Create: `src/lib/feedback-loop/meta-ad-link.ts`
- Create: `src/app/api/admin/meta-ad-link/route.ts`

- [ ] **Step 1: 紐付けヘルパーを実装**

`src/lib/feedback-loop/meta-ad-link.ts`:

```ts
import { getPrisma } from '@/lib/prisma';

export interface MetaAdLinkInput {
  adId: string;
  generationImageId?: string | null;
  adSetId?: string | null;
  campaignId?: string | null;
  adName?: string | null;
  status?: string | null;
  publishedAt?: string | null; // ISO
}

/** adId 一意で MetaAd を upsert（再入稿・更新に冪等） */
export async function recordMetaAd(input: MetaAdLinkInput) {
  const prisma = getPrisma();
  const data = {
    generationImageId: input.generationImageId ?? null,
    adSetId: input.adSetId ?? null,
    campaignId: input.campaignId ?? null,
    adName: input.adName ?? null,
    status: input.status ?? null,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
  };
  return prisma.metaAd.upsert({
    where: { adId: input.adId },
    create: { adId: input.adId, ...data },
    update: data,
  });
}
```

- [ ] **Step 2: API route を実装**

`src/app/api/admin/meta-ad-link/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyBatchGenerateAuth } from '@/lib/batch-generate/auth';
import { recordMetaAd } from '@/lib/feedback-loop/meta-ad-link';

export const runtime = 'nodejs';

const schema = z.object({
  adId: z.string().min(1),
  generationImageId: z.string().min(1).nullable().optional(),
  adSetId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  adName: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

/** C1: meta-ads-autopilot が入稿直後に ad_id ↔ generationImageId を登録する */
export async function POST(req: Request): Promise<Response> {
  if (!verifyBatchGenerateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const ad = await recordMetaAd(parsed.data);
    return NextResponse.json({ ok: true, id: ad.id, adId: ad.adId });
  } catch (e) {
    console.error('[meta-ad-link] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: 型チェック + lint**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx tsc --noEmit && npm run lint`
Expected: エラーなし。

- [ ] **Step 4: 手動検証（ローカル）**

Run（別ターミナルで `npm run dev` 起動後）:
```bash
curl -s -X POST http://localhost:3000/api/admin/meta-ad-link \
  -H "Authorization: Bearer $META_AUTOPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"adId":"test_ad_1","status":"active"}'
```
Expected: `{"ok":true,"id":"...","adId":"test_ad_1"}`。認証無しは 401。

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedback-loop/meta-ad-link.ts src/app/api/admin/meta-ad-link/route.ts
git commit -m "feat(feedback-loop): C1 meta-ad-link API to record ad_id <-> image"
```

---

## Task 9: C2 日次 Insights cron（ad-insights-daily）

**Files:**
- Create: `src/app/api/cron/ad-insights-daily/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: cron route を実装**

`src/app/api/cron/ad-insights-daily/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { fetchAdInsightsForDate, InsightsConfigError } from '@/lib/feedback-loop/insights-client';
import { upsertSnapshots } from '@/lib/feedback-loop/snapshot-upsert';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 前日(JST想定)の ad 単位 Insights を取得して snapshot 化。"0 23 * * *"(UTC)=JST 8:00 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // 前日の日付（UTC基準で1日前。JST厳密化は将来）
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ymd = d.toISOString().slice(0, 10);
  try {
    const rows = await fetchAdInsightsForDate(ymd);
    const result = await upsertSnapshots(rows);
    return NextResponse.json({ ok: true, date: ymd, fetched: rows.length, ...result });
  } catch (e) {
    if (e instanceof InsightsConfigError) {
      // 設定不足はループを止めない（warn して 200 で抜ける）
      console.warn('[cron/ad-insights-daily] skipped:', e.message);
      return NextResponse.json({ ok: true, skipped: true, reason: e.message });
    }
    console.error('[cron/ad-insights-daily] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
```

- [ ] **Step 2: vercel.json に cron 追加**

`vercel.json` の `crons` 配列に追加（既存 kpi-daily と同じ `0 23 * * *`）:

```json
    {
      "path": "/api/cron/ad-insights-daily",
      "schedule": "0 23 * * *"
    }
```

- [ ] **Step 3: 型チェック**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 4: 手動検証（ローカル）**

Run（`npm run dev` 起動後・`CRON_SECRET` を .env に設定）:
```bash
curl -s http://localhost:3000/api/cron/ad-insights-daily -H "Authorization: Bearer $CRON_SECRET"
```
Expected: token 未設定環境なら `{"ok":true,"skipped":true,...}`。設定済みなら `{"ok":true,"date":"...","fetched":N,"matchedAds":M,...}`。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/ad-insights-daily/route.ts vercel.json
git commit -m "feat(feedback-loop): C2 daily ad-insights cron"
```

---

## Task 10: C3 週次 WinningPattern 抽出 cron（winning-pattern-weekly）

**Files:**
- Create: `src/app/api/cron/winning-pattern-weekly/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: cron route を実装**

`src/app/api/cron/winning-pattern-weekly/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { aggregateWinningPatterns, defaultFormula } from '@/lib/feedback-loop/aggregate';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 直近7日を集計して WinningPattern を更新。"0 0 * * 1"(UTC月曜)=JST月曜9:00 */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const end = new Date(Date.now() - 24 * 60 * 60 * 1000); // 昨日
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000); // 7日窓
  const windowStart = new Date(start.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const windowEnd = new Date(end.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  try {
    const count = await aggregateWinningPatterns({
      windowStart,
      windowEnd,
      minAdCount: Number(process.env.FEEDBACK_MIN_AD_COUNT ?? '3'),
      minConversions: Number(process.env.FEEDBACK_MIN_CONVERSIONS ?? '10'),
      formula: defaultFormula(),
    });
    return NextResponse.json({
      ok: true,
      windowStart: windowStart.toISOString().slice(0, 10),
      windowEnd: windowEnd.toISOString().slice(0, 10),
      patterns: count,
    });
  } catch (e) {
    console.error('[cron/winning-pattern-weekly] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
```

- [ ] **Step 2: vercel.json に cron 追加**

`crons` 配列に追加（月曜 UTC 0:00 = 既存 kpi-weekly と同枠）:

```json
    {
      "path": "/api/cron/winning-pattern-weekly",
      "schedule": "0 0 * * 1"
    }
```

- [ ] **Step 3: 型チェック**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 4: 手動検証（ローカル）**

Run:
```bash
curl -s http://localhost:3000/api/cron/winning-pattern-weekly -H "Authorization: Bearer $CRON_SECRET"
```
Expected: `{"ok":true,"windowStart":"...","windowEnd":"...","patterns":N}`（データ無しなら N=0）。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/winning-pattern-weekly/route.ts vercel.json
git commit -m "feat(feedback-loop): C3 weekly winning-pattern aggregation cron"
```

---

## Task 11: C4 プロンプト注入（prompt-injection + batch-generate 組込み）

**Files:**
- Create: `src/lib/feedback-loop/prompt-injection.ts`
- Test: `tests/unit/feedback-loop/prompt-injection.test.ts`
- Modify: `src/app/api/admin/batch-generate/route.ts`

- [ ] **Step 1: 失敗するテストを書く（整形は純ロジックとして切り出す）**

`tests/unit/feedback-loop/prompt-injection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatWinningPatternsPrefix } from '@/lib/feedback-loop/prompt-injection';

describe('formatWinningPatternsPrefix', () => {
  it('勝ちパターンを日本語の指示文に整形する', () => {
    const prefix = formatWinningPatternsPrefix([
      { dimension: 'angleId', value: 'benefit', score: 0.95 },
      { dimension: 'urgency', value: 'high', score: 0.8 },
    ]);
    expect(prefix).toContain('benefit');
    expect(prefix).toContain('urgency');
    expect(prefix.length).toBeGreaterThan(0);
  });

  it('空配列なら空文字を返す（プロンプトを汚さない）', () => {
    expect(formatWinningPatternsPrefix([])).toBe('');
  });

  it('score>=0.5 のみ採用する（弱い要因は注入しない）', () => {
    const prefix = formatWinningPatternsPrefix([
      { dimension: 'angleId', value: 'weak', score: 0.2 },
    ]);
    expect(prefix).toBe('');
  });
});
```

- [ ] **Step 2: 実行して FAIL 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/prompt-injection.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: prompt-injection を実装**

`src/lib/feedback-loop/prompt-injection.ts`:

```ts
import { getPrisma } from '@/lib/prisma';

export interface WinningHint {
  dimension: string;
  value: string;
  score: number;
}

const MIN_SCORE = 0.5;

/** 勝ちヒント配列 → 生成プロンプトに前置する日本語指示文（純ロジック） */
export function formatWinningPatternsPrefix(hints: WinningHint[]): string {
  const strong = hints.filter((h) => h.score >= MIN_SCORE);
  if (strong.length === 0) return '';
  const lines = strong
    .sort((a, b) => b.score - a.score)
    .map((h) => `- ${h.dimension}: ${h.value}（実績スコア ${h.score.toFixed(2)}）`);
  return [
    '【過去配信の勝ち要因（成果データに基づく。優先的に踏襲すること）】',
    ...lines,
    '',
  ].join('\n');
}

/** 最新窓の WinningPattern を読み、各 dimension のトップ値を返す */
export async function getLatestWinningHints(limitPerDim = 1): Promise<WinningHint[]> {
  const prisma = getPrisma();
  const latest = await prisma.winningPattern.findFirst({ orderBy: { windowEnd: 'desc' } });
  if (!latest) return [];
  const rows = await prisma.winningPattern.findMany({
    where: { windowEnd: latest.windowEnd },
    orderBy: { score: 'desc' },
  });
  const seen = new Map<string, number>();
  const out: WinningHint[] = [];
  for (const r of rows) {
    const n = seen.get(r.dimension) ?? 0;
    if (n >= limitPerDim) continue;
    seen.set(r.dimension, n + 1);
    out.push({ dimension: r.dimension, value: r.value, score: Number(r.score) });
  }
  return out;
}
```

- [ ] **Step 4: 実行して PASS 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/prompt-injection.test.ts`
Expected: `3 passed`

- [ ] **Step 5: batch-generate に注入を組み込む**

`src/app/api/admin/batch-generate/route.ts` を編集:

(a) import 群の末尾（`filterAvailableUrls` import の直後）に追加:

```ts
import { getLatestWinningHints, formatWinningPatternsPrefix } from '@/lib/feedback-loop/prompt-injection';
```

(b) 既存の `getRecentRejectReasons` を呼んでいる箇所の近く（プロンプト生成ループの前）で勝ちヒントを取得。
`getRecentRejectReasons` の呼び出し直後に以下を追加:

```ts
  // C4: 過去配信の勝ち要因をプロンプトへ前置（成果フィードバック）
  let winningPrefix = '';
  try {
    const hints = await getLatestWinningHints();
    winningPrefix = formatWinningPatternsPrefix(hints);
  } catch (e) {
    console.warn('[batch-generate] winning hints unavailable:', e);
  }
```

(c) `buildIroncladImagePromptWithPrefix(...)` を呼んでいる箇所で、既存 prefix（reject 由来）に `winningPrefix` を連結する。
既存呼び出しの prefix 引数を `` `${winningPrefix}${existingPrefix}` `` の形に変更する。
（注: 既存の prefix 変数名は route.ts 内の実装に合わせる。reject reasons を整形した文字列に winningPrefix を前置するだけ。）

- [ ] **Step 6: 型チェック + lint + 全テスト**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx tsc --noEmit && npm run lint && npm test`
Expected: 型エラーなし / lint パス / 全 vitest パス。

- [ ] **Step 7: 手動検証（ローカル）**

`WinningPattern` に1件以上ある状態で batch-generate を呼び、生成プロンプト（route 内 console.log かレスポンス）に勝ち要因の前置が含まれることを確認。データ無しなら従来通り（前置なし）動作すること。

- [ ] **Step 8: Commit**

```bash
git add src/lib/feedback-loop/prompt-injection.ts tests/unit/feedback-loop/prompt-injection.test.ts src/app/api/admin/batch-generate/route.ts
git commit -m "feat(feedback-loop): C4 inject winning patterns into batch-generate prompt"
```

---

## Task 12（任意）: C5 疲労即停止 cron（ad-fatigue-daily）

> スコープ外でも可。生成は週一だが、疲労広告の停止は日次の価値があるため独立実装。

**Files:**
- Create: `src/lib/feedback-loop/fatigue.ts`
- Create: `src/app/api/cron/ad-fatigue-daily/route.ts`
- Modify: `vercel.json`
- Test: `tests/unit/feedback-loop/fatigue.test.ts`

- [ ] **Step 1: 失敗するテスト（疲労判定の純ロジック）**

`tests/unit/feedback-loop/fatigue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isFatigued } from '@/lib/feedback-loop/fatigue';

describe('isFatigued', () => {
  it('frequency>2.5 で疲労', () => {
    expect(isFatigued({ ctrToday: 0.02, ctrPeak: 0.025, frequency: 2.6, cpmToday: 1000, cpmBaseline: 1000 })).toBe(true);
  });
  it('CTRがピークから30%超低下で疲労', () => {
    expect(isFatigued({ ctrToday: 0.01, ctrPeak: 0.02, frequency: 1.5, cpmToday: 1000, cpmBaseline: 1000 })).toBe(true);
  });
  it('CPMがベースライン+40%超で疲労', () => {
    expect(isFatigued({ ctrToday: 0.02, ctrPeak: 0.02, frequency: 1.5, cpmToday: 1500, cpmBaseline: 1000 })).toBe(true);
  });
  it('健全なら false', () => {
    expect(isFatigued({ ctrToday: 0.02, ctrPeak: 0.021, frequency: 1.5, cpmToday: 1050, cpmBaseline: 1000 })).toBe(false);
  });
});
```

- [ ] **Step 2: 実行して FAIL 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/fatigue.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: 疲労判定を実装**

`src/lib/feedback-loop/fatigue.ts`:

```ts
export interface FatigueInput {
  ctrToday: number;
  ctrPeak: number;
  frequency: number;
  cpmToday: number;
  cpmBaseline: number;
}

/** Meta 一般則: CTRピーク比 -30% / frequency>2.5 / CPMベースライン比 +40% のいずれかで疲労 */
export function isFatigued(i: FatigueInput): boolean {
  if (i.frequency > 2.5) return true;
  if (i.ctrPeak > 0 && i.ctrToday <= i.ctrPeak * 0.7) return true;
  if (i.cpmBaseline > 0 && i.cpmToday >= i.cpmBaseline * 1.4) return true;
  return false;
}
```

- [ ] **Step 4: 実行して PASS 確認**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx vitest run tests/unit/feedback-loop/fatigue.test.ts`
Expected: `4 passed`

- [ ] **Step 5: cron route 実装（停止は手動承認前提で「検知して通知」に留める）**

`src/app/api/cron/ad-fatigue-daily/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { isFatigued } from '@/lib/feedback-loop/fatigue';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 疲労広告を検知してリストを返す（自動停止はせず通知に留める=景表法/運用安全）。"0 23 * * *" */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const prisma = getPrisma();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const ads = await prisma.metaAd.findMany({
    where: { status: 'active' },
    include: { snapshots: { where: { statDate: { gte: since } }, orderBy: { statDate: 'asc' } } },
  });
  const fatigued: { adId: string; adName: string | null }[] = [];
  for (const ad of ads) {
    if (ad.snapshots.length < 2) continue;
    const ctrs = ad.snapshots.map((s) => Number(s.ctr ?? 0));
    const cpms = ad.snapshots.map((s) => Number(s.cpm ?? 0));
    const today = ad.snapshots[ad.snapshots.length - 1];
    if (
      isFatigued({
        ctrToday: Number(today.ctr ?? 0),
        ctrPeak: Math.max(...ctrs),
        frequency: Number(today.frequency ?? 0),
        cpmToday: Number(today.cpm ?? 0),
        cpmBaseline: cpms.length ? cpms.reduce((a, b) => a + b, 0) / cpms.length : 0,
      })
    ) {
      fatigued.push({ adId: ad.adId, adName: ad.adName });
    }
  }
  return NextResponse.json({ ok: true, fatiguedCount: fatigued.length, fatigued });
};
```

- [ ] **Step 6: vercel.json に cron 追加**

```json
    {
      "path": "/api/cron/ad-fatigue-daily",
      "schedule": "0 23 * * *"
    }
```

- [ ] **Step 7: 型チェック + 全テスト**

Run: `cd ~/claude_pjt/banner-tsukurukun && npx tsc --noEmit && npm test`
Expected: エラーなし / 全パス。

- [ ] **Step 8: Commit**

```bash
git add src/lib/feedback-loop/fatigue.ts src/app/api/cron/ad-fatigue-daily/route.ts tests/unit/feedback-loop/fatigue.test.ts vercel.json
git commit -m "feat(feedback-loop): C5 daily fatigue detection cron (notify-only)"
```

---

## 本番適用（全タスク完了後）

- [ ] **Step 1: 本番マイグレーション**

MEMORY 準拠: Vercel build は `migrate deploy` を走らせないため明示適用。
Run: `cd ~/claude_pjt/banner-tsukurukun && node scripts/migrate-prod.mjs`（既存運用スクリプト）
Expected: `add_feedback_loop` が本番 Neon に適用される。

- [ ] **Step 2: Vercel 環境変数を登録**

`scripts/vercel-set-env.mjs`（既存）で以下を production に設定:
`META_INSIGHTS_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` / `FEEDBACK_MIN_AD_COUNT` / `FEEDBACK_MIN_CONVERSIONS` / `FEEDBACK_SCORE_FORMULA`（任意: `FEEDBACK_CONVERSION_ACTION_TYPE`）。
`CRON_SECRET` / `META_AUTOPILOT_API_KEY` は既存を流用。

- [ ] **Step 3: デプロイ + cron 確認**

空コミット push でデプロイ → Vercel ダッシュボードで cron 3本（ad-insights-daily / winning-pattern-weekly /〔任意〕ad-fatigue-daily）が登録されたことを確認。

- [ ] **Step 4: meta-ads-autopilot 側の C1 連携（別リポジトリ）**

`~/claude_pjt/meta-ads-autopilot` の入稿処理で、入稿成功後に `/api/admin/meta-ad-link` を
`adId` と（生成元の）`generationImageId` 付きで POST するよう改修。
※ generationImageId を autopilot が保持していない場合、batch-generate レスポンスの `generationId` から
画像を引く経路が必要。これは別計画（meta-ads-autopilot 側）として切り出す。

---

## Self-Review 結果

- **Spec coverage:** スキーマ3表(Task1) / タグ次元v1(Task3) / 勝ちスコアCPA主+閾値(Task4) / Insights取得(Task5) / 日次snapshot(Task6,9) / 週次集計(Task7,10) / C4注入(Task11) / C5疲労(Task12) / cadence(各cron schedule) / 不可逆性根拠(Task1注記) — 全カバー。
- **Placeholder scan:** コードは全て実体記載。唯一 Task11 Step5(c) は既存 route.ts の prefix 変数名が実装依存のため「連結する」と記述（実コード提示済み、変数名のみ現物合わせ）。実行時に該当行を確認のこと。
- **Type consistency:** `TagDim`/`InsightsRow`/`AggregatedTagStat`/`ScoredPattern`(types.ts) を全タスクで一貫使用。`scorePatterns`/`extractTags`/`normalizeInsightsRow`/`upsertSnapshots`/`aggregateWinningPatterns`/`recordMetaAd`/`fetchAdInsightsForDate`/`getLatestWinningHints`/`formatWinningPatternsPrefix`/`isFatigued` のシグネチャは定義と呼出で一致。
- **既知の前提:** vitest 未導入のため Task2 で導入。DB/route/外部APIは test DB 未整備により手動/統合検証（コードベース慣習準拠）。
