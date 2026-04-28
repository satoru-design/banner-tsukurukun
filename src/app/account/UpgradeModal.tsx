'use client';

/**
 * Phase A.12 Task 12: アップグレード/プラン変更モーダル（Stripe Checkout 版）。
 *
 * - Phase A.11.2 の mailto 暫定実装を Stripe Checkout に差し替え
 * - Starter / Pro の 2 プランを CheckoutButton で提示
 * - モーダル wrapper（ESC / 背景クリック / スクロールロック）は維持
 */
import { useEffect } from 'react';
import { CheckoutButton } from '@/components/billing/CheckoutButton';

const STARTER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? '';
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_BASE ?? '';

interface UpgradeModalProps {
  type: 'upgrade' | 'downgrade';
  onClose: () => void;
  plan: string;
}

export function UpgradeModal({ type, onClose, plan }: UpgradeModalProps) {
  const title = type === 'upgrade' ? 'プランをアップグレード' : 'プランを変更';

  // ESC キーで閉じる
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  // body スクロールロック
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[min(90vw,480px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="upgrade-modal-title" className="text-lg font-bold mb-4">
          {title}
        </h3>
        <div className="space-y-4">
          {plan === 'free' && (
            <div className="border border-gray-600 rounded p-4">
              <h4 className="font-bold text-base mb-1">Starter ¥3,980/月</h4>
              <p className="text-sm text-slate-400 mb-3">
                30回/月・5サイズ・お気に入り 5 枚保持
              </p>
              <CheckoutButton
                basePriceId={STARTER_PRICE_ID}
                label="Starter にする"
                className="w-full bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded font-bold disabled:opacity-50 transition"
              />
            </div>
          )}
          <div className="border-2 border-white rounded p-4">
            <h4 className="font-bold text-base mb-1">Pro ¥14,800/月（推奨）</h4>
            <p className="text-sm text-slate-400 mb-3">
              100回/月・全17サイズ・勝ちバナー無制限・履歴無制限・ZIP DL・プロンプト閲覧
            </p>
            <CheckoutButton
              basePriceId={PRO_PRICE_ID}
              label="Pro にする"
              className="w-full bg-white text-black px-4 py-3 rounded font-bold disabled:opacity-50 hover:bg-gray-200 transition"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
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
