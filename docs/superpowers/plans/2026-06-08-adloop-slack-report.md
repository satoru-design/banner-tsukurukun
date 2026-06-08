# AdLoop 週次/月次 Slack レポート Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** AdLoop の配信成果を Slack に可視化する。週次=勝ち要因(CPA/CPC/CTR)+疲労+示唆、および週次16週/月次6ヶ月のスナップショット（banner自完結）。

**Architecture:** WinningPattern に clicks/spend/avgCpc を加算。純ロジック（avgCpc・スナップ集計・文面整形）を vitest TDD。Slack 送信は新 `src/lib/slack/ad-report.ts`（専用 webhook + フォールバック）。既存 winning-pattern-weekly cron に週次送信を相乗り、月次は新 cron。

**Tech Stack:** Next.js 16 / Prisma 7 / Vercel Cron / Slack Incoming Webhook / vitest

**Spec:** `docs/superpowers/specs/2026-06-08-adloop-slack-report-design.md`

## 前提・規約
- DB は `getPrisma()`。cron は `Bearer ${CRON_SECRET}`、`runtime='nodejs'`。
- 新 env: `SLACK_WEBHOOK_URL_AD_REPORT`（未設定時 `SLACK_WEBHOOK_URL_NEW_USER` にフォールバック）。
- kpi-summary.ts の整形ヘルパーは private なので**触らない**。AdLoop 用の小さな整形 util を新設（最小限の重複を許容し既存を破壊しない）。
- 純ロジックは vitest TDD。DB/POST は tsc + 手動。
- マイグレーションは**実DB非接続**：main↔branch schema diff でオフライン生成、本番適用は `migrate-prod.mjs`。

---

## Task R1: WinningPattern に clicks/spend/avgCpc 加算 + マイグレーション

**Files:** Modify `prisma/schema.prisma`; create migration dir.

- [ ] **Step 1: schema 編集**

`model WinningPattern` の `conversions Int` 行の直後に追加:
```prisma
  clicks      Int      @default(0)
  spend       Decimal  @default(0) @db.Decimal(12, 2)
```
`avgCpa Decimal? @db.Decimal(12, 2)` 行の直後に追加:
```prisma
  avgCpc      Decimal? @db.Decimal(12, 2)
```

- [ ] **Step 2: validate + generate**

PowerShell（1行ずつ）:
```
npx prisma validate
npx prisma generate
```
Expected: valid + Generated。**DB 接続コマンド禁止**（migrate dev/deploy/db push 禁止）。

- [ ] **Step 3: オフライン migration 生成**

```
git show main:prisma/schema.prisma > $env:TEMP\old-schema-r1.prisma
```
（注: この時点で main には clicks/spend/avgCpc が無い＝差分が出る。もし feat ブランチが既にこれらを含む形で main 化されていたら差分は空になる。）
さらに（bash 環境なら）タイムスタンプ付きディレクトリを作り、diff SQL を書き出す:
```
TS=$(date +%Y%m%d%H%M%S)
DIR="prisma/migrations/${TS}_add_winning_pattern_cpc"
mkdir -p "$DIR"
npx prisma migrate diff --from-schema /tmp/old-schema-r1.prisma --to-schema prisma/schema.prisma --script 2>/dev/null | grep -v "Loaded Prisma config" > "$DIR/migration.sql"
```
生成 SQL は `ALTER TABLE "WinningPattern" ADD COLUMN ...` のみ（加算）であることを確認。`error`/`Loaded` 文字列が無いこと（`grep -ci` で 0）。

- [ ] **Step 4: Commit**
```
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add clicks/spend/avgCpc to WinningPattern for CPC reporting"
```

---

## Task R2: winning-score に avgCpc 追加（TDD）

**Files:** Modify `src/lib/feedback-loop/types.ts`, `src/lib/feedback-loop/winning-score.ts`; Modify test `tests/unit/feedback-loop/winning-score.test.ts`.

- [ ] **Step 1: 型に avgCpc 追加**

`types.ts` の `ScoredPattern` に1行追加（`avgCpa: number | null;` の直後）:
```ts
  avgCpc: number | null;
```

