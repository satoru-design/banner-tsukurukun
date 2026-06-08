# AdLoop マルチテナント化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** AdLoop を account 別に完全分離する。Account 新設＋accountId 付与、C1〜C5・レポートの account 対応、env 規約でのシークレット解決、単一テナント env 廃止。

**Architecture:** Account テーブルを単一情報源にし、Meta token / Slack webhook は slug 規約で env から解決。MetaAd/WinningPattern に accountId 必須、Generation に nullable。各 cron は active Account をループし 1 account 失敗が他を止めない。

**Tech Stack:** Next.js 16 / Prisma 7 / Vercel Cron / vitest

**Spec:** `docs/superpowers/specs/2026-06-08-adloop-multitenant-design.md`

## 前提・規約
- DB は `getPrisma()`。cron は `Bearer ${CRON_SECRET}`。
- 生 token/webhook は env のみ。DB/Git 厳禁。
- マイグレーションは実DB非接続（main↔branch schema diff）、本番は migrate-prod.mjs。
- 純ロジックは vitest TDD、DB/route/cron は tsc + 既存パターン。
- ⚠️ NOT NULL カラム追加（MetaAd/WinningPattern.accountId）はデプロイ前にこれらが空であること前提。

---

## Task M1: Account 新設 + accountId 付与 + migration

**Files:** Modify `prisma/schema.prisma`; create migration dir.

- [ ] **Step 1: Account モデルを末尾に追加**
```prisma
/// AdLoop マルチテナント: 1 Meta 広告アカウント = 1 Account。token/webhook は env(slug規約)で解決。
model Account {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  metaAdAccountId String
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  metaAds         MetaAd[]
  winningPatterns WinningPattern[]
  generations     Generation[]
}
```

- [ ] **Step 2: MetaAd に accountId 必須 FK**

`model MetaAd` に追加（`adId String @unique` の直後）:
```prisma
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
```
index 追加（既存 @@index 群に）:
```prisma
  @@index([accountId])
```

- [ ] **Step 3: WinningPattern に accountId 必須 FK**

`model WinningPattern` に追加（`id` の直後）:
```prisma
  accountId   String
  account     Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
```
既存 `@@index([dimension, value, windowEnd])` を次に置換:
```prisma
  @@index([accountId, dimension, value, windowEnd])
  @@index([accountId, windowEnd])
```

- [ ] **Step 4: Generation に accountId nullable FK**

`model Generation` に追加（`userId String` 関連の近く・既存フィールド群に）:
```prisma
  accountId String?
  account   Account? @relation(fields: [accountId], references: [id], onDelete: SetNull)
```
index 追加:
```prisma
  @@index([accountId])
```

- [ ] **Step 5: validate + generate**
```
npx prisma validate
npx prisma generate
```
DB 接続コマンド禁止。

- [ ] **Step 6: オフライン migration 生成**
```
git show main:prisma/schema.prisma > /tmp/old-schema-m1.prisma
TS=$(date +%Y%m%d%H%M%S)
DIR="prisma/migrations/${TS}_adloop_multitenant"
mkdir -p "$DIR"
npx prisma migrate diff --from-schema /tmp/old-schema-m1.prisma --to-schema prisma/schema.prisma --script 2>/dev/null | grep -v "Loaded Prisma config" > "$DIR/migration.sql"
```
確認: `CREATE TABLE "Account"`、`ALTER TABLE "MetaAd" ADD COLUMN "accountId"`、WinningPattern/Generation の ALTER、FK 追加が含まれる。`error`/`Loaded` 文字列が無いこと。MetaAd/WinningPattern の accountId は NOT NULL で良い（実データ無し前提）。

- [ ] **Step 7: Commit**
```
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Account model and accountId for multitenancy"
```

---

## Task M2: accounts.ts リゾルバ（TDD）

**Files:** Create `src/lib/feedback-loop/accounts.ts`; Test `tests/unit/feedback-loop/accounts.test.ts`.

- [ ] **Step 1: 失敗テスト（純ロジック envKeyBase）**

