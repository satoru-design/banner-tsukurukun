import { veo31FastProvider } from './veo-3-1-fast';
import { veo31LiteProvider } from './veo-3-1-lite';
import {
  kling21StandardProvider,
  kling21ProProvider,
  kling21MasterProvider,
} from './kling-2-1';
import {
  VideoProvider,
  VideoProviderId,
  VideoProviderError,
} from './types';

export * from './types';

const REGISTRY: Record<VideoProviderId, VideoProvider> = {
  'veo-3.1-fast': veo31FastProvider,
  'veo-3.1-lite': veo31LiteProvider,
  'kling-2.1-standard': kling21StandardProvider,
  'kling-2.1-pro': kling21ProProvider,
  'kling-2.1-master': kling21MasterProvider,
};

export function getVideoProvider(id: VideoProviderId): VideoProvider {
  const p = REGISTRY[id];
  if (!p) {
    throw new VideoProviderError(id, `Unknown video provider id: ${id}`);
  }
  return p;
}

export function listVideoProviders(): VideoProvider[] {
  return Object.values(REGISTRY);
}

/**
 * UI 表示用: プラン別に使えるプロバイダ一覧を返す。
 * Phase 2 実装時にプラン体系と整合をとる。
 */
export function getAvailableProvidersForPlan(plan: string): VideoProvider[] {
  switch (plan) {
    case 'free':
      // free は透かし入りプレビューのみ。UI 側で disabled。
      return [veo31FastProvider];
    case 'starter':
      return [veo31FastProvider, veo31LiteProvider];
    case 'pro':
    case 'business':
      return [
        veo31FastProvider,
        veo31LiteProvider,
        kling21StandardProvider,
        kling21ProProvider,
      ];
    case 'studio':
    case 'admin':
      return Object.values(REGISTRY);
    default:
      return [veo31FastProvider];
  }
}