- [ ] **Step 2: 失敗テスト追加**

`winning-score.test.ts` の `describe` 内に追加:
```ts
  it('avgCpc = spend/clicks を計算する（clicks 0 で null）', () => {
    const stats = [
      base({ value: 'a', spend: 38000, clicks: 1000, conversions: 50, adCount: 5 }),
      base({ value: 'b', spend: 100, clicks: 0, conversions: 50, adCount: 5 }),
    ];
    const res = scorePatterns(stats, { minAdCount: 3, minConversions: 10, formula: 'cpa' });
    const a = res.find((r) => r.value === 'a')!;
    const b = res.find((r) => r.value === 'b')!;
    expect(a.avgCpc).toBeCloseTo(38, 5);
    expect(b.avgCpc).toBeNull();
  });
```

- [ ] **Step 3: 実行して FAIL 確認**

`npx vitest run tests/unit/feedback-loop/winning-score.test.ts`
Expected: 新テストが avgCpc undefined で FAIL。

- [ ] **Step 4: 実装**

`winning-score.ts` の最終 `return withMetric.map(...)` の返却オブジェクトに1行追加（`avgCpa:` の直後）:
```ts
      avgCpc: s.clicks > 0 ? s.spend / s.clicks : null,
```

- [ ] **Step 5: 実行して PASS 確認**

`npx vitest run tests/unit/feedback-loop/winning-score.test.ts` → 全 PASS（既存 + 新規）。

- [ ] **Step 6: Commit**
```
git add src/lib/feedback-loop/types.ts src/lib/feedback-loop/winning-score.ts tests/unit/feedback-loop/winning-score.test.ts
git commit -m "feat(feedback-loop): add avgCpc to scored pattern (TDD)"
```

---

## Task R3: aggregate で clicks/spend/avgCpc を永続化

**Files:** Modify `src/lib/feedback-loop/aggregate.ts`.

- [ ] **Step 1: createMany に3フィールド追加**

`aggregate.ts` の `prisma.winningPattern.createMany({ data: scored.map((p) => ({ ... }))})` 内、`conversions: p.conversions,` の直後に追加:
```ts
        clicks: p.clicks,
        spend: p.spend,
```
`avgCpa: p.avgCpa ?? undefined,` の直後に追加:
```ts
        avgCpc: p.avgCpc ?? undefined,
```
（`p` は ScoredPattern。clicks/spend は AggregatedTagStat 由来で既に存在、avgCpc は R2 で追加済。）

- [ ] **Step 2: 型チェック**

`npx tsc --noEmit` → エラーなし（WinningPattern createMany が clicks/spend/avgCpc を受理）。R1 の prisma generate 済が前提。

- [ ] **Step 3: 全テスト**

`npx vitest run` → 既存全 PASS。

- [ ] **Step 4: Commit**
```
git add src/lib/feedback-loop/aggregate.ts
git commit -m "feat(feedback-loop): persist clicks/spend/avgCpc in WinningPattern"
```

---

## Task R4: detectFatiguedAds 抽出（共通化）

**Files:** Create `src/lib/feedback-loop/fatigue-query.ts`; Modify `src/app/api/cron/ad-fatigue-daily/route.ts`.

- [ ] **Step 1: 共通関数を作成**

