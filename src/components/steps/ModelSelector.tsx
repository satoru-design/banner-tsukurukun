'use client';

import React from 'react';

type Props = {
  value: 'imagen4' | 'flux';
  onChange: (v: 'imagen4' | 'flux') => void;
  disabled?: boolean;
};

export function ModelSelector({ value, onChange, disabled }: Props) {
  const options: Array<{
    id: 'imagen4' | 'flux';
    label: string;
    hint: string;
  }> = [
    { id: 'imagen4', label: 'Imagen 4 Ultra', hint: '写実・人物・和風に強い' },
    { id: 'flux', label: 'FLUX 1.1 pro', hint: 'アート・ダイナミック・抽象に強い' },
  ];

  return (
    <div className="flex gap-2 p-2 rounded-lg border border-slate-700 bg-slate-900/50">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={[
            'flex-1 px-3 py-2 rounded-md text-sm transition',
            value === o.id
              ? 'bg-sky-500 text-white shadow'
              : 'bg-transparent text-slate-300 hover:bg-slate-800',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          data-testid={`model-${o.id}`}
        >
          <div className="font-medium">{o.label}</div>
          <div className="text-[10px] opacity-70">{o.hint}</div>
        </button>
      ))}
    </div>
  );
}
