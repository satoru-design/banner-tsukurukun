'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { UpgradeModal } from '@/app/account/UpgradeModal';

/**
 * Phase A.12: ヘッダー右上「アップグレード」リンク
 *
 * - free / starter のみ表示
 * - pro / admin は非表示（admin は内部用、pro は最上位プラン）
 */
export const UpgradeCTAHeader = () => {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const plan = session?.user?.plan ?? null;
  if (!plan || plan === 'pro' || plan === 'admin') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition"
      >
        ⬆️ アップグレード
      </button>
      {open && (
        <UpgradeModal type="upgrade" onClose={() => setOpen(false)} plan={plan} />
      )}
    </>
  );
};
