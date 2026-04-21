import { imagen4Provider } from './imagen4';
import { fluxProvider } from './flux';
import {
  ImageProvider,
  ImageProviderId,
  GenerateParams,
  GenerateResult,
  ImageProviderError,
} from './types';

export * from './types';

const REGISTRY: Record<ImageProviderId, ImageProvider> = {
  imagen4: imagen4Provider,
  flux: fluxProvider,
};

export function getProvider(id: ImageProviderId): ImageProvider {
  const p = REGISTRY[id];
  if (!p) {
    throw new ImageProviderError(id, `Unknown provider id: ${id}`);
  }
  return p;
}

export function listProviders(): ImageProvider[] {
  return Object.values(REGISTRY);
}

/**
 * 一時的な障害だけフォールバック対象にする。
 * 認証エラー・セーフティ違反・バリデーションエラー等の**恒久エラー**で両プロバイダに無駄課金するのを防ぐ。
 */
function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|abort|5\d\d|rate.?limit|ECONN|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(
    msg,
  );
}

export async function generateWithFallback(
  preferred: ImageProviderId,
  params: GenerateParams,
): Promise<GenerateResult> {
  const order: ImageProviderId[] =
    preferred === 'imagen4' ? ['imagen4', 'flux'] : ['flux', 'imagen4'];

  let lastError: unknown = null;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    try {
      const result = await getProvider(id).generate(params);
      if (i > 0) {
        result.providerMetadata = {
          ...result.providerMetadata,
          fallback: true,
          preferredProvider: preferred,
        };
      }
      return result;
    } catch (err) {
      lastError = err;
      // 恒久エラーなら即 throw し、もう一方への無駄な API コールを防ぐ
      if (!isTransientError(err)) {
        throw err;
      }
    }
  }
  throw (
    lastError ??
    new ImageProviderError(
      preferred,
      'All providers failed and no error captured',
    )
  );
}
