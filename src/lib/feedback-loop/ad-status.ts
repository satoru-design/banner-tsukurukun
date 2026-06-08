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
