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
