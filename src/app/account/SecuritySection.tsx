'use client';

/**
 * Phase A.11.2: セキュリティセクション。
 * - サインアウト（NextAuth signOut 経由）
 * - アカウント削除依頼（mailto で運営に送信）
 *
 * 削除依頼は API + Formspree ではなく mailto 採用（spec §5.7）。
 * 法的に有料顧客のデータ削除は慎重判断が必要なので運営側手動対応とする。
 */
import { signOut } from 'next-auth/react';
import { LogOut, Mail } from 'lucide-react';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface SecuritySectionProps {
  user: CurrentUser;
}

export function SecuritySection({ user }: SecuritySectionProps) {
  // mailto link 構築
  const subject = `[勝ちバナー作る君] アカウント削除依頼: ${user.email ?? '不明'}`;
  const body =
    `アカウント削除を依頼します。\n\n` +
    `メール: ${user.email ?? '不明'}\n` +
    `ユーザーID: ${user.userId ?? '不明'}\n\n` +
    `削除理由（任意）: \n`;
  const mailtoHref = `mailto:str.kk.co@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <section>
      <h2 className="text-lg font-semibold border-b border-slate-800 pb-2 mb-4">
        セキュリティ
      </h2>

      <div className="space-y-6">
        {/* サインアウト */}
        <div>
          <div className="text-sm text-slate-300 mb-2">サインアウト</div>
          <div className="text-xs text-slate-500 mb-3">
            すべてのデバイスからサインアウトします
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/signin' })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
          >
            <LogOut className="w-4 h-4" />
            サインアウト
          </button>
        </div>

        {/* アカウント削除依頼 */}
        <div>
          <div className="text-sm text-slate-300 mb-2">アカウント削除依頼</div>
          <div className="text-xs text-slate-500 mb-3">
            アカウント情報と素材を削除する場合は運営にメールでご連絡ください
          </div>
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded transition"
          >
            <Mail className="w-4 h-4" />
            削除を依頼する
          </a>
        </div>
      </div>
    </section>
  );
}
