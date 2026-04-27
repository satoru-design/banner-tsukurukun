/**
 * Phase A.11.5: クライアント側で jszip を使った ZIP 生成・ダウンロード。
 * GET /api/history/[id]/zip で URL リスト取得 → fetch → JSZip → blob URL → click DL
 */
import JSZip from 'jszip';

interface ZipImageMeta {
  size: string;
  blobUrl: string;
  filename: string;
}

interface ZipApiResponse {
  filenamePrefix: string;
  images: ZipImageMeta[];
}

export async function downloadGenerationZip(generationId: string): Promise<void> {
  const res = await fetch(`/api/history/${generationId}/zip`);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as ZipApiResponse;

  const zip = new JSZip();
  await Promise.all(
    data.images.map(async (img) => {
      const r = await fetch(img.blobUrl);
      const buf = await r.arrayBuffer();
      zip.file(img.filename, buf);
    }),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.filenamePrefix}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
