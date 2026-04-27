'use client';

/**
 * Phase A.11.3: 上限到達時に表示するモーダル。
 *
 * - 生成画面の pre-check ヒット時 / API 429 受信時に表示
 * - mailto でアップグレード相談を受け付け（A.12 Stripe 完成までの暫定）
 * - body スクロールロック + ESC で閉じる
 *
 * 構造は src/app/account/UpgradeModal.tsx と類似だが、コンテキストが違う
 * （あちらは「準備中」、こちらは「上限到達」）ため別コンポーネント化。
 */
import { useEffect } from 'react';

interface UsageLimitModalProps {
  open: boolean;
  onClose: () => void;
  usageCount: number;
  usageLimit: number;
  plan: string;
}

export function UsageLimitModal({
  open,
  onClose,
  usageCount,
  usageLimit,
  plan,
}: UsageLimitModalProps) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const subject = `[勝ちバナー作る君] アップグレード相談（${plan} → 上位プラン）`;
  const body =
    `現在のプラン: ${plan}\n` +
    `今月使用: ${usageCount}/${usageLimit}\n\n` +
    `アップグレードを希望します。`;
  const mailtoHref = `mailto:str.kk.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="usage-limit-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[min(90vw,460px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="usage-limit-title" className="text-lg font-bold mb-3">
          今月の生成回数上限に到達しました
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          現在の {plan} プランの月間上限（{usageLimit} 回）を使い切りました。
          来月 1 日にリセットされます。それまでに追加で生成したい場合は、
          <a
            href={mailtoHref}
            className="text-teal-400 underline mx-1 hover:text-teal-300"
          >
            アップグレードのご相談
          </a>
          をお送りください（Phase A.12 で Stripe Checkout に切替予定）。
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
