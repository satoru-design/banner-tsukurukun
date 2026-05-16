import { useEffect, useRef } from 'react';
import type { LpSection } from './types';

interface Args {
  lpId: string;
  sections: LpSection[];
  title?: string;
}

export function useAutoSave({ lpId, sections, title }: Args) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>('');

  useEffect(() => {
    const payload = JSON.stringify({ sections, ...(title !== undefined && { title }) });
    if (payload === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lp/${lpId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: payload,
        });
        if (res.ok) {
          lastSaved.current = payload;
        }
      } catch (e) {
        console.error('[auto-save] failed', e);
      }
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [lpId, sections, title]);
}
