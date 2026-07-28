import { describe, it, expect } from 'vitest';
import {
  IRONCLAD_SIZE_CATEGORIES,
  SIZE_TO_API_IRONCLAD,
  getIroncladSizeMeta,
  type StaticIroncladSize,
} from '@/lib/prompts/ironclad-banner';

/**
 * サイズ定義の一貫性テスト（CLAUDE.md: banner-sizes は単一の真実源）。
 * LINEヤフー（YDA）サイズ追加時のリグレッションを防ぐ。
 */

const LINE_YAHOO_SIZES: StaticIroncladSize[] = [
  'LINEヤフー 1:1 (1200x1200)',
  'LINEヤフー 6:5 (1200x1000)',
  'LINEヤフー 16:9 (1280x720)',
  'LINEヤフー 1:2 (600x1200)',
  'LINEヤフー 4:15 (320x1200)',
  'LINEヤフー 16:5 (1280x400)',
  'LINEヤフー 32:5 (1280x200)',
  'LINEヤフー 728:90 (1456x180)',
  'LINEヤフー 39:5 (936x120)',
];

describe('ironclad size definitions', () => {
  it('カテゴリに含まれる全サイズが SIZE_TO_API_IRONCLAD に定義されている', () => {
    for (const cat of IRONCLAD_SIZE_CATEGORIES) {
      for (const size of cat.sizes) {
        expect(SIZE_TO_API_IRONCLAD[size], `${size} が未定義`).toBeDefined();
      }
    }
  });

  it('LINEヤフーカテゴリが公式9サイズを漏れなく持つ', () => {
    const cat = IRONCLAD_SIZE_CATEGORIES.find((c) => c.key === 'LINEヤフー');
    expect(cat).toBeDefined();
    expect(cat!.sizes).toEqual(LINE_YAHOO_SIZES);
  });

  it('LINEヤフー各サイズが gpt-image-2 制約を満たす apiSize を持つ', () => {
    for (const size of LINE_YAHOO_SIZES) {
      const meta = getIroncladSizeMeta(size);
      const m = meta.apiSize.match(/^(\d+)x(\d+)$/);
      expect(m, `${size} の apiSize=${meta.apiSize} が不正`).not.toBeNull();
      const w = Number(m![1]);
      const h = Number(m![2]);
      // 16px 倍数
      expect(w % 16, `${size} 幅が16px倍数でない`).toBe(0);
      expect(h % 16, `${size} 高さが16px倍数でない`).toBe(0);
      // 総ピクセル 655,360〜8,294,400
      expect(w * h).toBeGreaterThanOrEqual(655_360);
      expect(w * h).toBeLessThanOrEqual(8_294_400);
      // アスペクト比 ≤ 3:1（生成バケット段階）
      expect(Math.max(w / h, h / w)).toBeLessThanOrEqual(3.0001);
      expect(meta.category).toBe('LINEヤフー');
    }
  });

  it('3:1 を超える横長/縦長サイズは needsCrop フラグが立つ', () => {
    const overRatio: StaticIroncladSize[] = [
      'LINEヤフー 4:15 (320x1200)',
      'LINEヤフー 16:5 (1280x400)',
      'LINEヤフー 32:5 (1280x200)',
      'LINEヤフー 728:90 (1456x180)',
      'LINEヤフー 39:5 (936x120)',
    ];
    for (const size of overRatio) {
      expect(SIZE_TO_API_IRONCLAD[size].needsCrop, `${size} は needsCrop=true 想定`).toBe(true);
    }
  });
});
