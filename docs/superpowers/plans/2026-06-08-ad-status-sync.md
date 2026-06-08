# Meta ad status 同期 Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Meta の effective_status を日次同期し MetaAd.status を更新、C5 疲労検知を有効化（通知のみ）。

**Spec:** `docs/superpowers/specs/2026-06-08-ad-status-sync-design.md`

## 規約
- DB は getPrisma()。token は env のみ・URL/ログに出さない。純ロジックは vitest TDD。

---

## Task S1: ad-status.ts（parse は TDD）

**Files:** `src/lib/feedback-loop/ad-status.ts`（新）, `tests/unit/feedback-loop/ad-status.test.ts`（新）

- [ ] **Step 1: 失敗テスト**
```ts
import { describe, it, expect } from 'vitest';
import { parseAdStatuses } from '@/lib/feedback-loop/ad-status';

describe('parseAdStatuses', () => {
  it('id→effective_status のマップを作る', () => {
    const m = parseAdStatuses([
      { id: '1', effective_status: 'ACTIVE' },
      { id: '2', effective_status: 'PAUSED' },
    ]);
    expect(m.get('1')).toBe('ACTIVE');
    expect(m.get('2')).toBe('PAUSED');
    expect(m.size).toBe(2);
  });
  it('effective_status 欠落はスキップ', () => {
    const m = parseAdStatuses([{ id: '1' }, { id: '2', effective_status: 'ACTIVE' }]);
    expect(m.has('1')).toBe(false);
    expect(m.get('2')).toBe('ACTIVE');
  });
});
```

- [ ] **Step 2:** run → FAIL. `npx vitest run tests/unit/feedback-loop/ad-status.test.ts`

- [ ] **Step 3: 実装** `src/lib/feedback-loop/ad-status.ts`:
```ts
import { getPrisma } from '@/lib/prisma';

const GRAPH_VERSION = 'v21.0';

interface RawAd {
  id: string;
  effective_status?: string;
}

/** Graph ads レスポンス配列 → adId→effective_status マップ（status 欠落はスキップ）。純ロジック */
export function parseAdStatuses(data: RawAd[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of data) {
    if (a.id && typeof a.effective_status === 'string' && a.effective_status.length > 0) {
      m.set(a.id, a.effective_status);
    }
  }
  return m;
}

export interface StatusAccount {
  metaAdAccountId: string;
  token: string;
}

/** account の全広告の effective_status を取得（ページネーション・token はエラーに出さない） */
export async function fetchAdStatuses(account: StatusAccount): Promise<Map<string, string>> {
  const acct = account.metaAdAccountId.startsWith('act_')
    ? account.metaAdAccountId
    : `act_${account.metaAdAccountId}`;
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${acct}/ads?fields=id,effective_status&limit=500`;
  let nextUrl: string | null = `${base}&access_token=${account.token}`;
  let pageNo = 0;
  const all = new Map<string, string>();
  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ads status API ${res.status} (page ${pageNo}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: RawAd[]; paging?: { next?: string } };
    for (const [k, v] of parseAdStatuses(json.data ?? [])) all.set(k, v);
    nextUrl = json.paging?.next ?? null;
    pageNo++;
  }
  return all;
}

/** Meta の effective_status を MetaAd.status へ同期（その accountId 配下・adId 一致分のみ更新） */
export async function syncAdStatuses(params: {
  accountId: string;
  metaAdAccountId: string;
  token: string;
}): Promise<{ updated: number }> {
  const prisma = getPrisma();
  const statuses = await fetchAdStatuses({ metaAdAccountId: params.metaAdAccountId, token: params.token });
  const ads = await prisma.metaAd.findMany({
    where: { accountId: params.accountId },
    select: { id: true, adId: true, status: true },
  });
  let updated = 0;
  for (const ad of ads) {
    const s = statuses.get(ad.adId);
    if (s && s !== ad.status) {
      await prisma.metaAd.update({ where: { id: ad.id }, data: { status: s } });
      updated++;
    }
  }
  return { updated };
}
```

- [ ] **Step 4:** run → PASS。`npx tsc --noEmit` クリーン。
- [ ] **Step 5: Commit**
```
git add src/lib/feedback-loop/ad-status.ts tests/unit/feedback-loop/ad-status.test.ts
git commit -m "feat(adloop): Meta ad effective_status sync (TDD on parse)"
```

---

## Task S2: C2 配線 + fatigue フィルタ変更

**Files:** `src/app/api/cron/ad-insights-daily/route.ts`, `src/lib/feedback-loop/fatigue-query.ts`

- [ ] **Step 1:** fatigue-query.ts の `where: { status: 'active', accountId }` を `where: { status: 'ACTIVE', accountId }` に変更。

- [ ] **Step 2:** C2 cron に status 同期を追加。READ THE FILE FIRST。import 追加:
```ts
import { syncAdStatuses } from '@/lib/feedback-loop/ad-status';
```
account ループ内、`upsertSnapshots(rows)` の結果取得後（同じ try 内）に追加:
```ts
      try {
        const sync = await syncAdStatuses({ accountId: a.id, metaAdAccountId: a.metaAdAccountId, token });
        // 任意: results に statusUpdated を含める
        (results[results.length - 1] as Record<string, unknown>).statusUpdated = sync.updated;
      } catch (se) {
        console.warn(`[cron/ad-insights-daily] ${a.slug} status sync failed:`, se);
      }
```
（`token` は同 try 内で `getAccountMetaToken(a.slug)` 済みの変数を再利用。results.push 済みの該当要素に統合する形。実装は route の実構造に合わせて配置——status 同期失敗が snapshot 成功を打ち消さないこと。）

- [ ] **Step 3:** `npx tsc --noEmit` クリーン / `npx vitest run` 全緑。
- [ ] **Step 4: Commit**
```
git add src/app/api/cron/ad-insights-daily/route.ts src/lib/feedback-loop/fatigue-query.ts
git commit -m "feat(adloop): sync ad status in daily cron + fatigue filters ACTIVE"
```

---

## Self-Review
- Spec coverage: parse(TDD) / fetch / sync / C2配線 / fatigue 'ACTIVE' — 全カバー。
- Type consistency: StatusAccount / parseAdStatuses / syncAdStatuses 一貫。
- token-safe: fetch エラーに token を含めない（URL は throw 文に入れない）。
