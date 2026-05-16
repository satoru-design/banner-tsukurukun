'use client';
import { useState } from 'react';
import type { LpSection } from '@/lib/lp/types';
import { SectionRenderer } from './SectionRenderer';

interface Props {
  lpId: string;
  section: LpSection;
  onAdopt: (newProps: Record<string, unknown>) => void;
  onClose: () => void;
}

export function RegenerateModal({ lpId, section, onAdopt, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchVariants() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lp/${lpId}/section/${section.type}/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { variants } = await res.json();
      setVariants(variants);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-100">
            「{section.type}」のもう一案
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {variants.length === 0 && !loading && (
          <div className="text-center py-10">
            <button
              type="button"
              onClick={fetchVariants}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded"
            >
              ✨ 3 案を生成（約 30-60 秒）
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-10 text-slate-400">
            生成中…
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded p-3 text-sm text-red-300 my-4">
            {error}
          </div>
        )}

        {variants.length > 0 && (
          <div className="space-y-6">
            {variants.map((v, idx) => (
              <div
                key={idx}
                className="border border-slate-800 rounded-lg overflow-hidden"
              >
                <div className="bg-slate-800 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-slate-300">案 {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onAdopt(v);
                      onClose();
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-3 py-1 rounded"
                  >
                    この案を採用
                  </button>
                </div>
                <div className="bg-slate-950">
                  <SectionRenderer section={{ ...section, props: v }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
