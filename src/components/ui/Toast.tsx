'use client';

/**
 * Phase A.11.5: 簡易トースト。Step 3 完成時の「履歴に保存しました」表示用。
 *
 * - 5 秒で自動フェードアウト
 * - 任意のアクションリンク追加可能
 */
import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onClose: () => void;
}

export function Toast({ message, actionLabel, actionHref, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 bg-emerald-900/90 border border-emerald-700 rounded-lg px-4 py-3 shadow-2xl">
        <CheckCircle className="w-5 h-5 text-emerald-300" />
        <span className="text-sm text-emerald-100">{message}</span>
        {actionLabel && actionHref && (
          <a
            href={actionHref}
            className="text-sm text-emerald-300 underline hover:text-emerald-200"
          >
            {actionLabel}
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-emerald-300 hover:text-emerald-100"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
