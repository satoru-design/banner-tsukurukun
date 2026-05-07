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
  VideoRunResult,
  VideoProviderError,
} from './types';

let credentialsPathCache: string | null = null;

/**
 * Vertex AI 認証ファイルを準備。
 * 優先順位:
 *   1. GOOGLE_APPLICATION_CREDENTIALS_BASE64 が set → decode して /tmp に書き出し
 *      (Vercel 等の serverless 環境向け。base64 を trim してから decode)
 *   2. GOOGLE_APPLICATION_CREDENTIALS の path が存在 → そのまま使用
 *      (ローカル開発向け)
 *   3. どちらも無効 → throw
 *
 * 注意: Vercel では GOOGLE_APPLICATION_CREDENTIALS に Windows ローカルの path 文字列が
 *       残っていると existsSync が false → fallthrough して BASE64 を見る、という
 *       前提で順序設計している。
 */
function ensureCredentials(): void {
  if (credentialsPathCache) return;

  // 優先1: BASE64 from env (serverless 環境)
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (b64 && b64.trim()) {
    try {
      const json = Buffer.from(b64.trim(), 'base64').toString('utf8');
      // 簡易バリデーション (service_account JSON か?)
      const parsed = JSON.parse(json);
      if (parsed.type !== 'service_account') {
        throw new Error(`decoded credentials json is not a service_account (type=${parsed.type})`);
      }
      const path = join(tmpdir(), 'vertex-veo-key.json');
      writeFileSync(path, json);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
      credentialsPathCache = path;
      return;
    } catch (e) {
      throw new VideoProviderError(
        'veo-3.1-fast',
        `Failed to decode GOOGLE_APPLICATION_CREDENTIALS_BASE64: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  // 優先2: 既存の credentials file path (ローカル開発)
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  ) {
    credentialsPathCache = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return;
  }

  throw new VideoProviderError(
    'veo-3.1-fast',
    'GOOGLE_APPLICATION_CREDENTIALS_BASE64 (preferred) または GOOGLE_APPLICATION_CREDENTIALS の path が必要',
  );
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

/**
 * Veo 3.1 generation を 1 関数呼び出し内で start → poll → download まで完結。
 *
 * SDK の getVideosOperation は元の Operation インスタンスの _fromAPIResponse
 * メソッドが必要なため、operation を関数スコープ内で生かしたまま poll する。
 * cron 跨ぎで { name: ... } を再構築すると "_fromAPIResponse is not a function" になる。
 */
export async function runVeoGeneration(
  modelConfig: VeoModelConfig,
  providerId: VideoProviderId,
  params: VideoStartParams,
  options: { maxWaitMs?: number } = {},
): Promise<VideoRunResult> {
  const maxWaitMs = options.maxWaitMs ?? 270_000; // Vercel 300s 内
  const client = getVertexClient();
  const { uriPrefix } = getGcsBucket();
  const outputGcsUri = `${uriPrefix}/jobs/${params.trackingId}/`;

  // 入力画像があれば fetch して base64 化
  let image: { imageBytes: string; mimeType: string } | undefined;
  if (params.inputImageUrl) {
    const res = await fetch(params.inputImageUrl);
    if (!res.ok) {
      throw new VideoProviderError(
        providerId,
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
  // Phase B.3: 字幕/テキスト/ロゴ抑制。Vertex AI Veo は config.negativePrompt をサポート
  if (params.negativePrompt && params.negativePrompt.trim().length > 0) {
    config.negativePrompt = params.negativePrompt.trim();
  }

  const requestBody: Record<string, unknown> = {
    model: modelConfig.modelId,
    prompt: params.prompt,
    config,
  };
  if (image) requestBody.image = image;

  // start
  let operation = await client.models.generateVideos(
    requestBody as unknown as Parameters<typeof client.models.generateVideos>[0],
  );

  // poll
  const startedAt = Date.now();
  while (!(operation as { done?: boolean }).done) {
    if (Date.now() - startedAt > maxWaitMs) {
      throw new VideoProviderError(
        providerId,
        `Polling timeout after ${Math.round((Date.now() - startedAt) / 1000)}s`,
      );
    }
    await new Promise((r) => setTimeout(r, 15_000));
    operation = await client.operations.getVideosOperation({ operation });
  }

  const opData = operation as unknown as {
    error?: { code?: number; message?: string };
    response?: { generatedVideos?: Array<{ video?: { uri?: string } }> };
    result?: { generatedVideos?: Array<{ video?: { uri?: string } }> };
  };

  if (opData.error) {
    throw new VideoProviderError(
      providerId,
      `Veo API error: code=${opData.error.code} message=${opData.error.message}`,
    );
  }

  const generated =
    opData.response?.generatedVideos || opData.result?.generatedVideos || [];
  const resultUri = generated[0]?.video?.uri;
  if (!resultUri) {
    throw new VideoProviderError(
      providerId,
      `Operation done but no generatedVideos returned: ${JSON.stringify(opData).slice(0, 300)}`,
    );
  }

  // download from GCS
  ensureCredentials();
  const m = resultUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
  if (!m) {
    throw new VideoProviderError(providerId, `Invalid GCS URI: ${resultUri}`);
  }
  const [, bucketName, objectPath] = m;
  const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
  const [contents] = await storage.bucket(bucketName).file(objectPath).download();

  return {
    resultUri,
    buffer: contents,
    mimeType: 'video/mp4',
    providerMetadata: {
      modelId: modelConfig.modelId,
      outputGcsUri,
      operationName: (operation as { name?: string }).name,
      pollDurationSec: Math.round((Date.now() - startedAt) / 1000),
    },
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

    async run(params, options) {
      if (!allowedDurations.includes(params.durationSeconds)) {
        throw new VideoProviderError(
          id,
          `durationSeconds=${params.durationSeconds} not allowed. Use ${allowedDurations.join('/')}`,
        );
      }
      return runVeoGeneration(modelConfig, id, params, options);
    },

    estimateCost(durationSeconds: number) {
      return durationSeconds * modelConfig.pricePerSecond;
    },
  };
}
