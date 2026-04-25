'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Trophy, Star, AlertTriangle } from 'lucide-react';
import { WinningBannerAddModal } from './WinningBannerAddModal';
import type { WinningBannerDTO } from '@/lib/winning-banner/types';

const RECENT_REF_COUNT = 3;
const SOFT_WARN_COUNT = 30;

type Props = {
  /** 「今回参考にする」チェックボックスの値 */
  useWinningRef: boolean;
  onChangeUseWinningRef: (v: boolean) => void;
};

export function WinningBannerLibrary({ useWinningRef, onChangeUseWinningRef }: Props) {
  const [banners, setBanners] = useState<WinningBannerDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchBanners = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/winning-banners');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBanners(json.banners ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBanners();
  }, []);

  const handleAdded = (banner: WinningBannerDTO) => {
    setBanners((prev) => [banner, ...prev]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この勝ちバナーを削除しますか？')) return;
    try {
      const res = await fetch(`/api/winning-banners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="border border-amber-700/50 rounded-lg p-4 bg-amber-950/20 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold text-amber-300">勝ちバナー参照（任意）</h3>
      </div>
      <p className="text-xs text-slate-400">
        過去にCV/CTRが高かったバナーを登録すると、次回のサジェスト生成時に勝ちパターン傾向を参考にします。
        <br />
        <span className="text-amber-300">⚠ 生成画像には合成されません（解析専用・直近{RECENT_REF_COUNT}件を集約）</span>
      </p>

      <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
        <input
          type="checkbox"
          checked={useWinningRef}
          onChange={(e) => onChangeUseWinningRef(e.target.checked)}
          className="w-4 h-4 accent-amber-500"
        />
        今回の生成で勝ちパターンを参考にする
      </label>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3 mt-0.5" />
          {error}
        </div>
      )}

      {banners.length > SOFT_WARN_COUNT && (
        <div className="text-xs text-amber-300 bg-amber-950/30 rounded px-2 py-1 border border-amber-800">
          ⚠ {SOFT_WARN_COUNT}枚を超えています。古いものを削除推奨。
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {loading && <div className="text-xs text-slate-400 px-2 py-4">読み込み中…</div>}

        {!loading && banners.length === 0 && (
          <div className="text-xs text-slate-500 px-2 py-4">
            まだ勝ちバナーがありません。「+ 新規追加」から登録してください。
          </div>
        )}

        {banners.map((b, idx) => {
          const isReferenced = useWinningRef && idx < RECENT_REF_COUNT;
          return (
            <div
              key={b.id}
              className={`relative flex-shrink-0 w-32 border rounded overflow-hidden ${
                isReferenced ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-slate-700'
              }`}
              title={b.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.blobUrl}
                alt={b.name}
                className="w-full h-32 object-cover bg-slate-950"
              />
              <button
                onClick={() => handleDelete(b.id)}
                className="absolute top-1 left-1 bg-red-600/80 hover:bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-white"
                title="削除"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
              {isReferenced && (
                <div className="absolute bottom-1 right-1 bg-amber-500 rounded px-1 py-0.5 flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 text-white" />
                  <span className="text-[9px] text-white font-bold">参考中</span>
                </div>
              )}
              <div className="px-1 py-1 bg-slate-900">
                <div className="text-[10px] text-slate-200 truncate">{b.name}</div>
                {b.analysisAbstract?.abstractTags && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {b.analysisAbstract.abstractTags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="text-[8px] bg-slate-800 text-slate-300 rounded px-1 py-0.5 truncate"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setModalOpen(true)}
          className="flex-shrink-0 w-32 h-32 border-2 border-dashed border-slate-600 rounded flex flex-col items-center justify-center text-slate-300 hover:border-amber-500 hover:text-amber-300 self-start"
        >
          <Plus className="w-6 h-6 mb-1" />
          <span className="text-xs">新規追加</span>
        </button>
      </div>

      <WinningBannerAddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={handleAdded}
      />
    </div>
  );
}