`tests/unit/feedback-loop/accounts.test.ts`:
```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { envKeyBase, getAccountMetaToken, getAccountWebhook, AccountConfigError } from '@/lib/feedback-loop/accounts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('envKeyBase', () => {
  it('slug をENVキーへ変換（- を _ ・大文字）', () => {
    expect(envKeyBase('five-point-detox')).toBe('FIVE_POINT_DETOX');
    expect(envKeyBase('kokoromil')).toBe('KOKOROMIL');
  });
});

describe('getAccountMetaToken', () => {
  it('env から token を返す', () => {
    vi.stubEnv('ACCOUNT_KOKOROMIL_META_TOKEN', 'tok123');
    expect(getAccountMetaToken('kokoromil')).toBe('tok123');
  });
  it('未設定なら AccountConfigError', () => {
    expect(() => getAccountMetaToken('kokoromil')).toThrow(AccountConfigError);
  });
});

describe('getAccountWebhook', () => {
  it('専用 webhook を優先', () => {
    vi.stubEnv('ACCOUNT_KOKOROMIL_SLACK_WEBHOOK', 'https://hooks/abc');
    expect(getAccountWebhook('kokoromil')).toBe('https://hooks/abc');
  });
  it('未設定なら NEW_USER にフォールバック、それも無ければ null', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL_NEW_USER', 'https://hooks/fallback');
    expect(getAccountWebhook('kokoromil')).toBe('https://hooks/fallback');
  });
});
```

- [ ] **Step 2: FAIL 確認** `npx vitest run tests/unit/feedback-loop/accounts.test.ts`

- [ ] **Step 3: 実装**

`src/lib/feedback-loop/accounts.ts`:
```ts
import { getPrisma } from '@/lib/prisma';

export class AccountConfigError extends Error {}

/** slug → ENV キー基底（'five-point-detox' → 'FIVE_POINT_DETOX'） */
export function envKeyBase(slug: string): string {
  return slug.replace(/-/g, '_').toUpperCase();
}

/** isActive な Account 一覧 */
export async function getActiveAccounts() {
  return getPrisma().account.findMany({ where: { isActive: true }, orderBy: { slug: 'asc' } });
}

/** account の Meta access token（env）。未設定は AccountConfigError */
export function getAccountMetaToken(slug: string): string {
  const v = process.env[`ACCOUNT_${envKeyBase(slug)}_META_TOKEN`];
  if (!v) throw new AccountConfigError(`META token not set for account '${slug}'`);
  return v;
}

/** account の Slack webhook。専用→NEW_USER フォールバック→null */
export function getAccountWebhook(slug: string): string | null {
  return (
    process.env[`ACCOUNT_${envKeyBase(slug)}_SLACK_WEBHOOK`] ??
    process.env.SLACK_WEBHOOK_URL_NEW_USER ??
    null
  );
}
```

- [ ] **Step 4: PASS + tsc** `npx vitest run tests/unit/feedback-loop/accounts.test.ts` / `npx tsc --noEmit`

- [ ] **Step 5: Commit**
```
git add src/lib/feedback-loop/accounts.ts tests/unit/feedback-loop/accounts.test.ts
git commit -m "feat(adloop): account resolver (env-based secrets, TDD)"
```

---

## Task M3: insights-client + aggregate を account 対応

**Files:** Modify `src/lib/feedback-loop/insights-client.ts`, `src/lib/feedback-loop/aggregate.ts`.

- [ ] **Step 1: insights-client のシグネチャ変更**

