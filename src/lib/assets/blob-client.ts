import { put, del } from '@vercel/blob';

const MAX_BYTES = 10 * 1024 * 1024;

function ensureToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  return token;
}

export async function uploadAssetImage(
  assetType: string,
  filename: string,
  bytes: Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<string> {
  const token = ensureToken();

  const buf = bytes instanceof Uint8Array
    ? Buffer.from(bytes)
    : Buffer.from(new Uint8Array(bytes));
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(
      `Image too large: ${buf.byteLength} bytes (max ${MAX_BYTES})`,
    );
  }

  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const safeType = assetType.replace(/[^a-zA-Z0-9-]/g, '_');
  const path = `assets/${safeType}/${Date.now()}-${safeName}`;

  const result = await put(path, buf, {
    access: 'public',
    contentType,
    token,
  });

  return result.url;
}

export async function deleteAssetBlob(url: string): Promise<void> {
  const token = ensureToken();
  await del(url, { token });
}
