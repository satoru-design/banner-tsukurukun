/**
 * Phase A.15: LP デモ動画を Vercel Blob にアップロードする一時スクリプト。
 *
 * 使い方:
 *   node --env-file=.env scripts/upload-demo-video.mjs <ローカル mp4 パス>
 *
 * 出力:
 *   アップロード先 Public URL（このまま env NEXT_PUBLIC_DEMO_VIDEO_URL にセット）
 *
 * 必要 env:
 *   - BLOB_READ_WRITE_TOKEN
 */
import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: node --env-file=.env scripts/upload-demo-video.mjs <path-to-mp4>');
  process.exit(1);
}

const buffer = await readFile(sourcePath);
const fileName = basename(sourcePath);
const blobPath = `lp/demo/${Date.now()}-${fileName}`;

console.log(`Uploading ${fileName} (${(buffer.length / 1024 / 1024).toFixed(2)} MB) to Vercel Blob...`);
const result = await put(blobPath, buffer, {
  access: 'public',
  contentType: 'video/mp4',
  cacheControlMaxAge: 60 * 60 * 24 * 365, // 1 year (immutable URL with timestamp)
});

console.log('\n=== Upload complete ===');
console.log(`URL: ${result.url}`);
console.log(`\nNext: set this URL to Vercel env var NEXT_PUBLIC_DEMO_VIDEO_URL`);
