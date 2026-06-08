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
/**
 * 文字列の「表示幅」を返す。全角（CJK・かな・全角記号など）は2、半角は1として数える。
 * JS の String.length は全角を1と数えるため、等幅テーブルで全角ヘッダと半角データが桁ズレする。
 * これを防ぐため East Asian Width 相当の判定で表示幅を計算する。
 */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const isWide =
      (c >= 0x1100 && c <= 0x115f) || // Hangul Jamo
      (c >= 0x2e80 && c <= 0x303e) || // CJK 部首・康熙・記号
      (c >= 0x3041 && c <= 0x33ff) || // ひらがな・カタカナ・CJK記号
      (c >= 0x3400 && c <= 0x4dbf) || // CJK拡張A
      (c >= 0x4e00 && c <= 0x9fff) || // CJK統合漢字
      (c >= 0xa000 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) || // ハングル音節
      (c >= 0xf900 && c <= 0xfaff) || // CJK互換漢字
      (c >= 0xfe30 && c <= 0xfe4f) || // CJK互換形
      (c >= 0xff00 && c <= 0xff60) || // 全角形
      (c >= 0xffe0 && c <= 0xffe6); // 全角記号（￥ U+FFE5 等）
    w += isWide ? 2 : 1;
  }
  return w;
}

/** 等幅テーブル: 1列目は左詰め、以降右詰め。表示幅(全角=2)基準で揃える。Slack ``` で囲む前提 */
export function fixedTable(headers: string[], rows: string[][], widths: number[]): string {
  const pad = (s: string, w: number, left = false) => {
    const fill = Math.max(0, w - displayWidth(s));
    return left ? s + ' '.repeat(fill) : ' '.repeat(fill) + s;
  };
  const head = headers.map((h, i) => pad(h, widths[i], true)).join(' ');
  const sep = '-'.repeat(widths.reduce((a, b) => a + b, 0) + headers.length - 1);
  const body = rows.map((r) => r.map((c, i) => pad(c, widths[i], i === 0)).join(' ')).join('\n');
  return [head, sep, body].join('\n');
}
