'use client';

import React, { useState, useRef } from 'react';

type Props = {
  onChange: (files: File[]) => void;
  min?: number;
  max?: number;
};

export function ReferenceImageUploader({ onChange, min = 2, max = 7 }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: File[]) => {
    const combined = [...files, ...newFiles].slice(0, max);
    setFiles(combined);
    const urls = combined.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    onChange(combined);
  };

  const removeAt = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith('image/'),
          );
          handleFiles(dropped);
        }}
        onClick={() => inputRef.current?.click()}
        className="p-8 border-2 border-dashed border-slate-600 rounded-lg text-center cursor-pointer hover:border-sky-400 transition-colors"
      >
        <div className="text-slate-300 text-sm">
          参考バナー画像を D&D または クリックして選択（{min}〜{max} 枚）
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            handleFiles(picked);
          }}
        />
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {previews.map((url, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full aspect-square object-cover rounded border border-slate-700"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`remove-${i}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-400">
        {files.length} / {max} 枚
        {files.length < min && ` （あと ${min - files.length} 枚必要）`}
      </div>
    </div>
  );
}