`src/lib/feedback-loop/fatigue-query.ts`:
```ts
import { getPrisma } from '@/lib/prisma';
import { isFatigued } from './fatigue';

export interface FatiguedAd {
  adId: string;
  adName: string | null;
  /** 判定理由（表示用）: 'frequency' | 'ctr_drop' | 'cpm_rise' */
  reason: 'frequency' | 'ctr_drop' | 'cpm_rise';
  detail: string; // 例 'CTRピーク比 -38%' / 'frequency 2.8'
}

/**
 * status='active' の MetaAd を直近14日 snapshot から疲労判定する。
 * 自動停止はしない（通知用）。snapshot 2件未満の広告はスキップ。
 */
export async function detectFatiguedAds(): Promise<FatiguedAd[]> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const ads = await prisma.metaAd.findMany({
    where: { status: 'active' },
    include: { snapshots: { where: { statDate: { gte: since } }, orderBy: { statDate: 'asc' } } },
  });
  const out: FatiguedAd[] = [];
  for (const ad of ads) {
    if (ad.snapshots.length < 2) continue;
    const ctrs = ad.snapshots.map((s) => Number(s.ctr ?? 0));
    const cpms = ad.snapshots.map((s) => Number(s.cpm ?? 0));
    const today = ad.snapshots[ad.snapshots.length - 1];
    const ctrToday = Number(today.ctr ?? 0);
    const ctrPeak = Math.max(...ctrs);
    const frequency = Number(today.frequency ?? 0);
    const cpmToday = Number(today.cpm ?? 0);
    const cpmBaseline = cpms.length ? cpms.reduce((a, b) => a + b, 0) / cpms.length : 0;
    if (!isFatigued({ ctrToday, ctrPeak, frequency, cpmToday, cpmBaseline })) continue;

    let reason: FatiguedAd['reason'];
    let detail: string;
    if (frequency > 2.5) {
      reason = 'frequency';
      detail = `frequency ${frequency.toFixed(1)}`;
    } else if (ctrPeak > 0 && ctrToday <= ctrPeak * 0.7) {
      reason = 'ctr_drop';
      const dropPct = Math.round((1 - ctrToday / ctrPeak) * 100);
      detail = `CTRピーク比 -${dropPct}%`;
    } else {
      reason = 'cpm_rise';
      const risePct = cpmBaseline > 0 ? Math.round((cpmToday / cpmBaseline - 1) * 100) : 0;
      detail = `CPMベース比 +${risePct}%`;
    }
    out.push({ adId: ad.adId, adName: ad.adName, reason, detail });
  }
  return out;
}
```

- [ ] **Step 2: C5 route をリファクタ**

`src/app/api/cron/ad-fatigue-daily/route.ts` を、インライン検知を `detectFatiguedAds()` 呼び出しに置換:
```ts
import { NextResponse } from 'next/server';
import { detectFatiguedAds } from '@/lib/feedback-loop/fatigue-query';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 疲労広告を検知してリストを返す（通知のみ・自動停止なし）。"0 23 * * *" */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const fatigued = await detectFatiguedAds();
    return NextResponse.json({ ok: true, fatiguedCount: fatigued.length, fatigued });
  } catch (e) {
    console.error('[cron/ad-fatigue-daily] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
```

- [ ] **Step 3: 型チェック + テスト**

`npx tsc --noEmit` → エラーなし。`npx vitest run` → 既存全 PASS。

- [ ] **Step 4: Commit**
```
git add src/lib/feedback-loop/fatigue-query.ts src/app/api/cron/ad-fatigue-daily/route.ts
git commit -m "refactor(feedback-loop): extract detectFatiguedAds + reason detail"
```

---

## Task R5: スナップショット集計 ad-snapshot.ts（TDD）

**Files:** Create `src/lib/feedback-loop/ad-snapshot.ts`; Test `tests/unit/feedback-loop/ad-snapshot.test.ts`.

- [ ] **Step 1: 失敗テスト（純バケット集計）**

