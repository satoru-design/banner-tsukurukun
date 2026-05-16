'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { LpSection } from '@/lib/lp/types';
import { SectionRenderer } from '@/components/lp-maker/SectionRenderer';
import { SectionListPane } from '@/components/lp-maker/SectionListPane';
import { SectionPropsEditor } from '@/components/lp-maker/SectionPropsEditor';

interface Props {
  lpId: string;
  initialTitle: string;
  initialSections: LpSection[];
  initialStatus: string;
  initialSlug: string;
}

export function EditClient({ lpId, initialTitle, initialSections }: Props) {
  const [sections, setSections] = useState<LpSection[]>(initialSections);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [title] = useState(initialTitle);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 grid grid-cols-1 md:grid-cols-[280px_1fr_320px]">
      <aside className="border-r border-slate-800 bg-slate-900 p-4 overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-4">
          <Link href="/lp-maker" className="text-xs text-slate-400 hover:text-slate-200">
            ← 一覧
          </Link>
          <h2 className="text-sm font-bold">{title}</h2>
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
    </div>
  );
}
