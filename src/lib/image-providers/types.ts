export type ImageProviderId = 'imagen4' | 'flux' | 'gpt-image';

export type AspectRatio = '1:1' | '16:9' | '9:16';

export interface GenerateParams {
  prompt: string;
  aspectRatio: AspectRatio;
  seed?: number;
  negativePrompt?: string;
  // Phase A.7: StyleProfile の参考画像 URL 配列。指定時は各プロバイダの reference-capable エンドポイントを使用。
  referenceImageUrls?: string[];
  // Phase A.7 Ironclad: 参考画像の扱い方
  //  - 'style' (default): 参考バナー全体を "世界観テンプレ" として模倣（StyleProfile 用途）
  //  - 'composite': 提供された商品画像・バッジ画像を "そのままの素材" として配置し改変禁止（Ironclad 用途）
  referenceMode?: 'style' | 'composite';
  // Phase A.7: バナーに焼き込むべき日本語テキスト束。指定時は画像に完成バナーとしてテキストを描画。
  copyBundle?: {
    mainCopy?: string;
    subCopy?: string;
    ctaText?: string;
    primaryBadgeText?: string;
    secondaryBadgeText?: string;
  };
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
