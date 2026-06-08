import { describe, it, expect } from 'vitest';
import { parseAdStatuses } from '@/lib/feedback-loop/ad-status';

describe('parseAdStatuses', () => {
  it('id→effective_status のマップを作る', () => {
    const m = parseAdStatuses([
      { id: '1', effective_status: 'ACTIVE' },
      { id: '2', effective_status: 'PAUSED' },
    ]);
    expect(m.get('1')).toBe('ACTIVE');
    expect(m.get('2')).toBe('PAUSED');
    expect(m.size).toBe(2);
  });
  it('effective_status 欠落はスキップ', () => {
    const m = parseAdStatuses([{ id: '1' }, { id: '2', effective_status: 'ACTIVE' }]);
    expect(m.has('1')).toBe(false);
    expect(m.get('2')).toBe('ACTIVE');
  });
});