`tests/unit/feedback-loop/ad-snapshot.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { bucketSnapshots, type SnapshotInput } from '@/lib/feedback-loop/ad-snapshot';

const row = (statDate: string, over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  statDate, // 'YYYY-MM-DD' (UTC date)
  impressions: 1000,
  clicks: 10,
  spend: 1000,
  conversions: 1,
  ...over,
});

describe('bucketSnapshots weekly (日曜起点)', () => {
  it('同一週(日〜土)を1バケットに合算する', () => {
    // 2026-06-07 は日曜, 2026-06-13 は土曜 → 同一週
    const rows = [row('2026-06-07', { impressions: 100 }), row('2026-06-10', { impressions: 200 })];
    const buckets = bucketSnapshots(rows, 'weekly');
    expect(buckets).toHaveLength(1);
    expect(buckets[0].impressions).toBe(300);
    expect(buckets[0].label).toBe('26/06/07-06/13');
  });

  it('週をまたぐと別バケット・新しい順で並ぶ', () => {
    const rows = [row('2026-05-31'), row('2026-06-07')];
    const buckets = bucketSnapshots(rows, 'weekly');
    expect(buckets).toHaveLength(2);
    expect(buckets[0].label.startsWith('26/06/07')).toBe(true); // 新しい順
  });

  it('派生指標 CTR/CPC/CPA を合算値から計算する', () => {
    const rows = [row('2026-06-07', { impressions: 10000, clicks: 300, spend: 30000, conversions: 10 })];
    const b = bucketSnapshots(rows, 'weekly')[0];
    expect(b.ctr).toBeCloseTo(0.03, 5);
    expect(b.cpc).toBeCloseTo(100, 5);
    expect(b.cpa).toBeCloseTo(3000, 5);
  });
});

describe('bucketSnapshots monthly', () => {
  it('暦月で合算する', () => {
    const rows = [row('2026-05-03'), row('2026-05-28'), row('2026-06-01')];
    const buckets = bucketSnapshots(rows, 'monthly');
    expect(buckets).toHaveLength(2);
    expect(buckets[0].label).toBe('2026-06'); // 新しい順
  });
});
```

- [ ] **Step 2: FAIL 確認**

`npx vitest run tests/unit/feedback-loop/ad-snapshot.test.ts` → module not found。

- [ ] **Step 3: 実装**

`src/lib/feedback-loop/ad-snapshot.ts`:
```ts
import { getPrisma } from '@/lib/prisma';

export interface SnapshotInput {
  statDate: string; // 'YYYY-MM-DD'（UTC date 由来）
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

export interface SnapshotBucket {
  label: string; // weekly: '26/06/07-06/13' / monthly: '2026-06'
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number | null; // clicks/impressions
  cpc: number | null; // spend/clicks
  cpa: number | null; // spend/conversions
}

export type Granularity = 'weekly' | 'monthly';

function parseUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}
function yy(d: Date): string {
  return String(d.getUTCFullYear()).slice(2);
}
function mm(d: Date): string {
  return String(d.getUTCMonth() + 1).padStart(2, '0');
}
function dd(d: Date): string {
  return String(d.getUTCDate()).padStart(2, '0');
}

/** その日付が属する週（日曜起点）の開始日を返す（UTC） */
function weekStart(d: Date): Date {
  const day = d.getUTCDay(); // 0=日
  return new Date(d.getTime() - day * 24 * 60 * 60 * 1000);
}

function bucketKeyAndLabel(ymd: string, g: Granularity): { key: string; label: string; sort: number } {
  const d = parseUtc(ymd);
  if (g === 'monthly') {
    const key = `${d.getUTCFullYear()}-${mm(d)}`;
    return { key, label: key, sort: d.getUTCFullYear() * 12 + d.getUTCMonth() };
  }
  const ws = weekStart(d);
  const we = new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
  const key = ws.toISOString().slice(0, 10);
  const label = `${yy(ws)}/${mm(ws)}/${dd(ws)}-${mm(we)}/${dd(we)}`;
  return { key, label, sort: Math.floor(ws.getTime() / 86400000) };
}

/** snapshot 入力を週/月バケットに合算し、新しい順で返す（純ロジック） */
export function bucketSnapshots(rows: SnapshotInput[], g: Granularity): SnapshotBucket[] {
  const acc = new Map<string, SnapshotBucket & { _sort: number }>();
  for (const r of rows) {
    const { key, label, sort } = bucketKeyAndLabel(r.statDate, g);
    const cur =
      acc.get(key) ??
      ({ label, impressions: 0, clicks: 0, spend: 0, conversions: 0, ctr: null, cpc: null, cpa: null, _sort: sort } as SnapshotBucket & { _sort: number });
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    cur.spend += r.spend;
    cur.conversions += r.conversions;
    acc.set(key, cur);
  }
  const list = [...acc.values()].sort((a, b) => b._sort - a._sort);
  return list.map((b) => ({
    label: b.label,
    impressions: b.impressions,
    clicks: b.clicks,
    spend: b.spend,
    conversions: b.conversions,
    ctr: b.impressions > 0 ? b.clicks / b.impressions : null,
    cpc: b.clicks > 0 ? b.spend / b.clicks : null,
    cpa: b.conversions > 0 ? b.spend / b.conversions : null,
  }));
}

/** DB から直近 N 期間ぶんの snapshot を取得しバケット化（新しい順、最大 periods 件） */
export async function getAdSnapshotRows(g: Granularity, periods: number): Promise<SnapshotBucket[]> {
  const prisma = getPrisma();
  const days = g === 'weekly' ? periods * 7 + 7 : periods * 31 + 31;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snaps = await prisma.adPerformanceSnapshot.findMany({
    where: { statDate: { gte: since } },
    select: { statDate: true, impressions: true, clicks: true, spend: true, conversions: true },
  });
  const inputs: SnapshotInput[] = snaps.map((s) => ({
    statDate: s.statDate.toISOString().slice(0, 10),
    impressions: s.impressions,
    clicks: s.clicks,
    spend: Number(s.spend),
    conversions: s.conversions,
  }));
  return bucketSnapshots(inputs, g).slice(0, periods);
}
```

