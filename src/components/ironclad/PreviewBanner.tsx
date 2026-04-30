'use client';

import { useState } from 'react';
import { UpgradeModal } from '@/app/account/UpgradeModal';

/**
 * Phase A.14: Free プラン 4 回目以降の生成完了時に表示する訴求バナー
 *
 * - Step 3 完成画面の上部に常駐
 * - クリックで UpgradeModal を開く（Pro 訴求）
 */
export const PreviewBanner = ({ plan }: { plan: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="bg-amber-600/20 border border-amber-500/40 rounded p-4 mb-4">
        <p className="text-amber-200 font-bold">
          ⚠️ これはプレビュー版（PREVIEW 透かし入り）です
        </p>
        <p className="text-amber-100/80 text-sm mt-1">
          今月の Free 上限（3 回）を超えました。
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="underline font-bold hover:text-white ml-1"
          >
            Pro にアップグレード
          </button>
          すれば透かしなしで使えます。
        </p>
      </div>
      {open && <UpgradeModal type="upgrade" onClose={() => setOpen(false)} plan={plan} />}
    </>
  );
};
