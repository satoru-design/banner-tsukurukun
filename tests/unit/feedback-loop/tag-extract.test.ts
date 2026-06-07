import { describe, it, expect } from 'vitest';
import { extractTags } from '@/lib/feedback-loop/tag-extract';

describe('extractTags', () => {
  it('briefSnapshot と image から全次元を抽出する', () => {
    const brief = {
      angleId: 'benefit',
      ctaTemplateId: 'cta_buy_now',
      urgency: 'high',
      emphasisRatio: '3x',
      priceBadge: { type: 'discount' },
    };
    const tags = extractTags(brief, { size: '1080x1080', provider: 'gpt-image' });
    expect(tags).toEqual(
      expect.arrayContaining([
        { dimension: 'angleId', value: 'benefit' },
        { dimension: 'ctaTemplateId', value: 'cta_buy_now' },
        { dimension: 'urgency', value: 'high' },
        { dimension: 'emphasisRatio', value: '3x' },
        { dimension: 'priceBadge', value: 'present' },
        { dimension: 'size', value: '1080x1080' },
        { dimension: 'provider', value: 'gpt-image' },
      ]),
    );
  });

  it('priceBadge が null/未指定なら "absent" になる', () => {
    const tags = extractTags({ priceBadge: null }, { size: '1x1', provider: 'flux' });
    expect(tags).toContainEqual({ dimension: 'priceBadge', value: 'absent' });
  });

  it('欠損次元はスキップする（null/undefined を値にしない）', () => {
    const tags = extractTags({ angleId: 'fear' }, { size: '1x1', provider: 'flux' });
    expect(tags.find((t) => t.dimension === 'ctaTemplateId')).toBeUndefined();
    expect(tags.every((t) => typeof t.value === 'string' && t.value.length > 0)).toBe(true);
  });
});
