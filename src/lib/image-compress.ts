// src/lib/image-compress.ts
// クライアント側で画像を「指定した上限容量（バイト）以下」に圧縮するユーティリティ。
// 生成物は data URL (PNG) のため、canvas で JPEG/WebP へ再エンコードし、
// 画質(quality)を二分探索して上限バイト以下に収める。1回の再エンコードで収まらない
// 場合は寸法を段階的に縮小してリトライする。ブラウザ (DOM/canvas) 専用。

export type CompressMime = 'image/jpeg' | 'image/webp';

export interface CompressResult {
  /** 圧縮後の Blob */
  blob: Blob;
  /** 実バイト数 */
  bytes: number;
  width: number;
  height: number;
  /** 最終的に採用した画質 (0〜1) */
  quality: number;
  /** 寸法縮小をかけたか */
  scaled: boolean;
  /** 上限以下に収められたか（false=最小画質・最小寸法でも超過） */
  withinLimit: boolean;
  mime: CompressMime;
}

/** data URL / 通常 URL から HTMLImageElement を生成 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

/** canvas.toBlob を Promise 化 */
function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}

/** 指定寸法で描画した canvas を返す（JPEG のため白背景で透過を平坦化） */
function drawToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  background: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas コンテキストを取得できませんでした');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * ある寸法で画質を二分探索し、maxBytes 以下で最大画質の Blob を返す。
 * どの画質でも収まらなければ「最小画質の Blob」を返す（withinLimit=false 判定は呼び出し側）。
 */
async function bestBlobAtSize(
  canvas: HTMLCanvasElement,
  mime: CompressMime,
  maxBytes: number,
  minQuality: number,
): Promise<{ blob: Blob; quality: number }> {
  let lo = minQuality;
  let hi = 0.95;
  // まず最高画質で収まるなら即返す
  const hiBlob = await canvasToBlob(canvas, mime, hi);
  if (hiBlob && hiBlob.size <= maxBytes) return { blob: hiBlob, quality: hi };

  let best: { blob: Blob; quality: number } | null = null;
  // 収まる最小画質での最大画質を二分探索（10 反復で十分な精度）
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, mime, mid);
    if (!blob) break;
    if (blob.size <= maxBytes) {
      best = { blob, quality: mid };
      lo = mid; // もっと高画質を狙える
    } else {
      hi = mid; // 下げる
    }
  }
  if (best) return best;
  // 収まらなかった場合は最小画質の Blob を返す
  const floorBlob = await canvasToBlob(canvas, mime, minQuality);
  return { blob: floorBlob ?? hiBlob!, quality: minQuality };
}

/**
 * 画像を上限バイト以下へ圧縮する。
 * @param src      画像 (data URL / URL)
 * @param maxBytes 上限容量（バイト）
 */
export async function compressImageToTargetBytes(
  src: string,
  maxBytes: number,
  opts: { mime?: CompressMime; background?: string; minQuality?: number } = {},
): Promise<CompressResult> {
  const mime: CompressMime = opts.mime ?? 'image/jpeg';
  const background = opts.background ?? '#ffffff';
  const minQuality = opts.minQuality ?? 0.3;

  const img = await loadImage(src);
  const baseW = img.naturalWidth || img.width;
  const baseH = img.naturalHeight || img.height;

  // 寸法スケールを 1.0 から段階的に下げてリトライ（最大 6 段階＝約 0.9^5）
  const scales = [1, 0.85, 0.7, 0.55, 0.4, 0.28];
  let last: { blob: Blob; quality: number; width: number; height: number } | null = null;

  for (let i = 0; i < scales.length; i++) {
    const scale = scales[i];
    const w = baseW * scale;
    const h = baseH * scale;
    const canvas = drawToCanvas(img, w, h, background);
    const { blob, quality } = await bestBlobAtSize(canvas, mime, maxBytes, minQuality);
    last = { blob, quality, width: canvas.width, height: canvas.height };
    if (blob.size <= maxBytes) {
      return {
        blob,
        bytes: blob.size,
        width: canvas.width,
        height: canvas.height,
        quality,
        scaled: scale !== 1,
        withinLimit: true,
        mime,
      };
    }
  }

  // 全段階で収まらなかった → 最小構成の結果をベストエフォートで返す
  const l = last!;
  return {
    blob: l.blob,
    bytes: l.blob.size,
    width: l.width,
    height: l.height,
    quality: l.quality,
    scaled: true,
    withinLimit: false,
    mime,
  };
}

/** Blob → base64（プレフィックスなし）。JSZip 投入用。 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.onerror = () => reject(new Error('Blob の base64 変換に失敗しました'));
    reader.readAsDataURL(blob);
  });
}
