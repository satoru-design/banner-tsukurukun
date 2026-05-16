'use client';
import type { LpSection } from '@/lib/lp/types';
import { useAutoSave } from '@/lib/lp/use-auto-save';

const SECTION_LABELS: Record<string, string> = {
  hero: 'FV',
  problem: '課題',
  solution: '解決策',
  features: '機能',
  numeric_proof: '数字訴求',
  comparison: '比較',
  voice: 'お客様の声',
  pricing: '料金',
  faq: 'FAQ',
  inline_cta: '中間 CTA',
  final_cta: '最終 CTA',
};

interface Props {
  sections: LpSection[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onChange: (sections: LpSection[]) => void;
  lpId: string;
  title: string;
}

export function SectionListPane({ sections, selectedIdx, onSelect, onChange, lpId, title }: Props) {
  useAutoSave({ lpId, sections, title });

  function toggleEnabled(idx: number) {
    const next = [...sections];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    onChange(next);
  }

  function move(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    next.forEach((s, i) => { s.order = i; });
    onChange(next);
  }

  return (
    <ul className="space-y-2">
      {sections.map((s, idx) => (
        <li
          key={`${s.type}-${idx}`}
          className={`rounded p-2 border ${
            selectedIdx === idx
              ? 'bg-slate-800 border-emerald-500/40'
              : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onSelect(idx)}
              className="flex-1 text-left text-sm font-bold text-slate-200"
            >
              {SECTION_LABELS[s.type] ?? s.type}
            </button>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={() => toggleEnabled(idx)}
                className="accent-emerald-500"
              />
              <span className="text-[10px] text-slate-500">ON</span>
            </label>
          </div>
          <div className="flex gap-1 mt-1">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="text-[10px] text-slate-500 hover:text-slate-200 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === sections.length - 1}
              className="text-[10px] text-slate-500 hover:text-slate-200 disabled:opacity-30"
            >
              ↓
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