`fetchAdInsightsForDate` を account 引数化。現状 env から token/account を読む部分を引数に置換:
```ts
export interface InsightsAccount {
  metaAdAccountId: string;
  token: string;
}

export async function fetchAdInsightsForDate(
  dateYmd: string,
  account: InsightsAccount,
): Promise<InsightsRow[]> {
  const conversionActionType =
    process.env.FEEDBACK_CONVERSION_ACTION_TYPE ?? 'offsite_conversion.fb_pixel_purchase';
  const token = account.token;
  const acct = account.metaAdAccountId;
  if (!token || !acct) {
    throw new InsightsConfigError('token / metaAdAccountId missing');
  }
  const actId = acct.startsWith('act_') ? acct : `act_${acct}`;
  // ... 以降の fields/timeRange/fetch/pagination は既存のまま（token を URL に出さない安全実装を維持） ...
}
```
注意: `InsightsConfigError` は残す。env `META_INSIGHTS_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` の参照は**削除**。`CONVERSION_ACTION_TYPE` のモジュール定数があれば関数内 env 読みに統一済のはず（変更不要なら触らない）。token はエラー/ログに出さないこと。

- [ ] **Step 2: aggregate を account 対応**

`AggregateOptions` に `accountId: string;` を追加。
snapshot 取得 where を account 絞り込みに変更:
```ts
  const snapshots = await prisma.adPerformanceSnapshot.findMany({
    where: { statDate: { gte: opts.windowStart, lte: opts.windowEnd }, metaAd: { accountId: opts.accountId } },
    include: { metaAd: { include: { generationImage: { include: { generation: true } } } } },
  });
```
deleteMany を account+window 単位に:
```ts
  await prisma.winningPattern.deleteMany({
    where: { accountId: opts.accountId, windowStart: opts.windowStart, windowEnd: opts.windowEnd },
  });
```
createMany の各 data に `accountId: opts.accountId,` を追加。

- [ ] **Step 3: tsc** `npx tsc --noEmit`（呼び出し側 C2/C3 は後続 M7 で直すため、ここで型エラーが出るのは想定内。insights-client/aggregate 自体の型が通ることを確認。C2/C3 の未対応エラーが出たら M7 で解消する旨メモして次へ。ただし可能なら最小修正で全体を通すのが理想——本タスクでは lib のみ対象とし、route の型エラーは M7 まで残してよい）。

実務指針: route のエラーが残ると `tsc` 全体が赤になる。**このタスクのコミットは lib 変更のみ**。route 修正（M7）まで `tsc` 全面グリーンにならない点を許容し、`npx vitest run`（純ロジック）が緑であることだけ確認する。

- [ ] **Step 4: Commit**
```
git add src/lib/feedback-loop/insights-client.ts src/lib/feedback-loop/aggregate.ts
git commit -m "feat(adloop): account-aware insights fetch + aggregation"
```

---

## Task M4: prompt-injection / ad-snapshot / fatigue-query を account 対応

**Files:** Modify `src/lib/feedback-loop/prompt-injection.ts`, `src/lib/feedback-loop/ad-snapshot.ts`, `src/lib/feedback-loop/fatigue-query.ts`.

- [ ] **Step 1: getLatestWinningHints に accountId**
```ts
export async function getLatestWinningHints(accountId: string, limitPerDim = 1): Promise<WinningHint[]> {
  const prisma = getPrisma();
  const latest = await prisma.winningPattern.findFirst({
    where: { accountId },
    orderBy: { windowEnd: 'desc' },
  });
  if (!latest) return [];
  const rows = await prisma.winningPattern.findMany({
    where: { accountId, windowEnd: latest.windowEnd },
    orderBy: { score: 'desc' },
  });
  // ... 以降の dimension 重複排除は既存のまま ...
}
```

- [ ] **Step 2: getAdSnapshotRows に accountId**
```ts
export async function getAdSnapshotRows(accountId: string, g: Granularity, periods: number): Promise<SnapshotBucket[]> {
  const prisma = getPrisma();
  const days = g === 'weekly' ? periods * 7 + 7 : periods * 31 + 31;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snaps = await prisma.adPerformanceSnapshot.findMany({
    where: { statDate: { gte: since }, metaAd: { accountId } },
    select: { statDate: true, impressions: true, clicks: true, spend: true, conversions: true },
  });
  // ... 以降 bucketSnapshots は既存のまま ...
}
```
`bucketSnapshots`（純ロジック）は変更不要。

