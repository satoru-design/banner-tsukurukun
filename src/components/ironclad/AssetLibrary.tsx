'use client';

import React, { useEffect, useState } from 'react';
import { Check, Plus, Trash2, Upload, X } from 'lucide-react';

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
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetType]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) {
      setError('ファイルと表示名を指定してください');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('type', assetType);
      form.append('name', uploadName.trim());
      const res = await fetch('/api/assets', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setAssets((prev) => [json.asset, ...prev]);
      onSelect(json.asset);
      setShowUpload(false);
      setUploadFile(null);
      setUploadName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
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
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="text-[11px] px-2 py-1 rounded bg-teal-700 text-white hover:bg-teal-600"
          >
            <Plus className="inline w-3 h-3 mr-1" />
            新規
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-red-400 bg-red-900/20 rounded px-2 py-1">{error}</div>
      )}

      {showUpload && (
        <div className="border border-teal-700/50 rounded p-2 space-y-2 bg-slate-950/50">
          <input
            type="text"
            placeholder="表示名 (例: 5 Point Detox)"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-slate-300 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadName.trim()}
              className="text-[11px] px-3 py-1 rounded bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50"
            >
              <Upload className="inline w-3 h-3 mr-1" />
              {uploading ? 'アップロード中…' : 'アップロード'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUpload(false);
                setUploadFile(null);
                setUploadName('');
                setError(null);
              }}
              className="text-[11px] px-3 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-4 gap-2 min-h-[4rem]">
        {loading && <div className="col-span-full text-xs text-slate-400">読み込み中…</div>}
        {!loading && assets.length === 0 && (
          <div className="col-span-full text-xs text-slate-500">まだ素材がありません。「新規」からアップロードしてください。</div>
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
