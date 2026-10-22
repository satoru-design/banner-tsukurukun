/**
 * アップロード画像の検証。
 *
 * これまでのアップロード経路は拡張子も MIME も検証せず、
 * クライアントが申告した `File.type` をそのまま Vercel Blob の
 * `contentType` に渡していた。Blob は public なので、
 * `text/html` を申告した HTML を置けばそのまま配信される。
 *
 * ここでは次の二段で弾く。
 *  1. MIME allowlist（クライアント申告値）
 *  2. 先頭バイト列（マジックバイト）による実体判定
 *
 * 保存時の contentType は申告値ではなく「実体から判定した値」を使う。
 */

/** 許可する画像形式。 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export interface ImageValidationOk {
  ok: true;
  /** マジックバイトから判定した実際の MIME type。保存時はこちらを使う。 */
  contentType: AllowedImageMime;
}

export interface ImageValidationError {
  ok: false;
  /** クライアントに返して差し支えない理由。 */
  reason: string;
}

export type ImageValidationResult = ImageValidationOk | ImageValidationError;

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function asciiAt(buf: Uint8Array, offset: number, text: string): boolean {
  return startsWith(
    buf,
    Array.from(text, (c) => c.charCodeAt(0)),
    offset,
  );
}

/**
 * 先頭バイト列から画像形式を判定する。判定できなければ null。
 */
export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  // GIF: "GIF87a" / "GIF89a"
  if (asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a')) {
    return 'image/gif';
  }
  // WebP: "RIFF" .... "WEBP"
  if (asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')) {
    return 'image/webp';
  }
  // AVIF: ISO-BMFF ftyp box with avif / avis brand
  if (asciiAt(bytes, 4, 'ftyp') && (asciiAt(bytes, 8, 'avif') || asciiAt(bytes, 8, 'avis'))) {
    return 'image/avif';
  }
  return null;
}

/**
 * 申告 MIME と実体の両方を検証する。
 *
 * @param declaredMime クライアント申告の MIME（File.type 等）
 * @param bytes ファイル本体
 * @param maxBytes 許容する最大バイト数
 */
export function validateImageUpload(
  declaredMime: string | null | undefined,
  bytes: ArrayBuffer | Uint8Array,
  maxBytes: number,
): ImageValidationResult {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (view.byteLength === 0) {
    return { ok: false, reason: 'ファイルが空です' };
  }
  if (view.byteLength > maxBytes) {
    return {
      ok: false,
      reason: `ファイルサイズが上限 (${Math.floor(maxBytes / 1024 / 1024)}MB) を超えています`,
    };
  }

  // 1. 申告 MIME の allowlist。未申告は許容し、実体判定に委ねる。
  const declared = (declaredMime ?? '').split(';')[0].trim().toLowerCase();
  if (declared && !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(declared)) {
    return {
      ok: false,
      reason: `対応していない形式です (${ALLOWED_IMAGE_MIME_TYPES.join(', ')} のみ)`,
    };
  }

  // 2. マジックバイトによる実体判定。
  const sniffed = sniffImageMime(view);
  if (!sniffed) {
    return { ok: false, reason: '画像ファイルとして認識できませんでした' };
  }

  // 3. 申告と実体の不一致は拒否（png を騙る html 等を弾く）。
  if (declared && declared !== sniffed) {
    return { ok: false, reason: '申告された形式とファイルの実体が一致しません' };
  }

  return { ok: true, contentType: sniffed };
}
