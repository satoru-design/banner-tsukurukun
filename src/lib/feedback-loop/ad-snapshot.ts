import { getPrisma } from '@/lib/prisma';

export interface SnapshotInput {
  statDate: string; // 'YYYY-MM-DD'
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

export interface SnapshotBucket {
  label: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
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
function weekStart(d: Date): Date {
  const day = d.getUTCDay();
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

/** DB から直近 N 期間ぶん取得しバケット化（新しい順・最大 periods 件） */
export async function getAdSnapshotRows(accountId: string, g: Granularity, periods: number): Promise<SnapshotBucket[]> {
  const prisma = getPrisma();
  const days = g === 'weekly' ? periods * 7 + 7 : periods * 31 + 31;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snaps = await prisma.adPerformanceSnapshot.findMany({
    where: { statDate: { gte: since }, metaAd: { accountId } },
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
