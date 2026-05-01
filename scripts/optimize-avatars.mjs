/**
 * Phase A.15 リスク監査: アバター画像を 256x256 webp に最適化
 *
 * 元: 1024x1024 PNG（~1MB×3）
 * 後: 256x256 WEBP（~30KB×3、LCP 改善）
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const FILES = ['yk-marketer', 'ts-designer', 'mo-owner'];

for (const f of FILES) {
  const src = `public/lp/avatars/${f}.png`;
  const dst = `public/lp/avatars/${f}.webp`;
  const buffer = await readFile(src);
  const optimized = await sharp(buffer)
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 88 })
    .toBuffer();
  await writeFile(dst, optimized);
  const before = (buffer.length / 1024).toFixed(0);
  const after = (optimized.length / 1024).toFixed(0);
  console.log(`${f}: ${before} KB -> ${after} KB`);
}

console.log('\nDone. CustomerVoiceSection の avatarSrc を .webp に切り替え必要。');