- [ ] **Step 4: PASS 確認**

`npx vitest run tests/unit/feedback-loop/ad-snapshot.test.ts` → 全 PASS。

- [ ] **Step 5: Commit**
```
git add src/lib/feedback-loop/ad-snapshot.ts tests/unit/feedback-loop/ad-snapshot.test.ts
git commit -m "feat(feedback-loop): weekly/monthly snapshot bucketing (TDD)"
```

---

## Task R6: ad-report.ts 文面整形 + 送信（TDD on format）

**Files:** Create `src/lib/slack/format.ts`, `src/lib/slack/ad-report.ts`; Test `tests/unit/feedback-loop/ad-report-format.test.ts`.

- [ ] **Step 1: 小さな整形 util（純）**

`src/lib/slack/format.ts`:
```ts
/** 12345 -> '¥12.3K' / 1200000 -> '¥1.2M' / 0..999 -> '¥123' */
export function yen(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `¥${(n / 1_000).toFixed(1)}K`;
  return `¥${Math.round(n)}`;
}
/** 1200000 -> '1.2M' / 8400 -> '8,400' / 300 -> '300' */
export function count(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return Math.round(n).toLocaleString('en-US');
}
/** 0.0291 -> '2.91%'（比率→%）。null は '–' */
export function ratioPct(r: number | null): string {
  return r === null ? '–' : `${(r * 100).toFixed(2)}%`;
}
/** 等幅テーブル: 各列を colWidths で右詰め（ヘッダは左詰め）。Slack ``` で囲む前提 */
export function fixedTable(headers: string[], rows: string[][], widths: number[]): string {
  const pad = (s: string, w: number, left = false) => (left ? s.padEnd(w) : s.padStart(w));
  const head = headers.map((h, i) => pad(h, widths[i], true)).join(' ');
  const sep = '-'.repeat(widths.reduce((a, b) => a + b, 0) + headers.length - 1);
  const body = rows.map((r) => r.map((c, i) => pad(c, widths[i], i === 0)).join(' ')).join('\n');
  return [head, sep, body].join('\n');
}
```

- [ ] **Step 2: 失敗テスト（文面）**

`tests/unit/feedback-loop/ad-report-format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatWinningReport, formatSnapshotTable } from '@/lib/slack/ad-report';
import type { SnapshotBucket } from '@/lib/feedback-loop/ad-snapshot';

