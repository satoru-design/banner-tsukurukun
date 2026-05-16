import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { getPrisma } from '@/lib/prisma';
import { EditClient } from './EditClient';
import type { LpSection } from '@/lib/lp/types';

export const dynamic = 'force-dynamic';

export default async function LpEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/lp-maker/${id}/edit`);

  const prisma = getPrisma();
  const lp = await prisma.landingPage.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!lp) notFound();

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  const userPlan = ((userRecord?.plan ?? 'free') as 'free' | 'starter' | 'pro' | 'admin');

  return (
    <EditClient
      lpId={lp.id}
      initialTitle={lp.title}
      initialSections={lp.sections as unknown as LpSection[]}
      initialStatus={lp.status}
      initialSlug={lp.slug}
      userPlan={userPlan}
    />
  );
}
