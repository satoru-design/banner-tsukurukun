'use client';

/**
 * Phase A.11.2: プロフィールセクション。
 * - アバター + 表示名（インライン編集可）
 * - メール（変更不可・グレー表示）
 * - 利用開始日
 *
 * インライン編集: ✏ クリックで input 切替、Enter で保存（PUT /api/account/name）、ESC でキャンセル。
 * バリデーション: 1〜50 文字（trim 後）、空文字保存で Google 名に戻る。
 */
import { useState, KeyboardEvent } from 'react';
import { Pencil, UserCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { CurrentUser } from '@/lib/auth/get-current-user';

interface ProfileSectionProps {
  user: CurrentUser;
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(user.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleSave = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 50) {
      setError('50 文字以下で入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/account/name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? '保存に失敗しました');
        return;
      }
      // 成功: Server Component を再評価して最新の displayName を反映
      setEditing(false);
      router.refresh();
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    } else if (e.key === 'Escape') {
      setDraftName(user.displayName);
      setEditing(false);
      setError(null);
    }
  };

  const formattedStartDate = user.planStartedAt
    ? user.planStartedAt.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '-';

  return (
    <section>
      <h2 className="text-lg font-semibold border-b border-slate-800 pb-2 mb-4">
        プロフィール
      </h2>

      <div className="space-y-4">
        {/* アバター + 名前 */}
        <div className="flex items-center gap-4">
          {user.image && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.displayName}
              width={56}
              height={56}
              className="rounded-full"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserCircle className="w-14 h-14 text-slate-400" />
          )}

          <div className="flex-1">
            {editing ? (
              <div>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  disabled={saving}
                  maxLength={60}
                  className="bg-neutral-900 border border-slate-700 rounded px-3 py-1 text-white focus:border-teal-500 focus:outline-none w-64"
                />
                <div className="text-xs text-slate-500 mt-1">
                  Enter で保存 / ESC でキャンセル
                </div>
                {saving && (
                  <Loader2 className="inline w-4 h-4 animate-spin ml-2 text-teal-400" />
                )}
                {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">{user.displayName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(user.displayName);
                    setEditing(true);
                  }}
                  aria-label="表示名を編集"
                  className="text-slate-400 hover:text-white transition"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* メール */}
        <div>
          <div className="text-xs text-slate-500 mb-1">メールアドレス</div>
          <div className="text-slate-400">{user.email ?? '-'}（変更不可）</div>
        </div>

        {/* 利用開始日 */}
        <div>
          <div className="text-xs text-slate-500 mb-1">利用開始日</div>
          <div className="text-slate-200">{formattedStartDate}</div>
        </div>
      </div>
    </section>
  );
}
