import { getPrisma } from '@/lib/prisma';
import { ownedWhere } from '@/lib/auth/ownership';
import type { StyleProfile } from './schema';

/**
 * styleProfileId からプロファイルを読む。
 *
 * viewerUserId でテナントを絞る。これが無いと、body に他人の
 * styleProfileId を入れるだけで相手の語彙・タブー・ターゲット層に加えて
 * referenceImageUrls まで自分の生成に流用できてしまう
 * (generate-image は参照画像をそのまま画像プロバイダに渡す)。
 *
 * 参照できるのは自分の行のみ (admin は移行前の遺構 userId=NULL も可)。
 * 他人の行は、存在しない場合と同じく null を返す
 * (403 と 404 を区別しないことで id の存在自体も漏らさない)。
 */
export async function loadStyleProfile(
  id: string | null | undefined,
  viewerUserId: string,
  viewerIsAdmin = false,
): Promise<StyleProfile | null> {
  if (!id) return null;
  const prisma = getPrisma();
  const p = await prisma.styleProfile.findFirst({
    where: { id, ...ownedWhere(viewerUserId, viewerIsAdmin) },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    productContext: p.productContext ?? undefined,
    referenceImageUrls: JSON.parse(p.referenceImageUrls),
    visualStyle: JSON.parse(p.visualStyle),
    typography: JSON.parse(p.typography),
    priceBadge: JSON.parse(p.priceBadge),
    cta: JSON.parse(p.cta),
    layout: JSON.parse(p.layout),
    copyTone: JSON.parse(p.copyTone),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function injectIntoCopyPrompt(
  basePrompt: string,
  profile: StyleProfile | null,
): string {
  if (!profile) return basePrompt;

  const styleHints = [
    `【この商材のスタイル指示】`,
    `- 商材メモ: ${profile.productContext ?? profile.name}`,
    `- 使うべき語彙: ${profile.copyTone.vocabulary.join(', ') || '(指定なし)'}`,
    `- 避けるべき表現: ${profile.copyTone.taboos.join(', ') || '(指定なし)'}`,
    `- ターゲット層: ${profile.copyTone.targetDemographic}`,
    `- 格式レベル: ${profile.copyTone.formalityLevel}`,
    `- 推奨 emphasisRatio: ${profile.typography.mainCopyStyle.emphasisRatio}（全アングル共通のベース、numeric/sensory/fear はそれに +1 段階）`,
    `- 推奨 priceBadge shape: ${profile.priceBadge.primary.shape}`,
    `- priceBadge text パターン: ${profile.priceBadge.primary.textPattern}`,
    ...(profile.priceBadge.secondary
      ? [
          `- 二次バッジ shape: ${profile.priceBadge.secondary.shape}（権威訴求に使用）`,
          `- 二次バッジ text パターン: ${profile.priceBadge.secondary.textPattern}`,
        ]
      : []),
    `- 推奨 CTA templateId: ${profile.cta.templateId}`,
    `- 推奨 CTA text パターン: ${profile.cta.textPattern}`,
    ``,
    `上記を踏まえて、8 アングルを生成してください。`,
    `参考銘柄のトーンに合わせ、vocabulary を可能な限り織り込み、taboos を避けてください。`,
  ].join('\n');

  return `${basePrompt}\n\n${styleHints}`;
}

export function injectIntoImagePrompt(
  basePrompt: string,
  profile: StyleProfile | null,
): string {
  if (!profile) return basePrompt;

  const hints = [
    profile.visualStyle.imagePromptKeywords,
    `lighting: ${profile.visualStyle.lighting}`,
    `mood: ${profile.visualStyle.mood}`,
    `composition: ${profile.visualStyle.composition}`,
    `person zone: ${profile.layout.personZone}, product zone: ${profile.layout.productZone}, main copy zone: ${profile.layout.mainCopyZone}`,
  ]
    .filter(Boolean)
    .join(', ');

  const negativeCues = 'NEGATIVE: do not render any hex color codes, color labels, text strings from this prompt, or prompt metadata anywhere in the image. No calendar emojis or date artifacts.';

  return `${basePrompt}\n\n[Style profile hints] ${hints}\n\n${negativeCues}`;
}
