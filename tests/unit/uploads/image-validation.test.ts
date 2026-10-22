import { describe, it, expect } from 'vitest';
import { sniffImageMime, validateImageUpload } from '@/lib/uploads/image-validation';

const MAX = 1024 * 1024;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = Buffer.from('GIF89a' + '\u0000\u0000\u0000\u0000', 'latin1');
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'latin1'),
]);
const AVIF = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x20]),
  Buffer.from('ftyp', 'latin1'),
  Buffer.from('avif', 'latin1'),
]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');

describe('sniffImageMime', () => {
  it('recognizes the supported formats from their magic bytes', () => {
    expect(sniffImageMime(PNG)).toBe('image/png');
    expect(sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(sniffImageMime(GIF)).toBe('image/gif');
    expect(sniffImageMime(WEBP)).toBe('image/webp');
    expect(sniffImageMime(AVIF)).toBe('image/avif');
  });

  it('returns null for non-image content', () => {
    expect(sniffImageMime(HTML)).toBeNull();
    expect(sniffImageMime(Buffer.from([0x00, 0x01, 0x02]))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });

  it('does not mistake a truncated RIFF container for WebP', () => {
    expect(sniffImageMime(Buffer.from('RIFF', 'latin1'))).toBeNull();
  });
});

describe('validateImageUpload', () => {
  it('accepts a PNG declared as image/png', () => {
    const r = validateImageUpload('image/png', PNG, MAX);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contentType).toBe('image/png');
  });

  it('tolerates a charset parameter and odd casing in the declared MIME', () => {
    const r = validateImageUpload('IMAGE/PNG; charset=binary', PNG, MAX);
    expect(r.ok).toBe(true);
  });

  it('falls back to the sniffed type when no MIME is declared', () => {
    const r = validateImageUpload(undefined, JPEG, MAX);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contentType).toBe('image/jpeg');
  });

  // 本体の回帰テスト: 以前は申告 MIME をそのまま public Blob の
  // contentType にしていたため、text/html を置いて配信できた。
  it('rejects HTML declared as text/html', () => {
    const r = validateImageUpload('text/html', HTML, MAX);
    expect(r.ok).toBe(false);
  });

  it('rejects HTML that claims to be a PNG', () => {
    const r = validateImageUpload('image/png', HTML, MAX);
    expect(r.ok).toBe(false);
  });

  it('rejects an SVG, which can carry script', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8');
    expect(validateImageUpload('image/svg+xml', svg, MAX).ok).toBe(false);
  });

  it('rejects a real JPEG declared as image/png (declared/actual mismatch)', () => {
    const r = validateImageUpload('image/png', JPEG, MAX);
    expect(r.ok).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(validateImageUpload('image/png', Buffer.alloc(0), MAX).ok).toBe(false);
  });

  it('rejects a file over the size limit', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX)]);
    const r = validateImageUpload('image/png', big, MAX);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('上限');
  });

  it('accepts an ArrayBuffer as well as a Uint8Array', () => {
    const ab = PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength);
    expect(validateImageUpload('image/png', ab as ArrayBuffer, MAX).ok).toBe(true);
  });
});
