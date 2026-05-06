import { makeVeoProvider } from './veo-base';

export const veo31FastProvider = makeVeoProvider(
  'veo-3.1-fast',
  'Veo 3.1 Fast (高速、音声なし)',
  {
    modelId: 'veo-3.1-fast-generate-001',
    supportsAudio: false,
    pricePerSecond: 0.15,
  },
  [4, 6, 8],
);
