/**
 * Phase B.1 動画生成プロバイダ抽象化レイヤ
 *
 * 設計指針:
 *  - 動画生成は非同期 (1〜5分かかる) のため、同期 generate() は提供しない
 *  - start → poll → download の3段階で扱う
 *  - 各 provider は同じインタフェースで Vertex AI / fal.ai / Runway 等を実装
 */

export type VideoProviderId =
  | 'veo-3.1-fast'
  | 'veo-3.1-lite'
  | 'kling-2.1-standard'
  | 'kling-2.1-pro'
  | 'kling-2.1-master';

export type VideoAspectRatio = '9:16' | '16:9' | '1:1';

/**
 * Veo 3.1 Fast/Lite が許す尺は 4/6/8 秒のみ。
 * Kling 2.1 は 5/10 秒のみ。
 * provider 側でバリデートする。
 */
export type VideoDurationSeconds = 4 | 5 | 6 | 8 | 10;

export interface VideoStartParams {
  prompt: string; // 英訳済み
  inputImageUrl?: string; // I2V の場合のみ。 https URL or data URL
  aspectRatio: VideoAspectRatio;
  durationSeconds: VideoDurationSeconds;
  generateAudio?: boolean; // Veo Lite のみ意味あり
  /// 一意な追跡 ID (DB の GenerationVideo.id を渡す)
  trackingId: string;
}

export interface VideoStartResult {
  /// プロバイダ固有のオペレーション ID (Vertex なら projects/.../operations/...、fal なら request_id)
  operationId: string;
  providerMetadata?: Record<string, unknown>;
}

export type VideoStatusState = 'pending' | 'processing' | 'done' | 'failed';

export interface VideoStatus {
  state: VideoStatusState;
  /// 完了時のみ。プロバイダ側のダウンロード可能 URL (GCS gs:// or HTTPS)
  resultUri?: string;
  errorMessage?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface VideoDownloadResult {
  buffer: Buffer;
  mimeType: string;
}

export class VideoProviderError extends Error {
  constructor(
    public readonly providerId: VideoProviderId,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${providerId}] ${message}`);
    this.name = 'VideoProviderError';
  }
}

export interface VideoRunResult {
  resultUri: string;
  buffer: Buffer;
  mimeType: string;
  providerMetadata: Record<string, unknown>;
}

export interface VideoProvider {
  readonly id: VideoProviderId;
  readonly displayName: string;
  /// 音声+リップシンク同時生成が可能か
  readonly supportsAudio: boolean;
  /// 許容される尺 (秒)
  readonly allowedDurations: ReadonlyArray<number>;

  /**
   * 単一プロセス内で start → poll → download まで完了する one-shot 実行。
   * SDK の getVideosOperation が元の Operation インスタンスを要求するため、
   * cross-call 分割は不可。Vercel maxDuration=300s 内に収まる前提。
   */
  run(params: VideoStartParams, options?: { maxWaitMs?: number }): Promise<VideoRunResult>;

  /// USD 単位の見積もり原価
  estimateCost(durationSeconds: number, options: { audio: boolean }): number;
}
