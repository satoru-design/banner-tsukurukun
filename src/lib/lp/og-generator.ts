import sharp from 'sharp';
import { put } from '@vercel/blob';

/**
 * LP の hero headline で OGP 1200x630 PNG を生成し Vercel Blob に保存。
 * Phase A.15 scripts/generate-og-image.mjs と同思想。
 */
export async function generateOgImage(args: {
  landingPageId: string;
  headline: string;
  brandLabel?: string;
}): Promise<{ ogImageUrl: string }> {
  const svg = buildOgSvg(args.headline, args.brandLabel ?? 'LP Maker Pro');

  const png = await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png()
    .toBuffer();

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN missing');

  const blob = await put(
    `lp-maker/${args.landingPageId}/og.png`,
    png,
    { access: 'public', contentType: 'image/png', token }
  );
  return { ogImageUrl: blob.url };
}

function buildOgSvg(headline: string, brand: string): string {
  const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  }[c]!));

  const lines: string[] = [];
  const text = esc(headline);
  const max = 18;
  for (let i = 0; i < text.length; i += max) {
    lines.push(text.slice(i, i + max));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="600" y="${315 - lines.length * 40}" text-anchor="middle" fill="#10b981" font-size="28" font-weight="bold" font-family="sans-serif">${esc(brand)}</text>
  ${lines.map((ln, i) =>
    `<text x="600" y="${330 + i * 80}" text-anchor="middle" fill="#f8fafc" font-size="64" font-weight="900" font-family="sans-serif">${ln}</text>`
  ).join('\n')}
</svg>`;
}