describe('formatWinningReport', () => {
  const hints = [
    { dimension: '訴求軸', value: 'ベネフィット型', avgCpa: 480, avgCpc: 38, avgCtr: 0.029, adCount: 5, conversions: 62, score: 0.95 },
    { dimension: '緊急性', value: '高', avgCpa: 520, avgCpc: 45, avgCtr: 0.024, adCount: 4, conversions: 41, score: 0.8 },
  ];
  const fatigued = [{ adId: '1', adName: '夏キャンA', reason: 'ctr_drop' as const, detail: 'CTRピーク比 -38%' }];

  it('CPA/CPC/CTR を含む勝ち要因を出す', () => {
    const t = formatWinningReport({ rangeLabel: '6/1〜6/7', hints, fatigued });
    expect(t).toContain('ベネフィット型');
    expect(t).toContain('¥480');
    expect(t).toContain('¥38');
    expect(t).toContain('2.90%');
    expect(t).toContain('夏キャンA');
    expect(t).toContain('-38%');
  });

  it('勝ち要因0件なら データ不足 を明記', () => {
    const t = formatWinningReport({ rangeLabel: '6/1〜6/7', hints: [], fatigued: [] });
    expect(t).toContain('有意な勝ち要因なし');
  });

  it('疲労0件なら疲労ブロックを出さない', () => {
    const t = formatWinningReport({ rangeLabel: '6/1〜6/7', hints, fatigued: [] });
    expect(t).not.toContain('要差し替え');
  });
});

describe('formatSnapshotTable', () => {
  const buckets: SnapshotBucket[] = [
    { label: '26/05/31-06/06', impressions: 1_100_000, clicks: 7900, spend: 271000, conversions: 11, ctr: 0.0072, cpc: 34, cpa: 24636 },
  ];
  it('等幅テーブルに主要指標が並ぶ', () => {
    const t = formatSnapshotTable('週次スナップショット 直近16週', buckets);
    expect(t).toContain('週次スナップショット');
    expect(t).toContain('26/05/31-06/06');
    expect(t).toContain('```'); // monospace
  });
  it('空なら no-data 文言', () => {
    expect(formatSnapshotTable('x', [])).toContain('データなし');
  });
});
```

- [ ] **Step 3: FAIL 確認**

`npx vitest run tests/unit/feedback-loop/ad-report-format.test.ts` → module not found。

- [ ] **Step 4: 実装 ad-report.ts**

`src/lib/slack/ad-report.ts`:
```ts
import { getLatestWinningHints } from '@/lib/feedback-loop/prompt-injection';
import { detectFatiguedAds, type FatiguedAd } from '@/lib/feedback-loop/fatigue-query';
import { getAdSnapshotRows, type SnapshotBucket } from '@/lib/feedback-loop/ad-snapshot';
import { getPrisma } from '@/lib/prisma';
import { yen, count, ratioPct, fixedTable } from './format';

const MIN_SCORE = 0.5;

export interface WinningHintFull {
  dimension: string;
  value: string;
  avgCpa: number | null;
  avgCpc: number | null;
  avgCtr: number | null;
  adCount: number;
  conversions: number;
  score: number;
}

