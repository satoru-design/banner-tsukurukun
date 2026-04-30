/**
 * Phase A.15: OGP 画像（1200×630）を生成して public/og-image.png に出力
 *
 * デザイン:
 * - 背景: slate-950 + emerald radial highlight（LpHero と統一感）
 * - タイトル: 勝ちバナー作る君
 * - タグライン: テンプレを作る時間、もう要りません
 * - サブコピー: 1 ブリーフで 17 サイズ一括生成 / autobanner.jp
 * - 装飾: 小さなバナーモックグリッド
 *
 * 使い方:
 *   node scripts/generate-og-image.mjs
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const W = 1200;
const H = 630;

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="rg" cx="20%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.30"/>
      <stop offset="60%" stop-color="#10B981" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="text-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#A7F3D0"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="black" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- background -->
  <rect width="100%" height="100%" fill="#020617"/>
  <rect width="100%" height="100%" fill="url(#rg)"/>

  <!-- left content -->
  <g transform="translate(80, 110)">
    <!-- emoji + brand badge -->
    <g>
      <rect x="0" y="0" width="320" height="48" rx="24" fill="#10B981" fill-opacity="0.10" stroke="#10B981" stroke-opacity="0.40" stroke-width="1"/>
      <text x="22" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="#6EE7B7">🏆 勝ちバナー作る君</text>
    </g>

    <!-- main headline (3 lines, fits left half) -->
    <text x="0" y="160" font-family="'Noto Sans JP', system-ui, sans-serif" font-size="68" font-weight="900" fill="#F8FAFC" filter="url(#shadow)">テンプレを作る</text>
    <text x="0" y="240" font-family="'Noto Sans JP', system-ui, sans-serif" font-size="68" font-weight="900" fill="#F8FAFC" filter="url(#shadow)">時間、もう</text>
    <text x="0" y="320" font-family="'Noto Sans JP', system-ui, sans-serif" font-size="68" font-weight="900" fill="url(#text-grad)" filter="url(#shadow)">要りません。</text>

    <!-- subline -->
    <text x="0" y="385" font-family="'Noto Sans JP', system-ui, sans-serif" font-size="26" font-weight="500" fill="#CBD5E1">AI が 17 サイズを 90 秒で一括生成</text>

    <!-- url badge -->
    <text x="0" y="440" font-family="'Noto Sans JP', system-ui, sans-serif" font-size="24" font-weight="700" fill="#10B981">autobanner.jp</text>
  </g>

  <!-- right banner mock grid (compact, fits right half) -->
  <g transform="translate(770, 130)">
    <!-- big square banner -->
    <rect x="0" y="0" width="240" height="240" rx="14" fill="#1E293B" stroke="#334155" stroke-width="1"/>
    <rect x="18" y="34" width="160" height="12" rx="3" fill="#10B981" fill-opacity="0.6"/>
    <rect x="18" y="54" width="200" height="28" rx="3" fill="#F1F5F9"/>
    <rect x="18" y="86" width="170" height="28" rx="3" fill="#F1F5F9"/>
    <rect x="18" y="190" width="100" height="32" rx="16" fill="#10B981"/>

    <!-- top right small -->
    <rect x="260" y="0" width="170" height="115" rx="10" fill="#1E293B" stroke="#334155" stroke-width="1"/>
    <rect x="278" y="20" width="80" height="9" rx="2" fill="#10B981" fill-opacity="0.6"/>
    <rect x="278" y="36" width="130" height="20" rx="2" fill="#F1F5F9"/>
    <rect x="278" y="86" width="70" height="20" rx="10" fill="#10B981"/>

    <!-- middle right small -->
    <rect x="260" y="125" width="170" height="115" rx="10" fill="#1E293B" stroke="#334155" stroke-width="1"/>
    <rect x="278" y="145" width="80" height="9" rx="2" fill="#10B981" fill-opacity="0.6"/>
    <rect x="278" y="161" width="130" height="20" rx="2" fill="#F1F5F9"/>
    <rect x="278" y="211" width="70" height="20" rx="10" fill="#10B981"/>

    <!-- wide bottom strip -->
    <rect x="0" y="260" width="430" height="55" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1"/>
    <rect x="18" y="275" width="100" height="9" rx="2" fill="#10B981" fill-opacity="0.6"/>
    <rect x="18" y="291" width="240" height="13" rx="2" fill="#F1F5F9"/>
    <rect x="350" y="280" width="65" height="20" rx="10" fill="#10B981"/>
  </g>
</svg>
`;

const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
await writeFile('public/og-image.png', buffer);
console.log(`Generated OGP image: public/og-image.png (${(buffer.length / 1024).toFixed(0)} KB, ${W}x${H})`);
