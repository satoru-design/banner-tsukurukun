import { getPrisma } from '@/lib/prisma';

export interface MetaAdLinkInput {
  adId: string;
  accountId: string;
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
  const acct = await prisma.adAccount.findUnique({ where: { id: input.accountId } });
  if (!acct) throw new Error(`AdAccount not found: ${input.accountId}`);
  const data = {
    accountId: input.accountId,
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