- [ ] **Step 3: detectFatiguedAds に accountId**
```ts
export async function detectFatiguedAds(accountId: string): Promise<FatiguedAd[]> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const ads = await prisma.metaAd.findMany({
    where: { status: 'active', accountId },
    include: { snapshots: { where: { statDate: { gte: since } }, orderBy: { statDate: 'asc' } } },
  });
  // ... 以降の判定ロジックは既存のまま ...
}
```

- [ ] **Step 4: 既存ユニット（ad-snapshot.test の bucketSnapshots）が緑のまま確認**
`npx vitest run` → bucketSnapshots/isFatigued の純ロジックテストは引数変更の影響を受けない（pure 部分は不変）。緑であること。route 由来の tsc エラーは M7 まで許容。

- [ ] **Step 5: Commit**
```
git add src/lib/feedback-loop/prompt-injection.ts src/lib/feedback-loop/ad-snapshot.ts src/lib/feedback-loop/fatigue-query.ts
git commit -m "feat(adloop): account-scoped winning hints / snapshot / fatigue queries"
```

---

## Task M5: ad-report を account 対応（webhook ルーティング）

**Files:** Modify `src/lib/slack/ad-report.ts`.

- [ ] **Step 1: webhook を引数化 & account 別送信に変更**

変更点:
- `post(text)` → `post(text: string, webhookUrl: string | null)`（url 未指定/null は skip+log）。`webhookUrl()` 関数は削除し、呼び出し元が `getAccountWebhook(slug)` を渡す。
- `getLatestWinningFull()` → `getLatestWinningFull(accountId: string)`（`where: { accountId }` で findFirst/findMany）。
- `sendWeeklyAdReport(rangeLabel)` → `sendWeeklyAdReport(account: { id: string; slug: string }, rangeLabel: string)`:
```ts
export async function sendWeeklyAdReport(account: { id: string; slug: string }, rangeLabel: string): Promise<void> {
  const [hints, fatigued, weekly] = await Promise.all([
    getLatestWinningFull(account.id),
    detectFatiguedAds(account.id),
    getAdSnapshotRows(account.id, 'weekly', 16),
  ]);
  const part1 = formatWinningReport({ rangeLabel, hints, fatigued });
  const part2 = formatSnapshotTable('AdLoop 週次スナップショット 直近16週', weekly);
  await post(`${part1}\n\n${part2}`, getAccountWebhook(account.slug));
}
```
- `sendMonthlyAdSnapshot()` → `sendMonthlyAdSnapshot(account: { id: string; slug: string })`:
```ts
export async function sendMonthlyAdSnapshot(account: { id: string; slug: string }): Promise<void> {
  const monthly = await getAdSnapshotRows(account.id, 'monthly', 6);
  await post(formatSnapshotTable('AdLoop 月次スナップショット 直近6ヶ月', monthly), getAccountWebhook(account.slug));
}
```
import 追加: `import { detectFatiguedAds } from '@/lib/feedback-loop/fatigue-query';`（既存）/ `import { getAccountWebhook } from '@/lib/feedback-loop/accounts';`。`getAdSnapshotRows`/`detectFatiguedAds` 呼び出しを accountId 付きに更新。
純ロジック `formatWinningReport`/`formatSnapshotTable` は不変。

- [ ] **Step 2: 文面テスト（既存 ad-report-format.test）が緑のまま** `npx vitest run tests/unit/feedback-loop/ad-report-format.test.ts`（pure 関数は不変）。

- [ ] **Step 3: Commit**
```
git add src/lib/slack/ad-report.ts
git commit -m "feat(adloop): per-account report routing via account webhook"
```

---

## Task M6: C1 meta-ad-link に accountId

**Files:** Modify `src/lib/feedback-loop/meta-ad-link.ts`, `src/app/api/admin/meta-ad-link/route.ts`.

- [ ] **Step 1: recordMetaAd に accountId 必須**

