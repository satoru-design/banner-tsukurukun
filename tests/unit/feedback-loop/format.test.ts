import { describe, it, expect } from 'vitest';
import { displayWidth, fixedTable, yen, count, ratioPct } from '@/lib/slack/format';

describe('displayWidth', () => {
  it('半角は1、全角は2として数える', () => {
    expect(displayWidth('abc')).toBe(3);
    expect(displayWidth('期間')).toBe(4); // 全角2文字 = 4
    expect(displayWidth('CTR')).toBe(3);
    expect(displayWidth('クリック')).toBe(8); // カタカナ4文字 = 8
    expect(displayWidth('26/05/31')).toBe(8); // 半角8
  });
  it('全角￥(U+FFE5)は2、半角¥(U+00A5)は1', () => {
    expect(displayWidth('￥')).toBe(2);
    expect(displayWidth('¥')).toBe(1);
  });
});

describe('fixedTable 桁揃え（表示幅基準）', () => {
  it('全角ヘッダと半角データ行の表示幅が一致する', () => {
    const headers = ['期間', '広告費'];
    const widths = [14, 8]; // 1列目は最長データ '26/05/31-06/06'(表示幅14) を収める
    const rows = [['26/05/31-06/06', yen(271000)]];
    const out = fixedTable(headers, rows, widths);
    const lines = out.split('\n');
    // ヘッダ行とデータ行の表示幅が等しい（桁揃いの証明）
    expect(displayWidth(lines[0])).toBe(displayWidth(lines[2]));
  });
});

describe('format helpers', () => {
  it('yen 短縮', () => {
    expect(yen(271000)).toBe('¥271.0K');
    expect(yen(1_100_000)).toBe('¥1.1M');
    expect(yen(480)).toBe('¥480');
  });
  it('count 短縮', () => {
    expect(count(8400)).toBe('8,400');
    expect(count(1_100_000)).toBe('1.1M');
  });
  it('ratioPct', () => {
    expect(ratioPct(0.029)).toBe('2.90%');
    expect(ratioPct(null)).toBe('–');
  });
});
