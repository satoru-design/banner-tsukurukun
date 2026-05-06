/**
 * Kling 2.1 (fal.ai 経由) プロバイダ。
 * 3 tier (standard / pro / master) を 1 ファイルでファクトリ化。
 *
 * 注意: Kling は I2V のみ対応。inputImageUrl 必須。
 *
 * 価格 (2026-05 時点、fal.ai 経由):
 *   standard: $0.025/秒  pro: $0.05/秒  master: $0.10/秒
 * 尺: 5/10秒のみ。
 */

import { fal } from '@fal-ai/client';
import {
  VideoProvider,
  VideoProviderId,
  VideoStartParams,
  VideoRunResult,
  VideoProviderError,
} from './types';

type KlingTier = 'standard' | 'pro' | 'master';

const PRICE_USD_PER_SECOND: Record<KlingTier, number> = {
  standard: 0.025,
  pro: 0.05,
  master: 0.10,
};

const DISPLAY_NAME: Record<KlingTier, string> = {
  standard: 'Kling 2.1 Standard',
  pro: 'Kling 2.1 Pro',
  master: 'Kling 2.1 Master',
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

    async run(params: VideoStartParams, options?: { maxWaitMs?: number }): Promise<VideoRunResult> {
      ensureFalConfigured();
      if (!params.inputImageUrl) {
        throw new VideoProviderError(id, 'Kling は I2V のみ対応。inputImageUrl が必須');
      }
      if (![5, 10].includes(params.durationSeconds)) {
        throw new VideoProviderError(id, `durationSeconds=${params.durationSeconds} not allowed. Use 5 or 10`);
      }

      const maxWaitMs = options?.maxWaitMs ?? 270_000;

      const result = await fal.subscribe(endpoint, {
        input: {
          prompt: params.prompt,
          image_url: params.inputImageUrl,
          duration: String(params.durationSeconds),
          aspect_ratio: params.aspectRatio,
          cfg_scale: 0.5,
        },
        // fal.subscribe は内部で polling するので timeout の扱いは fal 側
      });

      const data = result as { data?: { video?: { url?: string } }; request_id?: string };
      const videoUrl = data.data?.video?.url;
      if (!videoUrl) {
        throw new VideoProviderError(id, `Kling completed but no video URL: ${JSON.stringify(data).slice(0, 300)}`);
      }

      // download
      const res = await fetch(videoUrl);
      if (!res.ok) {
        throw new VideoProviderError(id, `Failed to download: ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());

      return {
        resultUri: videoUrl,
        buffer: buf,
        mimeType: res.headers.get('content-type') || 'video/mp4',
        providerMetadata: {
          falRequestId: data.request_id,
          maxWaitMs,
        },
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
