'use client';

/**
 * Phase A.11.1: アバター + ドロップダウンメニュー。
 *
 * - ログイン時: アバターホバーでドロップダウン展開（クリックでもトグル可能、キーボード/タッチ対応）
 *   - 表示名 / メール / プラン Pill
 *   - マイアカウント / プラン変更 / サインアウト
 * - 未ログイン時: グレーの人型アイコン（クリックで /signin 直行）
 *
 * ホバーUX: マウスがアバターから drop down に移動する間（隙間）に閉じないよう
 * onMouseLeave 時に 150ms ディレイを入れる。drop down 上に再 hover で復帰。
 *
 * アバターは <img> を使用（next/image は使わない、remotePatterns 不要のため）。
 * 画像 fetch 失敗時は lucide-react の <UserCircle /> にフォールバック。
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { UserCircle, User, CreditCard, LogOut } from 'lucide-react';
import { PlanPill } from './PlanPill';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface UserMenuProps {
  user: CurrentUser;
}

const HOVER_CLOSE_DELAY_MS = 150;

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 「プラン変更」: 同一ページ /account では即スクロール、別ページからは router.push で遷移
  const handlePlanClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    if (pathname === '/account') {
      const el = document.getElementById('plan');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      router.push('/account#plan');
    }
  };

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };
  // 即時オープン（hover/click 共通）
  const openNow = () => {
    cancelClose();
    setOpen(true);
  };

  // 外側クリックで閉じる（タッチデバイス/キーボード操作のため click toggle が残るので必要）
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

  // unmount 時にタイマー解放
  useEffect(() => {
    return () => cancelClose();
  }, []);

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
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={openNow}
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
          // pt-2 でアバターとの「視覚的なすき間」を要素自体に含めて、
          // mouseLeave がトリガーされる前にドロップダウンに hover が乗り換わるようにする
          className="absolute right-0 top-full pt-2 w-64 z-50"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="rounded-lg border border-slate-700 bg-neutral-900 shadow-xl py-1">
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
          <a
            href="/account#plan"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            onClick={handlePlanClick}
          >
            <CreditCard className="w-4 h-4" />
            プラン変更
          </a>

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
        </div>
      )}
    </div>
  );
}
