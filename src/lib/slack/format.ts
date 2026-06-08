/** 12345 -> '¥12.3K' / 1200000 -> '¥1.2M' / 0..999 -> '¥123' */
export function yen(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `¥${(n / 1_000).toFixed(1)}K`;
  return `¥${Math.round(n)}`;
}
/** 1200000 -> '1.2M' / 8400 -> '8,400' / 300 -> '300' */
export function count(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return Math.round(n).toLocaleString('en-US');
}
/** 0.0291 -> '2.91%'（比率→%）。null は '–' */
export function ratioPct(r: number | null): string {
  return r === null ? '–' : `${(r * 100).toFixed(2)}%`;
}
/** 等幅テーブル: 1列目は左詰め、以降右詰め。Slack ``` で囲む前提 */
export function fixedTable(headers: string[], rows: string[][], widths: number[]): string {
  const pad = (s: string, w: number, left = false) => (left ? s.padEnd(w) : s.padStart(w));
  const head = headers.map((h, i) => pad(h, widths[i], true)).join(' ');
  const sep = '-'.repeat(widths.reduce((a, b) => a + b, 0) + headers.length - 1);
  const body = rows.map((r) => r.map((c, i) => pad(c, widths[i], i === 0)).join(' ')).join('\n');
  return [head, sep, body].join('\n');
}
