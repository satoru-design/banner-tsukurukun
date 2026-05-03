'use client';

/**
 * Phase A.17.0: 現在のプランの隣に置く「↓ ダウングレード」ボタン
 * クリックで DowngradeProposalModal を開く（1 つ下のプランへの遷移提案）
 *
 * Free ユーザー以外で表示。
 */
import { useState } from 'react';
import { DowngradeProposalModal } from './DowngradeProposalModal';

type Plan = 'free' | 'starter' | 'pro' | 'business' | 'admin';

interface Props {
  currentPlan: Plan;
}

export function DowngradeProposalButton({ currentPlan }: Props) {
  const [open, setOpen] = useState(false);

  // free からはダウングレードできない
  if (currentPlan === 'free') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white transition"
        title="1 つ下のプランへのダウングレードを検討"
      >
        ↓ ダウングレード
      </button>
      {open && (
        <DowngradeProposalModal
          currentPlan={currentPlan}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
