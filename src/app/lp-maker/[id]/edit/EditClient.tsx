'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { LpSection } from '@/lib/lp/types';
import { SectionRenderer } from '@/components/lp-maker/SectionRenderer';
import { SectionListPane } from '@/components/lp-maker/SectionListPane';
import { SectionPropsEditor } from '@/components/lp-maker/SectionPropsEditor';
import { PublishModal } from '@/components/lp-maker/PublishModal';

interface Props {
  lpId: string;
  initialTitle: string;
  initialSections: LpSection[];
  initialStatus: string;
  initialSlug: string;
}

export function EditClient({ lpId, initialTitle, initialSections, initialSlug }: Props) {
  const [sections, setSections] = useState<LpSection[]>(initialSections);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [title] = useState(initialTitle);
  const [showPublish, setShowPublish] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 grid grid-cols-1 md:grid-cols-[280px_1fr_320px]">
      <aside className="border-r border-slate-800 bg-slate-900 p-4 overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-4">
          <Link href="/lp-maker" className="text-xs text-slate-400 hover:text-slate-200">
            ← 一覧
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold truncate max-w-[120px]" title={title}>{title}</h2>
            <button
              type="button"
              onClick={() => setShowPublish(true)}
              className="text-[10px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-2 py-1 rounded"
            >
              公開
            </button>
          </div>
        </div>
        <SectionListPane
          sections={sections}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          onChange={setSections}
          lpId={lpId}
        />
      </aside>

      <main className="overflow-y-auto max-h-screen">
        {sections.filter((s) => s.enabled).map((s, i) => (
          <SectionRenderer key={`${s.type}-${i}`} section={s} />
        ))}
      </main>

      <aside className="border-l border-slate-800 bg-slate-900 p-4 overflow-y-auto max-h-screen">
        {selectedIdx !== null && sections[selectedIdx] ? (
          <SectionPropsEditor
            section={sections[selectedIdx]}
            onChange={(next) => {
              const copy = [...sections];
              copy[selectedIdx] = next;
              setSections(copy);
            }}
            lpId={lpId}
          />
        ) : (
          <div className="text-xs text-slate-500 text-center py-8">
            左ペインからセクションを選択して編集
          </div>
        )}
      </aside>
      {showPublish && (
        <PublishModal
          lpId={lpId}
          initialSlug={initialSlug}
          onClose={() => setShowPublish(false)}
          onPublished={(url) => { setPublishedUrl(url); setShowPublish(false); }}
        />
      )}
      {publishedUrl && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-slate-950 p-4 rounded shadow-2xl text-sm max-w-md">
          🎉 公開しました:{' '}
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">
            {publishedUrl}
          </a>
          <button
            type="button"
            onClick={() => setPublishedUrl(null)}
            className="ml-2 text-slate-950/60 hover:text-slate-950"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
