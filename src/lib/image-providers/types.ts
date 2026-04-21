export type ImageProviderId = 'imagen4' | 'flux';

export type AspectRatio = '1:1' | '16:9' | '9:16';

export interface GenerateParams {
  prompt: string;
  aspectRatio: AspectRatio;
  seed?: number;
  negativePrompt?: string;
}

export interface GenerateResult {
  base64: string; // data:image/... URL 形式
  providerId: ImageProviderId;
  providerMetadata: Record<string, unknown>;
}

export class ImageProviderError extends Error {
  constructor(
    public readonly providerId: ImageProviderId,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${providerId}] ${message}`);
    this.name = 'ImageProviderError';
  }
}

export interface ImageProvider {
  readonly id: ImageProviderId;
  readonly displayName: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
}
