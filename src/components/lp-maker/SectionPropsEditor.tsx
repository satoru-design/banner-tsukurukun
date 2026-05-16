'use client';
import type { LpSection } from '@/lib/lp/types';

interface Props {
  section: LpSection;
  onChange: (next: LpSection) => void;
  lpId: string;
}

export function SectionPropsEditor({ section, onChange }: Props) {
  function updateField(path: string[], value: unknown) {
    const next = structuredClone(section);
    let cursor: Record<string, unknown> | unknown[] = next.props as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = (cursor as Record<string, unknown>)[path[i]] as Record<string, unknown> | unknown[];
    }
    (cursor as Record<string, unknown>)[path[path.length - 1]] = value;
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-200 mb-3">
          {section.type} 編集
        </h3>
      </div>
      <FieldsRenderer
        node={section.props}
        path={[]}
        onUpdate={updateField}
      />
    </div>
  );
}

function FieldsRenderer({
  node,
  path,
  onUpdate,
}: {
  node: unknown;
  path: string[];
  onUpdate: (path: string[], value: unknown) => void;
}) {
  if (typeof node === 'string') {
    return (
      <textarea
        defaultValue={node}
        onChange={(e) => onUpdate(path, e.target.value)}
        rows={Math.min(8, Math.max(1, Math.ceil(node.length / 40)))}
        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-100"
      />
    );
  }
  if (Array.isArray(node)) {
    return (
      <div className="space-y-3 pl-2 border-l border-slate-700">
        {node.map((item, idx) => (
          <div key={idx}>
            <p className="text-[10px] text-slate-500 mb-1">item {idx + 1}</p>
            <FieldsRenderer
              node={item}
              path={[...path, String(idx)]}
              onUpdate={onUpdate}
            />
          </div>
        ))}
      </div>
    );
  }
  if (node && typeof node === 'object') {
    return (
      <div className="space-y-3">
        {Object.entries(node).map(([key, value]) => (
          <div key={key}>
            <label className="block text-[10px] text-slate-400 mb-1">{key}</label>
            <FieldsRenderer
              node={value}
              path={[...path, key]}
              onUpdate={onUpdate}
            />
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-xs text-slate-500">(unsupported)</p>;
}
