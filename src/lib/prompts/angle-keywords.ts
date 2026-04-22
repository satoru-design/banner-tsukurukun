import type { AngleId } from '@/lib/banner-state';
import type { ImageProviderId } from '@/lib/image-providers/types';

export const ANGLE_KEYWORDS: Record<AngleId, string> = {
  benefit:   'bright uplifting mood, warm sunlight, confident smile, aspirational lifestyle',
  fear:      'moody dramatic lighting, concerned expression, contrast between before and after, muted tones',
  authority: 'professional trustworthy, business attire, clean white background, authoritative composition',
  empathy:   'intimate relatable, natural home setting, soft window light, candid unposed moment',
  numeric:   'product hero shot with prominent price tag area, bold composition, high contrast for text overlay',
  target:    'demographic-specific setting, direct eye contact with camera',
  scene:     'specific use-case environment (bathroom/office/kitchen), in-the-moment action shot',
  sensory:   'tactile texture emphasis, slow-motion splash or flow, macro details, vibrant saturation',
};

export const PROVIDER_PREFIX: Record<ImageProviderId, string> = {
  imagen4: 'photorealistic, magazine cover quality, soft rim light',
  flux: 'cinematic color grading, product hero shot, editorial advertising style',
  'gpt-image': 'polished Japanese advertising banner, studio-grade composition, crisp Japanese typography rendered natively in the image',
};

export const AD_COMMON_PREFIX =
  'high-quality Japanese direct-response ad banner aesthetic, commercial photography, crisp focus, dramatic studio lighting';