`MetaAdLinkInput` に `accountId: string;` を追加。`recordMetaAd` の upsert create/update に `accountId: input.accountId,` を追加。Account 存在チェック:
```ts
export async function recordMetaAd(input: MetaAdLinkInput) {
  const prisma = getPrisma();
  const acct = await prisma.account.findUnique({ where: { id: input.accountId } });
  if (!acct) throw new Error(`Account not found: ${input.accountId}`);
  const data = { accountId: input.accountId, generationImageId: input.generationImageId ?? null, /* ...既存... */ };
  return prisma.metaAd.upsert({ where: { adId: input.adId }, create: { adId: input.adId, ...data }, update: data });
}
```

- [ ] **Step 2: route の zod に accountId**

`schema` に `accountId: z.string().min(1),` を追加（必須）。Account 不在は recordMetaAd が throw → 500 を 400 にしたい場合は try/catch でメッセージ判定。最小実装は throw→500 で可（内部API）。

- [ ] **Step 3: tsc**（route は通るはず）/ **Commit**
```
git add src/lib/feedback-loop/meta-ad-link.ts src/app/api/admin/meta-ad-link/route.ts
git commit -m "feat(adloop): C1 records accountId on MetaAd"
```

---

## Task M7: crons を account ループ化 + batch-generate に accountId

**Files:** Modify `src/app/api/cron/ad-insights-daily/route.ts`, `src/app/api/cron/winning-pattern-weekly/route.ts`, `src/app/api/cron/ad-snapshot-monthly/route.ts`, `src/app/api/cron/ad-fatigue-daily/route.ts`, `src/app/api/admin/batch-generate/route.ts`.

- [ ] **Step 1: C2 ad-insights-daily を account ループ**

GET 内を置換:
```ts
import { getActiveAccounts, getAccountMetaToken, AccountConfigError } from '@/lib/feedback-loop/accounts';
import { fetchAdInsightsForDate } from '@/lib/feedback-loop/insights-client';
import { upsertSnapshots } from '@/lib/feedback-loop/snapshot-upsert';
// ...
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ymd = d.toISOString().slice(0, 10);
  const accounts = await getActiveAccounts();
  const results: Array<{ slug: string; ok: boolean; fetched?: number; matchedAds?: number; skipped?: string }> = [];
  for (const a of accounts) {
    try {
      const token = getAccountMetaToken(a.slug);
      const rows = await fetchAdInsightsForDate(ymd, { metaAdAccountId: a.metaAdAccountId, token });
      const r = await upsertSnapshots(rows);
      results.push({ slug: a.slug, ok: true, fetched: rows.length, matchedAds: r.matchedAds });
    } catch (e) {
      if (e instanceof AccountConfigError) {
        console.warn(`[cron/ad-insights-daily] ${a.slug} skipped:`, e.message);
        results.push({ slug: a.slug, ok: true, skipped: e.message });
      } else {
        console.error(`[cron/ad-insights-daily] ${a.slug} error:`, e);
        results.push({ slug: a.slug, ok: false });
      }
    }
  }
  return NextResponse.json({ ok: true, date: ymd, accounts: results });
```
（InsightsConfigError も同様に skip 扱いにしたい場合は catch に含める。token 欠落は AccountConfigError で拾える。）

- [ ] **Step 2: C3 winning-pattern-weekly を account ループ + 週次レポート**

aggregate と sendWeeklyAdReport を account ごとに:
```ts
import { getActiveAccounts } from '@/lib/feedback-loop/accounts';
// ... windowStart/windowEnd 計算は既存 ...
  const accounts = await getActiveAccounts();
  const rangeLabel = `${windowStart.toISOString().slice(5, 10).replace('-', '/')}〜${windowEnd.toISOString().slice(5, 10).replace('-', '/')}`;
  const out: Array<{ slug: string; patterns: number }> = [];
  for (const a of accounts) {
    try {
      const count = await aggregateWinningPatterns({
        accountId: a.id, windowStart, windowEnd,
        minAdCount: Number(process.env.FEEDBACK_MIN_AD_COUNT ?? '3'),
        minConversions: Number(process.env.FEEDBACK_MIN_CONVERSIONS ?? '10'),
        formula: defaultFormula(),
      });
      out.push({ slug: a.slug, patterns: count });
      try { await sendWeeklyAdReport({ id: a.id, slug: a.slug }, rangeLabel); }
      catch (e) { console.error(`[winning-pattern-weekly] ${a.slug} report failed:`, e); }
    } catch (e) {
      console.error(`[winning-pattern-weekly] ${a.slug} aggregate failed:`, e);
    }
  }
  return NextResponse.json({ ok: true, windowStart: windowStart.toISOString().slice(0,10), windowEnd: windowEnd.toISOString().slice(0,10), accounts: out });
```

