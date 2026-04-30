import sharp from 'sharp';

/**
 * Phase A.14: 画像に PREVIEW 透かしを焼き込む
 *
 * - 中央に「PREVIEW」斜め大文字（白半透明 30%）
 * - 下部に「Pro なら透かしなし」小文字（白半透明 50%）
 * - 黒ドロップシャドウで読みやすさ確保
 * - フォントサイズは幅の 8%
 *
 * 失敗時は元画像をそのまま返す（生成成功を優先）。
 */
export const applyPreviewWatermark = async (imageBuffer: Buffer): Promise<Buffer> => {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const w = meta.width ?? 1080;
    const h = meta.height ?? 1080;
    const fontSizeMain = Math.round(w * 0.08);
    const fontSizeSub = Math.round(w * 0.025);

    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="ds" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="black" flood-opacity="0.6"/>
          </filter>
        </defs>
        <text x="${w / 2}" y="${h / 2}"
              text-anchor="middle"
              dominant-baseline="middle"
              transform="rotate(-30, ${w / 2}, ${h / 2})"
              font-family="Arial, sans-serif"
              font-weight="900"
              font-size="${fontSizeMain}"
              fill="white"
              fill-opacity="0.30"
              filter="url(#ds)"
              letter-spacing="${Math.round(fontSizeMain * 0.1)}">PREVIEW</text>
        <text x="${w / 2}" y="${h - h * 0.05}"
              text-anchor="middle"
              font-family="Arial, sans-serif"
              font-weight="700"
              font-size="${fontSizeSub}"
              fill="white"
              fill-opacity="0.50"
              filter="url(#ds)">Pro なら透かしなし</text>
      </svg>
    `;

    return await sharp(imageBuffer)
      .composite([{ input: Buffer.from(svg), gravity: 'center' }])
      .toBuffer();
  } catch (e) {
    console.error('[watermark] failed, returning original', e);
    return imageBuffer;
  }
};
