/**
 * Phase A.11.5: Generation 画像専用の Vercel Blob クライアント。
 *
 * Path 構造: generations/<userId>/<generationId>/<size>.png
 * → 削除時に prefix 一括 list → del で完全清掃可能
 */
import { put, del, list } from '@vercel/blob';

function ensureToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  return token;
}

/**
 * 生成画像を Blob にアップロード。base64 dataURL を Buffer に変換して put。
 */
export async function uploadGenerationImage(
  userId: string,
  generationId: string,
  size: string,
  base64DataUrl: string,
): Promise<string> {
  const token = ensureToken();
  const base64 = base64DataUrl.split(',')[1] ?? base64DataUrl;
  const buf = Buffer.from(base64, 'base64');

  const safeSize = size.replace(/[^a-zA-Z0-9-]/g, '_');
  const path = `generations/${userId}/${generationId}/${safeSize}.png`;

  const result = await put(path, buf, {
    access: 'public',
    contentType: 'image/png',
    token,
  });
  return result.url;
}

/**
 * 1 セッション分の画像群を一括削除。Generation 削除時に呼ぶ。
 */
export async function deleteGenerationFolder(
  userId: string,
  generationId: string,
): Promise<void> {
  const token = ensureToken();
  const prefix = `generations/${userId}/${generationId}/`;

  const result = await list({ prefix, token });
  if (result.blobs.length === 0) return;

  await del(
    result.blobs.map((b) => b.url),
    { token },
  );
}
