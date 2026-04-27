'use client';

/**
 * Phase A.11.1: アバター + ドロップダウンメニュー。
 *
 * - ログイン時: アバター画像クリックでドロップダウン展開
 *   - 表示名 / メール / プラン Pill
 *   - マイアカウント / プラン変更 / サインアウト
 * - 未ログイン時: グレーの人型アイコン（クリックで /signin 直行）
 *
 * アバターは <img> を使用（next/image は使わない、remotePatterns 不要のため）。
 * 画像 fetch 失敗時は lucide-react の <UserCircle /> にフォールバック。
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { UserCircle, User, CreditCard, LogOut } from 'lucide-react';
import { PlanPill } from './PlanPill';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface UserMenuProps {
  user: CurrentUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handle);
      return () => document.removeEventListener('mousedown', handle);
    }
  }, [open]);

  // ESC で閉じる
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handle);
      return () => document.removeEventListener('keydown', handle);
    }
  }, [open]);

  // 未ログイン: グレーアバター → /signin 直行
  if (!user.userId) {
    return (
      <Link
        href="/signin"
        aria-label="ログイン"
        className="text-slate-500 hover:text-slate-300 transition"
      >
        <UserCircle className="w-7 h-7" />
      </Link>
    );
  }

  // ログイン済: アバター + ドロップダウン
  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="アカウントメニュー"
        className="block rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {user.image && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.displayName}
            width={28}
            height={28}
            className="rounded-full"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <UserCircle className="w-7 h-7 text-slate-400" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-700 bg-neutral-900 shadow-xl py-1 z-50"
        >
          {/* ヘッダー部 */}
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="font-semibold text-white truncate">
              {user.displayName}
            </div>
            <div className="text-xs text-slate-400 truncate">{user.email}</div>
            <div className="mt-2">
              <PlanPill plan={user.plan} />
            </div>
          </div>

          {/* リンク群 */}
          <Link
            href="/account"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            onClick={() => setOpen(false)}
          >
            <User className="w-4 h-4" />
            マイアカウント
          </Link>
          <Link
            href="/account#plan"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            onClick={() => setOpen(false)}
          >
            <CreditCard className="w-4 h-4" />
            プラン変更
          </Link>

          {/* サインアウト */}
          <div className="border-t border-slate-800 mt-1 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut({ callbackUrl: '/signin' });
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
              サインアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
