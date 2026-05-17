import { headers } from 'next/headers';
import { Suspense } from 'react';
import { SignInClient } from './SignInClient';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const h = await headers();
  const host = (h.get('host') ?? '').toLowerCase();
  const isLpMaker = host.includes('lpmaker-pro.com');

  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <SignInClient isLpMaker={isLpMaker} />
    </Suspense>
  );
}
