/**
 * Phase A.11.5: briefSnapshot の構築。
 *
 * Generation.briefSnapshot に保存する内容:
 * - IroncladBrief（pattern, product, target, purpose, sizes）
 * - 使用したコピー / デザイン要件 / CTA / トーン / 注意（最終的に生成に渡された値）
 * - 使用 asset の Blob URL 群（productImageUrl, badgeImageUrl1, badgeImageUrl2）
 * - useWinningRef フラグ（オプション、Step 1 から伝搬されない場合は false）
 */

import type { IroncladMaterials } from '@/lib/prompts/ironclad-banner';

export interface BriefSnapshot {
  /** Step 1 で入力 */
  pattern: string;
  product: string;
  target: string;
  purpose: string;
  sizes: string[];

  /** Step 2 で選択（最終生成時の値） */
  copies: [string, string, string, string];
  designRequirements: [string, string, string, string];
  cta: string;
  tone: string;
  caution: string;

  /** 素材 URL（再生成時の素材復元用、Asset row が削除されても画像 URL から復元可能）*/
  productImageUrl: string | null;
  badgeImageUrl1: string | null;
  badgeImageUrl2: string | null;
  useWinningRef: boolean;
}

/**
 * IroncladMaterials（API 入力）から briefSnapshot を構築。
 * 単一サイズ呼出時の sizes は 1 要素配列。
 */
export function buildBriefSnapshot(materials: IroncladMaterials): BriefSnapshot {
  return {
    pattern: materials.pattern,
    product: materials.product,
    target: materials.target,
    purpose: materials.purpose,
    sizes: [materials.size],
    copies: materials.copies,
    designRequirements: materials.designRequirements,
    cta: materials.cta,
    tone: materials.tone,
    caution: materials.caution,
    productImageUrl: materials.productImageUrl ?? null,
    badgeImageUrl1: materials.badgeImageUrl1 ?? null,
    badgeImageUrl2: materials.badgeImageUrl2 ?? null,
    useWinningRef: false, // ironclad-generate API には useWinningRef が渡らないので false 固定
  };
}

/**
 * 同セッション判定: 同じ pattern/product/target/purpose かつ過去 5 分以内なら同セッション扱い。
 * 戻り値: マージ可能な既存 Generation の briefSnapshot 比較用キー
 */
export function snapshotIdentityKey(s: BriefSnapshot): string {
  return [s.pattern, s.product, s.target, s.purpose].join('|');
}
