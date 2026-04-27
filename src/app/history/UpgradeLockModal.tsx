'use client';

/**
 * Phase A.11.5: ロック対象セッションをクリックした時の Pro 訴求モーダル。
 *
 * - mailto でアップグレード相談 (A.12 Stripe 完成までの暫定)
 * - body スクロールロック + ESC で閉じる
 */
import { useEffect } from 'react';

interface UpgradeLockModalProps {
  open: boolean;
  onClose: () => void;
  plan: string;
  lockedCount: number;
}

export function UpgradeLockModal({
  open,
  onClose,
  plan,
  lockedCount,
}: UpgradeLockModalProps) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  if (!open) return null;

  const subject = `[勝ちバナー作る君] アップグレード相談（${plan} → Pro）`;
  const body =
    `現在のプラン: ${plan}\n` +
    `ロック中履歴: ${lockedCount} 件\n\n` +
    `Pro プランへのアップグレードを希望します。`;
  const mailtoHref = `mailto:str.kk.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[min(90vw,460px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="lock-modal-title" className="text-lg font-bold mb-3">
          🔒 このバナーは Pro プランで開放できます
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          {plan === 'free' ? 'Free' : 'Starter'} プランでは
          {plan === 'free' ? '直近 10' : '直近 30'} セッションのみアクセス可能です。
          Pro プラン (¥14,800/月) で全履歴・全画像にアクセス・DL できます。
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            閉じる
          </button>
          <a
            href={mailtoHref}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 text-sm rounded font-semibold transition"
          >
            アップグレードのご相談
          </a>
        </div>
      </div>
    </div>
  );
}
