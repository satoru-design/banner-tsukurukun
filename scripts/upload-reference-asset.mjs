/**
 * 参照画像 (productImageUrl 等に使う実機写真・バッジ) を Vercel Blob に手動アップロードするヘルパー。
 *
 * 使い方:
 *   node --env-file=.env scripts/upload-reference-asset.mjs <ローカルファイル> <blob上のパス>
 * 例:
 *   node --env-file=.env scripts/upload-reference-asset.mjs "C:/path/device.png" reference-assets/homeheart-duranta.png
 *
 * 必要 env: BLOB_READ_WRITE_TOKEN
 */
import { put } from '@vercel/blob';
import { readFileSync } from 'node:fs';

const [, , localPath, blobPath] = process.argv;
if (!localPath || !blobPath) {
  console.error('Usage: node scripts/upload-reference-asset.mjs <local-file> <blob-path>');
  process.exit(1);
}

const buf = readFileSync(localPath);
const ext = blobPath.split('.').pop()?.toLowerCase();
const contentType =
  ext === 'png' ? 'image/png'
  : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
  : ext === 'webp' ? 'image/webp'
  : 'application/octet-stream';

const blob = await put(blobPath, buf, {
  access: 'public',
  contentType,
  addRandomSuffix: false,
});
console.log(blob.url);
