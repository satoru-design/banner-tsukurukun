'use client';

/**
 * Phase A.11.2: 「準備中」モーダル。
 * Phase A.12（Stripe）完成までの暫定 UI。
 *
 * - アップグレード/ダウングレード ボタンクリック時に表示
 * - 「メールでお知らせ希望」mailto リンク提供
 * - Phase A.12 着手時は本コンポーネントを Stripe Checkout 起動コードに差し替え
 *
 * 素朴な div ベース実装（@base-ui/react/dialog の API バージョン依存を避けるため）。
 * ESC / 背景クリック で閉じる。
 */
import { useEffect } from 'react';

interface UpgradeModalProps {
  type: 'upgrade' | 'downgrade';
  onClose: () => void;
}

export function UpgradeModal({ type, onClose }: UpgradeModalProps) {
  const title = type === 'upgrade' ? 'アップグレード機能' : 'ダウングレード機能';

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

  // 件名・本文の mailto エンコード
  const subject = '[勝ちバナー作る君] 決済公開のお知らせ希望';
  const body = `${title}（Phase A.12 Stripe 決済対応）の公開連絡を希望します。\n\n`;
  const mailtoHref = `mailto:str.kk.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

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
        className="relative w-[min(90vw,460px)] bg-neutral-900 border border-slate-700 rounded-lg shadow-2xl p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="upgrade-modal-title" className="text-lg font-bold mb-3">
          {title}、まもなく公開予定です
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          Stripe 決済対応中（Phase A.12）。完成までしばらくお待ちください。
          <br />
          メールでお知らせをご希望の方は、
          <a
            href={mailtoHref}
            className="text-teal-400 underline mx-1 hover:text-teal-300"
          >
            こちら
          </a>
          までご一報ください。
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
