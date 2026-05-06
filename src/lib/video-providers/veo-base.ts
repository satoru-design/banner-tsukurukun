/**
 * Veo 3.1 Fast / Lite 共通実装ベース。
 *
 * Vertex AI 認証:
 *  - ローカル: GOOGLE_APPLICATION_CREDENTIALS (JSON ファイルパス)
 *  - Vercel: GOOGLE_APPLICATION_CREDENTIALS_BASE64 (JSON を base64 化して env に格納)
 *           → 起動時に decode して /tmp に書き出し GOOGLE_APPLICATION_CREDENTIALS にセット
 */

import { GoogleGenAI } from '@google/genai';
import { Storage } from '@google-cloud/storage';
import { writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  VideoProvider,
  VideoProviderId,
  VideoStartParams,
  VideoStartResult,
  VideoStatus,
  VideoDownloadResult,
  VideoProviderError,
} from './types';

let credentialsPathCache: string | null = null;

/**
 * GOOGLE_APPLICATION_CREDENTIALS_BASE64 を decode して /tmp に書き出し、
 * GOOGLE_APPLICATION_CREDENTIALS にパスをセットする。Vercel 等のサーバーレス環境向け。
 */
function ensureCredentials(): void {
  if (credentialsPathCache) return;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      credentialsPathCache = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      return;
    }
  }

  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (!b64) {
    throw new VideoProviderError(
      'veo-3.1-fast',
      'GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_BASE64 not set',
    );
  }
  const json = Buffer.from(b64, 'base64').toString('utf8');
  const path = join(tmpdir(), 'vertex-veo-key.json');
  writeFileSync(path, json);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  credentialsPathCache = path;
}

export function getVertexClient(): GoogleGenAI {
  ensureCredentials();
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
  });
}

export function getGcsBucket(): { bucket: string; uriPrefix: string } {
  const raw = process.env.OUTPUT_GCS_BUCKET;
  if (!raw || !raw.startsWith('gs://')) {
    throw new VideoProviderError(
      'veo-3.1-fast',
      'OUTPUT_GCS_BUCKET not set or invalid (must start with gs://)',
    );
  }
  return {
    bucket: raw.replace(/^gs:\/\//, '').replace(/\/$/, ''),
    uriPrefix: raw.replace(/\/$/, ''),
  };
}

/**
 * Veo 3.1 Fast/Lite 共通の start 実装。
 * モデル ID と料金単価のみ subclass で差し替える。
 */
export interface VeoModelConfig {
  modelId: string; // 'veo-3.1-fast-generate-001' | 'veo-3.1-lite-generate-001'
  supportsAudio: boolean;
  pricePerSecond: number; // USD/秒
}

export async function startVeoGeneration(
  modelConfig: VeoModelConfig,
  params: VideoStartParams,
): Promise<VideoStartResult> {
  const client = getVertexClient();
  const { uriPrefix } = getGcsBucket();
  const outputGcsUri = `${uriPrefix}/jobs/${params.trackingId}/`;

  // 入力画像があれば fetch して base64 化 (HTTPS URL のみ対応)
  let image: { imageBytes: string; mimeType: string } | undefined;
  if (params.inputImageUrl) {
    const res = await fetch(params.inputImageUrl);
    if (!res.ok) {
      throw new VideoProviderError(
        modelConfig.modelId.includes('lite') ? 'veo-3.1-lite' : 'veo-3.1-fast',
        `Failed to fetch input image: ${params.inputImageUrl} (status ${res.status})`,
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    image = {
      imageBytes: buf.toString('base64'),
      mimeType: res.headers.get('content-type') || 'image/png',
    };
  }

  const config: Record<string, unknown> = {
    aspectRatio: params.aspectRatio,
    durationSeconds: params.durationSeconds,
    outputGcsUri,
  };
  if (modelConfig.supportsAudio && params.generateAudio) {
    config.generateAudio = true;
  }

  const requestBody: Record<string, unknown> = {
    model: modelConfig.modelId,
    prompt: params.prompt,
    config,
  };
  if (image) requestBody.image = image;

  const op = await client.models.generateVideos(requestBody as unknown as Parameters<typeof client.models.generateVideos>[0]);

  // operation.name は projects/.../operations/... 形式
  const operationId = (op as { name?: string }).name
    || JSON.stringify(op).slice(0, 200);

  return {
    operationId,
    providerMetadata: {
      modelId: modelConfig.modelId,
      outputGcsUri,
      startedAt: new Date().toISOString(),
    },
  };
}

export async function pollVeoStatus(
  providerId: VideoProviderId,
  operationId: string,
): Promise<VideoStatus> {
  const client = getVertexClient();
  // SDK の operations.get は { name } を受け取る形式
  const op = await client.operations.get({ operation: { name: operationId } as never });
  const opData = op as {
    done?: boolean;
    error?: { code?: number; message?: string };
    response?: { generatedVideos?: Array<{ video?: { uri?: string } }> };
    result?: { generatedVideos?: Array<{ video?: { uri?: string } }> };
  };

  if (!opData.done) return { state: 'processing' };

  if (opData.error) {
    return {
      state: 'failed',
      errorMessage: `code=${opData.error.code}: ${opData.error.message}`,
      providerMetadata: { error: opData.error },
    };
  }

  const generated = opData.response?.generatedVideos
    || opData.result?.generatedVideos
    || [];
  const first = generated[0]?.video?.uri;
  if (!first) {
    return {
      state: 'failed',
      errorMessage: 'Operation done but no generatedVideos returned',
      providerMetadata: { rawOperation: opData },
    };
  }
  return {
    state: 'done',
    resultUri: first,
  };
}

export async function downloadVeoResult(resultUri: string): Promise<VideoDownloadResult> {
  ensureCredentials();
  // gs://bucket/path → bucket + path
  const m = resultUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
  if (!m) {
    throw new VideoProviderError(
      'veo-3.1-fast',
      `Invalid GCS URI: ${resultUri}`,
    );
  }
  const [, bucketName, objectPath] = m;
  const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
  const [contents] = await storage.bucket(bucketName).file(objectPath).download();
  return {
    buffer: contents,
    mimeType: 'video/mp4',
  };
}

export function makeVeoProvider(
  id: VideoProviderId,
  displayName: string,
  modelConfig: VeoModelConfig,
  allowedDurations: ReadonlyArray<number>,
): VideoProvider {
  return {
    id,
    displayName,
    supportsAudio: modelConfig.supportsAudio,
    allowedDurations,

    async start(params: VideoStartParams) {
      if (!allowedDurations.includes(params.durationSeconds)) {
        throw new VideoProviderError(
          id,
          `durationSeconds=${params.durationSeconds} not allowed. Use ${allowedDurations.join('/')}`,
        );
      }
      return startVeoGeneration(modelConfig, params);
    },

    async pollStatus(operationId: string) {
      return pollVeoStatus(id, operationId);
    },

    async download(resultUri: string) {
      return downloadVeoResult(resultUri);
    },

    estimateCost(durationSeconds: number, options: { audio: boolean }) {
      // Lite で音声時のみ単価変わる場合は subclass で override
      return durationSeconds * modelConfig.pricePerSecond;
    },
  };
}
