'use client';
import { useState } from 'react';

interface Props {
  lpId: string;
  isPublished: boolean;
}

export function BannerHandoffButton({ lpId, isPublished }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/lp/${lpId}/banner-handoff`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { handoffUrl } = await res.json();
      window.open(handoffUrl, '_blank', 'noopener,noreferrer');
    } catch {
      alert('連携に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded text-xs disabled:opacity-50"
      title={isPublished ? '同じブリーフから広告バナー 17 サイズを生成 (autobanner.jp)' : '公開後の利用を推奨 (公開 URL も含めて連携)'}
    >
      + 広告も作る
    </button>
  );
}
