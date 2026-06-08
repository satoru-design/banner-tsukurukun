import { describe, it, expect } from 'vitest';
import { formatWinningPatternsPrefix } from '@/lib/feedback-loop/prompt-injection';

describe('formatWinningPatternsPrefix', () => {
  it('勝ちパターンを日本語の指示文に整形する', () => {
    const prefix = formatWinningPatternsPrefix([
      { dimension: 'angleId', value: 'benefit', score: 0.95 },
      { dimension: 'urgency', value: 'high', score: 0.8 },
    ]);
    expect(prefix).toContain('benefit');
    expect(prefix).toContain('urgency');
    expect(prefix.length).toBeGreaterThan(0);
  });

  it('空配列なら空文字を返す（プロンプトを汚さない）', () => {
    expect(formatWinningPatternsPrefix([])).toBe('');
  });

  it('score>=0.5 のみ採用する（弱い要因は注入しない）', () => {
    const prefix = formatWinningPatternsPrefix([
      { dimension: 'angleId', value: 'weak', score: 0.2 },
    ]);
    expect(prefix).toBe('');
  });
});
