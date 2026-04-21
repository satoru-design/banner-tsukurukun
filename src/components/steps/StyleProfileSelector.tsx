'use client';

import React, { useEffect, useState } from 'react';

export interface ProfileListItem {
  id: string;
  name: string;
  productContext?: string;
  referenceImageUrls: string[];
}

type Props = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew: () => void;
};

export function StyleProfileSelector({ selectedId, onSelect, onCreateNew }: Props) {
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/style-profile');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);
      setProfiles(data.profiles ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  return (
    <div className="p-4 rounded-lg border border-slate-700 bg-slate-900/40 space-y-2">
      <div className="text-sm font-bold text-slate-200 flex items-center justify-between">
        <span>スタイルプロファイル</span>
        <button
          type="button"
          onClick={loadProfiles}
          className="text-xs text-sky-400 hover:underline"
        >
          更新
        </button>
      </div>

      {loading && <div className="text-xs text-slate-400">読み込み中...</div>}
      {error && <div className="text-xs text-red-400">エラー: {error}</div>}

      <label className="flex items-center gap-2 p-2 rounded hover:bg-slate-800 cursor-pointer">
        <input
          type="radio"
          name="styleProfile"
          checked={selectedId === null}
          onChange={() => onSelect(null)}
          data-testid="profile-none"
        />
        <span className="text-sm text-slate-300">プロファイル無し（Phase A.5 挙動）</span>
      </label>

      {profiles.map((p) => (
        <label
          key={p.id}
          className="flex items-center gap-2 p-2 rounded hover:bg-slate-800 cursor-pointer"
        >
          <input
            type="radio"
            name="styleProfile"
            checked={selectedId === p.id}
            onChange={() => onSelect(p.id)}
            data-testid={`profile-${p.id}`}
          />
          <span className="text-sm text-slate-200 flex-1">{p.name}</span>
          <span className="text-xs text-slate-500">
            {p.referenceImageUrls.length} 枚
          </span>
        </label>
      ))}

      <button
        type="button"
        onClick={onCreateNew}
        className="w-full mt-2 px-3 py-2 rounded-md border border-dashed border-sky-400 text-sky-400 text-sm hover:bg-sky-400/10 transition-colors"
        data-testid="create-new-profile"
      >
        + 新規プロファイル作成
      </button>
    </div>
  );
}
