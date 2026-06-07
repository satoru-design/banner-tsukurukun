import type { TagDim, TagDimension } from './types';

/** briefSnapshot から読む文字列次元（そのまま値として採用） */
const STRING_DIMS: TagDimension[] = ['angleId', 'ctaTemplateId', 'urgency', 'emphasisRatio'];

interface ImageMeta {
  size?: string | null;
  provider?: string | null;
}

/**
 * briefSnapshot（任意 JSON）と画像メタから タグ次元 v1 を抽出する。
 * - 文字列次元は値が非空ならそのまま採用
 * - priceBadge は有無を 'present' / 'absent' に正規化
 * - size / provider は画像メタから採用
 * 欠損（null/undefined/空文字）はスキップ。
 */
export function extractTags(brief: unknown, image: ImageMeta): TagDim[] {
  const b = (brief && typeof brief === 'object' ? brief : {}) as Record<string, unknown>;
  const out: TagDim[] = [];

  for (const dim of STRING_DIMS) {
    const v = b[dim];
    if (typeof v === 'string' && v.trim().length > 0) {
      out.push({ dimension: dim, value: v.trim() });
    }
  }

  // priceBadge: 値が存在すれば present、null/未指定/空文字なら absent
  const pb = b.priceBadge;
  const hasBadge =
    pb !== null &&
    pb !== undefined &&
    !(typeof pb === 'string' && pb.trim().length === 0);
  out.push({ dimension: 'priceBadge', value: hasBadge ? 'present' : 'absent' });

  if (typeof image.size === 'string' && image.size.length > 0) {
    out.push({ dimension: 'size', value: image.size });
  }
  if (typeof image.provider === 'string' && image.provider.length > 0) {
    out.push({ dimension: 'provider', value: image.provider });
  }

  return out;
}
