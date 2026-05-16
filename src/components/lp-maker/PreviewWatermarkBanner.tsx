'use client';

/**
 * D12 Task 18: 編集画面で Free プランユーザーに対して
 * 「公開 LP には透かしが入る」ことを事前告知する banner。
 */
interface Props {
  plan: 'free' | 'starter' | 'pro' | 'admin';
}

export function PreviewWatermarkBanner({ plan }: Props) {
  if (plan !== 'free') return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/95 text-slate-950 px-4 py-2 rounded-lg shadow-lg text-xs font-bold">
      Free プラン: 公開 LP には「Powered by LP Maker Pro」透かしが入ります（Starter で消えます）
    </div>
  );
}
