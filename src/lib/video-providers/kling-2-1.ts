/**
 * Kling 2.1 (fal.ai 経由) プロバイダ。
 * 3 tier (standard / pro / master) を 1 ファイルでファクトリ化。
 *
 * 注意: Kling は I2V のみ対応 (T2V 別エンドポイント)。
 *      autobanner.jp の主用途は既存バナー画像を動画化することなので
 *      I2V 専用にしぼる。T2V が必要なら別ファイルで追加。
 *
 * 価格 (2026-05 時点、fal.ai 経由):
 *   standard: $0.025/秒
 *   pro:      $0.05/秒
 *   master:   $0.10/秒
 *
 * 尺: 5/10秒のみ。
 */

import { fal } from '@fal-ai/client';
import {
  VideoProvider,
  VideoProviderId,
  VideoStartParams,
  VideoStartResult,
  VideoStatus,
  VideoDownloadResult,
  VideoProviderError,
} from './types';

type KlingTier = 'standard' | 'pro' | 'master';

const PRICE_USD_PER_SECOND: Record<KlingTier, number> = {
  standard: 0.025,
  pro: 0.05,
  master: 0.10,
};

const DISPLAY_NAME: Record<KlingTier, string> = {
  standard: 'Kling 2.1 Standard (最安, 商用 Pro 必須)',
  pro: 'Kling 2.1 Pro (バランス型)',
  master: 'Kling 2.1 Master (最高画質)',
};

function ensureFalConfigured(): void {
  if (!process.env.FAL_KEY) {
    throw new VideoProviderError(
      'kling-2.1-standard',
      'FAL_KEY env not set',
    );
  }
  fal.config({ credentials: process.env.FAL_KEY });
}

function makeKlingProvider(tier: KlingTier): VideoProvider {
  const id = `kling-2.1-${tier}` as VideoProviderId;
  const endpoint = `fal-ai/kling-video/v2.1/${tier}/image-to-video`;
  const pricePerSecond = PRICE_USD_PER_SECOND[tier];

  return {
    id,
    displayName: DISPLAY_NAME[tier],
    supportsAudio: false,
    allowedDurations: [5, 10],

    async start(params: VideoStartParams): Promise<VideoStartResult> {
      ensureFalConfigured();
      if (!params.inputImageUrl) {
        throw new VideoProviderError(id, 'Kling は I2V のみ対応。inputImageUrl が必須');
      }
      if (![5, 10].includes(params.durationSeconds)) {
        throw new VideoProviderError(id, `durationSeconds=${params.durationSeconds} not allowed. Use 5 or 10`);
      }

      // fal.queue.submit は非同期キュー登録。subscribe ではなく submit を使う。
      // banner-tsukurukun の cron がポーリングするため、subscribe の同期完了は不要。
      const submitted = await fal.queue.submit(endpoint, {
        input: {
          prompt: params.prompt,
          image_url: params.inputImageUrl,
          duration: String(params.durationSeconds),
          aspect_ratio: params.aspectRatio,
          cfg_scale: 0.5,
        },
      });

      return {
        operationId: submitted.request_id,
        providerMetadata: {
          endpoint,
          submittedAt: new Date().toISOString(),
        },
      };
    },

    async pollStatus(operationId: string): Promise<VideoStatus> {
      ensureFalConfigured();
      const status = await fal.queue.status(endpoint, {
        requestId: operationId,
      });
      const s = status as { status?: string; logs?: unknown };

      if (s.status === 'IN_QUEUE' || s.status === 'IN_PROGRESS') {
        return { state: 'processing' };
      }
      if (s.status === 'COMPLETED') {
        // 結果を取得
        const result = await fal.queue.result(endpoint, {
          requestId: operationId,
        });
        const r = result as { data?: { video?: { url?: string } } };
        const url = r.data?.video?.url;
        if (!url) {
          return {
            state: 'failed',
            errorMessage: 'Kling completed but no video URL in result',
            providerMetadata: { rawResult: result },
          };
        }
        return { state: 'done', resultUri: url };
      }
      // エラー扱い
      return {
        state: 'failed',
        errorMessage: `Kling status: ${s.status}`,
        providerMetadata: { logs: s.logs },
      };
    },

    async download(resultUri: string): Promise<VideoDownloadResult> {
      const res = await fetch(resultUri);
      if (!res.ok) {
        throw new VideoProviderError(id, `Failed to download: ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        buffer: buf,
        mimeType: res.headers.get('content-type') || 'video/mp4',
      };
    },

    estimateCost(durationSeconds: number) {
      return durationSeconds * pricePerSecond;
    },
  };
}

export const kling21StandardProvider = makeKlingProvider('standard');
export const kling21ProProvider = makeKlingProvider('pro');
export const kling21MasterProvider = makeKlingProvider('master');
