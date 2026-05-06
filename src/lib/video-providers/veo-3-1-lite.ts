import { makeVeoProvider } from './veo-base';

/**
 * Veo 3.1 Lite (preview) - 音声+リップシンク対応。
 * 公式ドキュメント上 "Sound generation (preview)" 記載。
 * 価格: $0.10/秒 (Phase 1 検証時 2026-05 時点)
 */
export const veo31LiteProvider = makeVeoProvider(
  'veo-3.1-lite',
  'Veo 3.1 Lite (音声+リップシンク, preview)',
  {
    modelId: 'veo-3.1-lite-generate-001',
    supportsAudio: true,
    pricePerSecond: 0.10,
  },
  [4, 6, 8],
);