// ── 純: 勝ち要因レポート文面 ────────────────────────────
export function formatWinningReport(input: {
  rangeLabel: string;
  hints: WinningHintFull[];
  fatigued: FatiguedAd[];
}): string {
  const lines: string[] = [`🏆 AdLoop 勝ちクリエイティブ分析（${input.rangeLabel}）`];
  const strong = input.hints.filter((h) => h.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
  if (strong.length === 0) {
    lines.push('今週は有意な勝ち要因なし（データ不足）');
  } else {
    lines.push('score≥0.5 のみ（= 次回生成へ反映される要因）');
    for (const h of strong) {
      const cpa = h.avgCpa === null ? '–' : yen(h.avgCpa);
      const cpc = h.avgCpc === null ? '–' : yen(h.avgCpc);
      lines.push(
        ` ・${h.dimension}: ${h.value}（CPA ${cpa} / CPC ${cpc} / CTR ${ratioPct(h.avgCtr)} ・広告${h.adCount}本・CV${h.conversions}件）`,
      );
    }
  }
  if (input.fatigued.length > 0) {
    lines.push('', `⚠️ 疲労で要差し替え（${input.fatigued.length}件）`);
    for (const f of input.fatigued) {
      lines.push(` ・${f.adName ?? f.adId}（${f.detail}）`);
    }
  }
  lines.push('', '💡 次回への示唆');
  lines.push(
    strong.length > 0
      ? ' 次回の自動生成は上記の勝ち要因を優先反映します。'
      : ' データが貯まり次第、勝ち要因を自動反映します。',
  );
  if (input.fatigued.length > 0) {
    lines.push(' ⚠️ 疲労広告はMeta管理画面でOFFを検討してください。');
  }
  return lines.join('\n');
}

// ── 純: スナップショット等幅テーブル ──────────────────
export function formatSnapshotTable(title: string, buckets: SnapshotBucket[]): string {
  if (buckets.length === 0) return `📅 ${title}\nデータなし`;
  const headers = ['期間', '広告費', '表示', 'クリック', 'CTR', 'CPC', 'CV', 'CPA'];
  const widths = [15, 7, 6, 8, 6, 5, 4, 8];
  const rows = buckets.map((b) => [
    b.label,
    yen(b.spend),
    count(b.impressions),
    count(b.clicks),
    ratioPct(b.ctr),
    b.cpc === null ? '–' : yen(b.cpc),
    count(b.conversions),
    b.cpa === null ? '–' : yen(b.cpa),
  ]);
  return `📅 ${title}\n\`\`\`\n${fixedTable(headers, rows, widths)}\n\`\`\``;
}

// ── 送信 ────────────────────────────────────────────
function webhookUrl(): string | null {
  return process.env.SLACK_WEBHOOK_URL_AD_REPORT ?? process.env.SLACK_WEBHOOK_URL_NEW_USER ?? null;
}
async function post(text: string): Promise<void> {
  const url = webhookUrl();
  if (!url) {
    console.warn('[ad-report] webhook 未設定のためスキップ');
    return;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(`[ad-report] Slack 送信失敗 ${res.status}`);
  }
}

/** WinningPattern(最新窓) → WinningHintFull[]（全 dimension・トップ値1件ずつ） */
async function getLatestWinningFull(): Promise<WinningHintFull[]> {
  const prisma = getPrisma();
  const latest = await prisma.winningPattern.findFirst({ orderBy: { windowEnd: 'desc' } });
  if (!latest) return [];
  const rows = await prisma.winningPattern.findMany({
    where: { windowEnd: latest.windowEnd },
    orderBy: { score: 'desc' },
  });
  const seen = new Set<string>();
  const out: WinningHintFull[] = [];
  for (const r of rows) {
    if (seen.has(r.dimension)) continue;
    seen.add(r.dimension);
    out.push({
      dimension: r.dimension,
      value: r.value,
      avgCpa: r.avgCpa === null ? null : Number(r.avgCpa),
      avgCpc: r.avgCpc === null ? null : Number(r.avgCpc),
      avgCtr: r.avgCtr === null ? null : Number(r.avgCtr),
      adCount: r.adCount,
      conversions: r.conversions,
      score: Number(r.score),
    });
  }
  return out;
}

/** 週次: 勝ち要因 + 週次スナップショット(16週) を1メッセージで送信 */
export async function sendWeeklyAdReport(rangeLabel: string): Promise<void> {
  const [hints, fatigued, weekly] = await Promise.all([
    getLatestWinningFull(),
    detectFatiguedAds(),
    getAdSnapshotRows('weekly', 16),
  ]);
  const part1 = formatWinningReport({ rangeLabel, hints, fatigued });
  const part2 = formatSnapshotTable('AdLoop 週次スナップショット 直近16週', weekly);
  await post(`${part1}\n\n${part2}`);
}

/** 月次: 月次スナップショット(6ヶ月) を送信 */
export async function sendMonthlyAdSnapshot(): Promise<void> {
  const monthly = await getAdSnapshotRows('monthly', 6);
  await post(formatSnapshotTable('AdLoop 月次スナップショット 直近6ヶ月', monthly));
}
```
（注: `getLatestWinningHints` の import は未使用なら削除。prompt-injection との重複ロジックだが、Full 版は CPA/CPC/CTR/件数まで必要なため別関数として持つ。）

- [ ] **Step 5: PASS + tsc**

`npx vitest run tests/unit/feedback-loop/ad-report-format.test.ts` → 全 PASS。
`npx tsc --noEmit` → エラーなし（未使用 import があれば削除）。

- [ ] **Step 6: Commit**
```
git add src/lib/slack/format.ts src/lib/slack/ad-report.ts tests/unit/feedback-loop/ad-report-format.test.ts
git commit -m "feat(adloop): Slack report formatting + send (TDD)"
```

---

## Task R7: winning-pattern-weekly に週次送信を組込み

**Files:** Modify `src/app/api/cron/winning-pattern-weekly/route.ts`.

- [ ] **Step 1: 集計後に送信を追加**

import 追加:
```ts
import { sendWeeklyAdReport } from '@/lib/slack/ad-report';
```
`aggregateWinningPatterns(...)` の結果取得後、レスポンス return の前に追加（try/catch で Slack 失敗が cron を壊さない）:
```ts
  try {
    const rangeLabel = `${windowStart.toISOString().slice(5, 10).replace('-', '/')}〜${windowEnd
      .toISOString()
      .slice(5, 10)
      .replace('-', '/')}`;
    await sendWeeklyAdReport(rangeLabel);
  } catch (e) {
    console.error('[cron/winning-pattern-weekly] Slack report failed (continuing):', e);
  }
```

- [ ] **Step 2: tsc + 全テスト**

`npx tsc --noEmit` → エラーなし。`npx vitest run` → 全 PASS。

- [ ] **Step 3: Commit**
```
git add src/app/api/cron/winning-pattern-weekly/route.ts
git commit -m "feat(adloop): send weekly report after winning-pattern aggregation"
```

---

## Task R8: 月次スナップ cron + vercel.json

**Files:** Create `src/app/api/cron/ad-snapshot-monthly/route.ts`; Modify `vercel.json`.

- [ ] **Step 1: cron route**

`src/app/api/cron/ad-snapshot-monthly/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { sendMonthlyAdSnapshot } from '@/lib/slack/ad-report';

export const maxDuration = 120;
export const runtime = 'nodejs';

/** 月次スナップショットを Slack 送信。"0 0 1 * *"（毎月1日 UTC0時=JST9時） */
export const GET = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await sendMonthlyAdSnapshot();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[cron/ad-snapshot-monthly] error:', e);
    return NextResponse.json({ error: 'Internal error', message: String(e) }, { status: 500 });
  }
};
```

- [ ] **Step 2: vercel.json に追加**

`crons` 配列に追加:
```json
    { "path": "/api/cron/ad-snapshot-monthly", "schedule": "0 0 1 * *" }
