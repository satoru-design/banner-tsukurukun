/**
 * Phase B.1: Generation 動画専用の Vercel Blob クライアント。
 *
 * Path 構造: generations/<userId>/<generationId>/videos/<videoId>.mp4
 * → 既存 generations/<userId>/<generationId>/ 配下に動画を統合配置
 */
import { put } from '@vercel/blob';

function ensureToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  return token;
}

/**
 * 生成動画を Blob にアップロード。Buffer をそのまま put。
 */
export async function uploadGenerationVideo(
  userId: string,
  generationId: string,
  videoId: string,
  buffer: Buffer,
  mimeType = 'video/mp4',
): Promise<string> {
  const token = ensureToken();
  const path = `generations/${userId}/${generationId}/videos/${videoId}.mp4`;

  const blob = await put(path, buffer, {
    access: 'public',
    token,
    contentType: mimeType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return blob.url;
}
