'use client';

import React, { useState } from 'react';
import { ReferenceImageUploader } from './ReferenceImageUploader';
import type { StyleProfileInput } from '@/lib/style-profile/schema';
import { GenerationProgress } from '@/components/ui/GenerationProgress';

type Props = {
  onClose: () => void;
  onSaved: (id: string) => void;
};

type Stage = 'upload' | 'extracting' | 'edit' | 'saving';

export function StyleProfileEditor({ onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState('');
  const [productContext, setProductContext] = useState('');
  const [extracted, setExtracted] = useState<
    | (StyleProfileInput & { referenceImageUrls: string[] })
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const startExtraction = async () => {
    if (files.length < 2) {
      setError('画像を 2 枚以上アップロードしてください');
      return;
    }
    setError(null);
    setStage('extracting');
    try {
      const fd = new FormData();
      files.forEach((f, i) => fd.append(`image-${i}`, f));
      const res = await fetch('/api/style-profile/extract', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);

      setExtracted({
        name: name || '新規プロファイル',
        productContext: productContext || undefined,
        referenceImageUrls: data.referenceImageUrls,
        visualStyle: data.visualStyle,
        typography: data.typography,
        priceBadge: data.priceBadge,
        cta: data.cta,
        layout: data.layout,
        copyTone: data.copyTone,
      });
      setStage('edit');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setStage('upload');
    }
  };

  const saveProfile = async () => {
    if (!extracted) return;
    if (!extracted.name.trim()) {
      setError('プロファイル名を入力してください');
      return;
    }
    setError(null);
    setStage('saving');
    try {
      const res = await fetch('/api/style-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extracted),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);
      onSaved(data.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setStage('edit');
    }
  };

  const updateField = <K extends keyof StyleProfileInput>(
    key: K,
    value: StyleProfileInput[K],
  ) => {
    if (!extracted) return;
    setExtracted({ ...extracted, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl my-8 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {stage === 'upload' || stage === 'extracting'
              ? '参考画像をアップロード'
              : '抽出結果を確認・編集'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
            data-testid="close-editor"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-3 rounded bg-red-500/20 border border-red-500 text-red-200 text-sm">
            {error}
          </div>
        )}

        {stage === 'upload' && (
          <>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">プロファイル名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 5 Point Detox 用"
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white"
                data-testid="profile-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">商材メモ（任意）</label>
              <input
                type="text"
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
                placeholder="例: 健康食品 / デトックスドリンク / 40 代女性向け"
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white"
              />
            </div>
            <ReferenceImageUploader onChange={setFiles} min={2} max={7} />
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
              >
                キャンセル
              </button>
              <button
                onClick={startExtraction}
                disabled={files.length < 2}
                className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white"
                data-testid="start-extraction"
              >
                解析開始
              </button>
            </div>
          </>
        )}

        {stage === 'extracting' && (
          <div className="py-12">
            <GenerationProgress label="参考画像を解析中…" estimatedSeconds={45} />
          </div>
        )}

        {stage === 'edit' && extracted && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400">プロファイル名</label>
              <input
                type="text"
                value={extracted.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white"
              />
            </div>

            <details className="rounded border border-slate-700 p-3" open>
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                Visual Style
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={extracted.visualStyle.mood}
                  onChange={(e) =>
                    updateField('visualStyle', {
                      ...extracted.visualStyle,
                      mood: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="mood"
                />
                <input
                  type="text"
                  value={extracted.visualStyle.composition}
                  onChange={(e) =>
                    updateField('visualStyle', {
                      ...extracted.visualStyle,
                      composition: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="composition"
                />
                <input
                  type="text"
                  value={extracted.visualStyle.imagePromptKeywords}
                  onChange={(e) =>
                    updateField('visualStyle', {
                      ...extracted.visualStyle,
                      imagePromptKeywords: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="imagePromptKeywords (English)"
                />
              </div>
            </details>

            <details className="rounded border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                Typography (mainCopy)
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={extracted.typography.mainCopyStyle.family}
                  onChange={(e) =>
                    updateField('typography', {
                      ...extracted.typography,
                      mainCopyStyle: {
                        ...extracted.typography.mainCopyStyle,
                        family: e.target.value as 'mincho' | 'gothic' | 'brush' | 'modern-serif' | 'hand-written',
                      },
                    })
                  }
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="mincho">mincho (明朝)</option>
                  <option value="gothic">gothic (ゴシック)</option>
                  <option value="brush">brush (毛筆)</option>
                  <option value="modern-serif">modern-serif</option>
                  <option value="hand-written">hand-written</option>
                </select>
                <select
                  value={extracted.typography.mainCopyStyle.orientation}
                  onChange={(e) =>
                    updateField('typography', {
                      ...extracted.typography,
                      mainCopyStyle: {
                        ...extracted.typography.mainCopyStyle,
                        orientation: e.target.value as 'horizontal' | 'vertical',
                      },
                    })
                  }
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="horizontal">horizontal (横)</option>
                  <option value="vertical">vertical (縦)</option>
                </select>
                <select
                  value={extracted.typography.mainCopyStyle.emphasisRatio}
                  onChange={(e) =>
                    updateField('typography', {
                      ...extracted.typography,
                      mainCopyStyle: {
                        ...extracted.typography.mainCopyStyle,
                        emphasisRatio: e.target.value as '2x' | '3x' | '4x',
                      },
                    })
                  }
                  className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="2x">2x</option>
                  <option value="3x">3x</option>
                  <option value="4x">4x</option>
                </select>
              </div>
            </details>

            <details className="rounded border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                Price Badge (primary)
              </summary>
              <div className="mt-2 space-y-2">
                <select
                  value={extracted.priceBadge.primary.shape}
                  onChange={(e) =>
                    updateField('priceBadge', {
                      ...extracted.priceBadge,
                      primary: {
                        ...extracted.priceBadge.primary,
                        shape: e.target.value as 'circle-red' | 'circle-gold' | 'rect-red' | 'ribbon-orange' | 'capsule-navy',
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="circle-red">circle-red</option>
                  <option value="circle-gold">circle-gold</option>
                  <option value="rect-red">rect-red</option>
                  <option value="ribbon-orange">ribbon-orange</option>
                  <option value="capsule-navy">capsule-navy</option>
                </select>
                <input
                  type="text"
                  value={extracted.priceBadge.primary.textPattern}
                  onChange={(e) =>
                    updateField('priceBadge', {
                      ...extracted.priceBadge,
                      primary: {
                        ...extracted.priceBadge.primary,
                        textPattern: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="例: 初回限定 ¥{NUMBER}"
                />
              </div>
            </details>

            <details className="rounded border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                CTA
              </summary>
              <div className="mt-2 space-y-2">
                <select
                  value={extracted.cta.templateId}
                  onChange={(e) =>
                    updateField('cta', {
                      ...extracted.cta,
                      templateId: e.target.value as 'cta-green-arrow' | 'cta-orange-arrow' | 'cta-red-urgent' | 'cta-gold-premium' | 'cta-navy-trust',
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                >
                  <option value="cta-green-arrow">cta-green-arrow</option>
                  <option value="cta-orange-arrow">cta-orange-arrow</option>
                  <option value="cta-red-urgent">cta-red-urgent</option>
                  <option value="cta-gold-premium">cta-gold-premium</option>
                  <option value="cta-navy-trust">cta-navy-trust</option>
                </select>
                <input
                  type="text"
                  value={extracted.cta.textPattern}
                  onChange={(e) =>
                    updateField('cta', {
                      ...extracted.cta,
                      textPattern: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="例: {ACTION}で始める →"
                />
              </div>
            </details>

            <details className="rounded border border-slate-700 p-3">
              <summary className="cursor-pointer text-sm font-bold text-sky-400">
                Copy Tone
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={extracted.copyTone.vocabulary.join(', ')}
                  onChange={(e) =>
                    updateField('copyTone', {
                      ...extracted.copyTone,
                      vocabulary: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="よく使う語彙（カンマ区切り）"
                />
                <input
                  type="text"
                  value={extracted.copyTone.taboos.join(', ')}
                  onChange={(e) =>
                    updateField('copyTone', {
                      ...extracted.copyTone,
                      taboos: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="避けるべき表現（カンマ区切り）"
                />
                <input
                  type="text"
                  value={extracted.copyTone.targetDemographic}
                  onChange={(e) =>
                    updateField('copyTone', {
                      ...extracted.copyTone,
                      targetDemographic: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                  placeholder="ターゲット層"
                />
              </div>
            </details>

            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
              >
                キャンセル
              </button>
              <button
                onClick={saveProfile}
                className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-white"
                data-testid="save-profile"
              >
                保存
              </button>
            </div>
          </div>
        )}

        {stage === 'saving' && (
          <div className="py-12 text-center text-slate-300">保存中...</div>
        )}
      </div>
    </div>
  );
}