- [ ] **Step 3: 月次 cron を account ループ**

`ad-snapshot-monthly/route.ts` を:
```ts
import { getActiveAccounts } from '@/lib/feedback-loop/accounts';
import { sendMonthlyAdSnapshot } from '@/lib/slack/ad-report';
// ... auth ...
  const accounts = await getActiveAccounts();
  for (const a of accounts) {
    try { await sendMonthlyAdSnapshot({ id: a.id, slug: a.slug }); }
    catch (e) { console.error(`[ad-snapshot-monthly] ${a.slug} failed:`, e); }
  }
  return NextResponse.json({ ok: true, accounts: accounts.length });
```

- [ ] **Step 4: C5 ad-fatigue-daily を account ループ**
```ts
import { getActiveAccounts } from '@/lib/feedback-loop/accounts';
import { detectFatiguedAds } from '@/lib/feedback-loop/fatigue-query';
// ... auth ...
  const accounts = await getActiveAccounts();
  const out: Array<{ slug: string; fatiguedCount: number; fatigued: unknown[] }> = [];
  for (const a of accounts) {
    try { const f = await detectFatiguedAds(a.id); out.push({ slug: a.slug, fatiguedCount: f.length, fatigued: f }); }
    catch (e) { console.error(`[ad-fatigue-daily] ${a.slug} failed:`, e); }
  }
  return NextResponse.json({ ok: true, accounts: out });
```

- [ ] **Step 5: batch-generate に accountId**

`src/app/api/admin/batch-generate/route.ts`:
- body から `accountId`（任意 string）を取り出しバリデーション（任意なので無くてもよい）。
- Generation 作成時に `accountId` を渡す（briefSnapshot 保存箇所の create に `accountId: accountId ?? null` を追加。※ Generation スキーマは accountId nullable）。
- 勝ち要因注入: 既存の `getLatestWinningHints()` 呼び出しを「accountId があれば `getLatestWinningHints(accountId)`、無ければ注入なし（winningPrefix='' のまま）」に変更:
```ts
  let winningPrefix = '';
  if (accountId) {
    try {
      const hints = await getLatestWinningHints(accountId);
      winningPrefix = formatWinningPatternsPrefix(hints);
    } catch (e) { console.warn('[batch-generate] winning hints unavailable:', e); }
  }
```
実際の Generation 作成箇所・accountId の受け取り箇所は route の実装に合わせて配置（read してから編集）。

- [ ] **Step 6: 全体 tsc + vitest + vercel.json**
```
npx tsc --noEmit
npx vitest run
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel OK')"
```
ここで **tsc 全面グリーン**になること（M3/M4 で残していた route エラーが解消）。

- [ ] **Step 7: Commit**
```
git add src/app/api/cron/ad-insights-daily/route.ts src/app/api/cron/winning-pattern-weekly/route.ts src/app/api/cron/ad-snapshot-monthly/route.ts src/app/api/cron/ad-fatigue-daily/route.ts src/app/api/admin/batch-generate/route.ts
git commit -m "feat(adloop): loop crons over accounts + batch-generate accountId"
```

---

## Task M8: seed-accounts.mjs + 単一テナント env 残骸の除去確認

**Files:** Create `scripts/seed-accounts.mjs`; verify no stale env refs.

- [ ] **Step 1: seed スクリプト**

