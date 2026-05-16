'use client';
import { useState } from 'react';

interface Props {
  lpId: string;
  initialSlug: string;
  onClose: () => void;
  onPublished: (publishedUrl: string) => void;
}

export function PublishModal({ lpId, initialSlug, onClose, onPublished }: Props) {
  const [slug, setSlug] = useState(initialSlug);
  const [gtmId, setGtmId] = useState('');
  const [ga4Id, setGa4Id] = useState('');
  const [clarityId, setClarityId] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setSubmitting(true);
    setError(null);
    try {
      const analyticsConfig: Record<string, string> = {};
      if (gtmId) analyticsConfig.gtmId = gtmId;
      if (ga4Id) analyticsConfig.ga4Id = ga4Id;
      if (clarityId) analyticsConfig.clarityId = clarityId;
      if (pixelId) analyticsConfig.pixelId = pixelId;

      const res = await fetch(`/api/lp/${lpId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, analyticsConfig: Object.keys(analyticsConfig).length ? analyticsConfig : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { publishedUrl } = await res.json();
      onPublished(publishedUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '失敗');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">公開設定</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        <label className="block">
          <span className="text-xs text-slate-400">slug（URL の末尾）</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
          />
          <span className="text-[10px] text-slate-500">3-60 字、小文字英数とハイフンのみ</span>
        </label>

        <details className="bg-slate-800 rounded p-3">
          <summary className="text-xs font-bold text-slate-300 cursor-pointer">アナリティクス設定（任意）</summary>
          <div className="mt-3 space-y-2">
            {[
              { label: 'GTM ID', value: gtmId, set: setGtmId, ph: 'GTM-XXXXX' },
              { label: 'GA4 ID', value: ga4Id, set: setGa4Id, ph: 'G-XXXXXXXX' },
              { label: 'Clarity Project ID', value: clarityId, set: setClarityId, ph: 'xxxxxxxxxx' },
              { label: 'Meta Pixel ID', value: pixelId, set: setPixelId, ph: '1234567890' },
            ].map((f) => (
              <label key={f.label} className="block">
                <span className="text-[10px] text-slate-400">{f.label}</span>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.ph}
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                />
              </label>
            ))}
          </div>
        </details>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded p-3 text-sm text-red-300">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={submitting}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-sm disabled:opacity-50"
          >
            {submitting ? '公開中…' : '✨ 公開する'}
          </button>
        </div>
      </div>
    </div>
  );
}