```

- [ ] **Step 3: 検証**

`npx tsc --noEmit` → エラーなし。
`node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('OK')"`
`npx vitest run` → 全 PASS。

- [ ] **Step 4: Commit**
```
git add src/app/api/cron/ad-snapshot-monthly/route.ts vercel.json
git commit -m "feat(adloop): monthly snapshot cron"
```

---

## 本番適用（全タスク後）
- [ ] `node scripts/migrate-prod.mjs`（WinningPattern の clicks/spend/avgCpc を本番反映）
- [ ] Vercel env: `SLACK_WEBHOOK_URL_AD_REPORT`（未設定なら NEW_USER にフォールバックで動作）
- [ ] デプロイ後 Vercel で cron `ad-snapshot-monthly` 登録を確認

## Self-Review
- Spec coverage: AdLoop命名(R6文面) / CPA・CPC・CTR(R2,R6) / clicks・spend・avgCpc(R1,R2,R3) / 疲労共通化(R4) / 週次16週・月次6ヶ月(R5,R6,R7,R8) / 専用webhook+fallback(R6) / 等幅整形流用回避の新util(R6) / 空状態(R6) — 全カバー。
- Placeholder scan: 全ステップに実コード記載。R3 は既存 createMany への挿入のため「直後に追加」と現物合わせ指示（挿入コードは提示済）。
- Type consistency: SnapshotInput/SnapshotBucket/Granularity(ad-snapshot) / WinningHintFull/FatiguedAd(共有) / ScoredPattern.avgCpc(R2で追加→R3で参照) 一致。formatWinningReport は WinningHintFull、formatSnapshotTable は SnapshotBucket を受ける。