`scripts/seed-accounts.mjs`（migrate-prod.mjs と同じ実行様式・DATABASE_URL で接続）:
```js
/**
 * AdLoop Account 冪等 seed。slug で upsert。
 * 実行: node scripts/seed-accounts.mjs            (dev = .env DATABASE_URL)
 *       PROD: DATABASE_URL=$PROD node scripts/seed-accounts.mjs (Claude が代行)
 * token/webhook は env(ACCOUNT_<SLUG>_*) に別途設定（このスクリプトでは扱わない）。
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const ACCOUNTS = [
  { slug: 'five-point-detox', name: '5 Point Detox', metaAdAccountId: 'REPLACE_ME' },
  { slug: 'kokoromil', name: 'ココロミル', metaAdAccountId: 'REPLACE_ME' },
  // autobanner 自社を入れる場合: { slug: 'autobanner', name: 'AutoBanner', metaAdAccountId: '1664983991362612' },
];

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL required'); process.exit(1); }
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

for (const a of ACCOUNTS) {
  const r = await prisma.account.upsert({
    where: { slug: a.slug },
    create: a,
    update: { name: a.name, metaAdAccountId: a.metaAdAccountId },
  });
  console.log(`upserted: ${r.slug} (${r.id})`);
}
await prisma.$disconnect();
```
（`metaAdAccountId: 'REPLACE_ME'` は小池提供値で後日差し替え。Claude が値を受け取って編集→実行する。）

- [ ] **Step 2: 単一テナント env 残骸の確認**
```
grep -rn "META_INSIGHTS_ACCESS_TOKEN\|META_AD_ACCOUNT_ID\|SLACK_WEBHOOK_URL_AD_REPORT" src
```
ヒットが0であること（全て account 別へ移行済）。残っていたら該当を account 方式へ修正。

- [ ] **Step 3: 最終検証**
```
npx tsc --noEmit
npx vitest run
npx eslint src/lib/feedback-loop src/lib/slack/ad-report.ts
```

- [ ] **Step 4: Commit**
```
git add scripts/seed-accounts.mjs
git commit -m "feat(adloop): account seed script"
```

---

## 本番適用（全タスク後・Claude 代行）
- [ ] `node scripts/migrate-prod.mjs`（Account/accountId を本番反映。MetaAd/WinningPattern が空であることを事前確認）
- [ ] `scripts/seed-accounts.mjs` の metaAdAccountId を実値に差し替え → prod URL で実行
- [ ] Vercel env 登録（vercel-set-env.mjs）: 各 `ACCOUNT_<slug>_META_TOKEN` / `ACCOUNT_<slug>_SLACK_WEBHOOK`、共通 `FEEDBACK_*`、削除: `META_INSIGHTS_ACCESS_TOKEN`/`META_AD_ACCOUNT_ID`/`SLACK_WEBHOOK_URL_AD_REPORT`
- [ ] meta-ads-autopilot 側: batch-generate / meta-ad-link 呼び出しに accountId を渡す改修（別計画）

## Self-Review
- Spec coverage: Account(M1) / accountId 付与(M1) / resolver(M2) / insights+aggregate account化(M3) / hints+snapshot+fatigue account化(M4) / report routing(M5) / C1 accountId(M6) / crons loop + batch-generate(M7) / seed + env除去(M8) — 全カバー。
- Placeholder: seed の REPLACE_ME はデプロイ時に小池値で差し替える明示プレースホルダ（コードは動作する）。他に未定なし。
- Type consistency: AccountConfigError/InsightsAccount/envKeyBase/getActiveAccounts/getAccountMetaToken/getAccountWebhook を一貫使用。accountId は MetaAd/WinningPattern 必須・Generation 任意で統一。sendWeeklyAdReport/sendMonthlyAdSnapshot は `{id,slug}` を受ける。
- 既知の段階的 tsc 赤: M3/M4 はlib先行のため route 型エラーが M7 まで残る（計画内で明記）。M7 Step6 で全面グリーン。
