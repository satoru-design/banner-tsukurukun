'use client';

import React, { useState, useRef } from 'react';
import { X, Link2, Upload, Loader2, AlertTriangle } from 'lucide-react';
import type { WinningBannerDTO } from '@/lib/winning-banner/types';

type Tab = 'url' | 'file';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (banner: WinningBannerDTO) => void;
};

export function WinningBannerAddModal({ open, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleSubmitUrl = async () => {
    const u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//.test(u)) {
      setError('http:// または https:// で始まる URL を入力してください');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/winning-banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u, name: name.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      onAdded(json.banner);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (name.trim()) form.append('name', name.trim());
      const res = await fetch('/api/winning-banners', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      onAdded(json.banner);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const reset = () => {
    setUrl('');
    setName('');
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg p-5 max-w-md w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">勝ちバナーを追加</h3>
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="text-slate-400 hover:text-white disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => !busy && setTab('url')}
            disabled={busy}
            className={`px-3 py-2 text-sm font-bold border-b-2 transition ${
              tab === 'url'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="inline w-4 h-4 mr-1" />
            URLで追加
          </button>
          <button
            onClick={() => !busy && setTab('file')}
            disabled={busy}
            className={`px-3 py-2 text-sm font-bold border-b-2 transition ${
              tab === 'file'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="inline w-4 h-4 mr-1" />
            ファイル選択
          </button>
        </div>

        <div>
          <label className="block text-xs text-slate-300 mb-1">表示名（任意）</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder="例: 2026春キャンペーン勝ちバナー"
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
          />
        </div>

        {tab === 'url' && (
          <div>
            <label className="block text-xs text-slate-300 mb-1">画像URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              placeholder="https://example.com/banner.jpg"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
            />
          </div>
        )}

        {tab === 'file' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleSubmitFile(f);
              }}
            />
            <button
              onClick={() => !busy && fileInputRef.current?.click()}
              disabled={busy}
              className="w-full border-2 border-dashed border-slate-600 rounded px-4 py-6 text-center text-slate-300 hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="inline w-4 h-4 mr-1 animate-spin" />
                  アップロード&解析中…
                </>
              ) : (
                <>
                  <Upload className="inline w-4 h-4 mr-1" />
                  画像ファイルを選択
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 rounded px-2 py-2">
            <AlertTriangle className="w-3 h-3 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'url' && (
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => !busy && onClose()}
              disabled={busy}
              className="px-4 py-2 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-40"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmitUrl}
              disabled={busy || !url.trim()}
              className="px-4 py-2 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 className="inline w-4 h-4 mr-1 animate-spin" />
                  解析中…
                </>
              ) : (
                '登録'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
