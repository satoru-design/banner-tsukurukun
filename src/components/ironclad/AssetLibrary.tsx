'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Plus, Trash2, X, Loader2 } from 'lucide-react';

export type AssetType = 'product' | 'badge' | 'logo' | 'other';

export interface Asset {
  id: string;
  type: string;
  name: string;
  blobUrl: string;
  mimeType: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

type Props = {
  /** 絞り込み表示する種別。UIラベル用途にも使う。 */
  assetType: AssetType;
  /** 選択中の Asset ID（単一選択） */
  selectedId: string | null;
  onSelect: (asset: Asset | null) => void;
  /** パネル見出し（例: "商品画像", "認証バッジ 1"） */
  label: string;
};

export function AssetLibrary({ assetType, selectedId, onSelect, label }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets?type=${assetType}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAssets(json.assets ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetType]);

  const handleFilePicked = async (file: File) => {
    const displayName = file.name.replace(/\.[^.]+$/, '') || 'asset';
    setUploadingName(displayName);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', assetType);
      form.append('name', displayName);
      const res = await fetch('/api/assets', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setAssets((prev) => [json.asset, ...prev]);
      onSelect(json.asset);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingName(null);
      // 同じファイルを続けて選んだ場合も onChange が発火するよう value をクリア
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この素材を削除しますか？（他のバナーで使われていない場合のみ削除してください）')) return;
    try {
      const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) onSelect(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const inputId = `asset-upload-${assetType}-${label}`;

  return (
    <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/40 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-200">{label}</h4>
        <div className="flex gap-2">
          {selectedId && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-[11px] px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              <X className="inline w-3 h-3 mr-1" />
              選択解除
            </button>
          )}
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFilePicked(f);
            }}
          />
          <label
            htmlFor={inputId}
            className={`text-[11px] px-2 py-1 rounded text-white flex items-center ${
              uploadingName ? 'bg-sky-700 cursor-wait' : 'bg-teal-700 hover:bg-teal-600 cursor-pointer'
            }`}
          >
            {uploadingName ? (
              <>
                <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />
                アップロード中…
              </>
            ) : (
              <>
                <Plus className="inline w-3 h-3 mr-1" />
                新規アップロード
              </>
            )}
          </label>
        </div>
      </div>

      {/* 推奨サイズ案内（Phase A.11.2: 大きすぎる画像で生成が極端に遅くなる事故防止） */}
      <div className="text-[11px] text-amber-300/80 bg-amber-900/15 rounded px-2 py-1 leading-relaxed">
        ※推奨画像サイズ：<span className="font-semibold">2MB 以下</span>（透過 PNG 推奨）。
        大きい画像は <a href="https://tinypng.com/" target="_blank" rel="noreferrer" className="underline hover:text-amber-200">TinyPNG</a> 等で圧縮してからアップロードしてください。
      </div>

      {uploadingName && (
        <div className="text-[11px] text-sky-300 bg-sky-900/30 rounded px-2 py-1">
          「{uploadingName}」をアップロード中…
        </div>
      )}

      {error && (
        <div className="text-[11px] text-red-400 bg-red-900/20 rounded px-2 py-1">{error}</div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-4 gap-2 min-h-[4rem]">
        {loading && <div className="col-span-full text-xs text-slate-400">読み込み中…</div>}
        {!loading && assets.length === 0 && (
          <div className="col-span-full text-xs text-slate-500">
            まだ素材がありません。「新規アップロード」から画像を選んでください（選択と同時にアップロード）。
          </div>
        )}
        {assets.map((asset) => {
          const active = asset.id === selectedId;
          return (
            <div
              key={asset.id}
              className={`relative border rounded overflow-hidden cursor-pointer transition ${
                active ? 'border-teal-400 ring-2 ring-teal-400/50' : 'border-slate-700 hover:border-slate-500'
              }`}
              onClick={() => onSelect(asset)}
              title={asset.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.blobUrl} alt={asset.name} className="w-full aspect-square object-cover bg-slate-950" />
              <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-white px-1 py-0.5 truncate">
                {asset.name}
              </div>
              {active && (
                <div className="absolute top-1 right-1 bg-teal-500 rounded-full w-5 h-5 flex items-center justify-center shadow">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(asset.id);
                }}
                className="absolute top-1 left-1 bg-red-600/80 hover:bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-white"
                title="削除"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
