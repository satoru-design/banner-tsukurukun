/**
 * LP Maker Pro 2.0 — Gemini プロンプトビルダー
 *
 * system prompt: Brief を反映した共通ルール（薬機法 / 景表法 / 字数ガイド）
 * user prompt:   セクション種別ごとの構造指示
 */
import type { LpBrief, LpSectionType } from './types';
import { LP_INDUSTRY_LABELS, LP_CTA_LABELS, LP_TONE_LABELS } from './types';

export function buildSystemPrompt(brief: LpBrief): string {
  const industryLabel = brief.industryCategory
    ? LP_INDUSTRY_LABELS[brief.industryCategory]
    : '未指定';
  const ctaLabel = brief.ctaType ? LP_CTA_LABELS[brief.ctaType] : '購入する';
  const toneLabel = brief.tone ? LP_TONE_LABELS[brief.tone] : '信頼感';

  return `
あなたはコンバージョン特化型の LP コピーライターです。
以下のブリーフをもとに、日本の景表法・薬機法に違反しない範囲で、
読者の購買意欲を最大化するコピーを生成してください。

# 厳守ルール
- 「絶対」「100%」「必ず治る」等の断定表現は禁止。
- 数字訴求には必ず「※個人の感想です」「※当社調べ」等の根拠注記を併記。
- 業種「${industryLabel}」が薬機法カテゴリ（化粧品/サプリ/食品/健康/医療）の場合、「治癒・改善・効果」表現を厳禁。
- ターゲットの言葉を使い、過度に専門用語を使わない。
- 一文は短く、読みやすく。
- ブランドトーンは「${toneLabel}」を全体に貫く。
- CTA ボタン文言は「${ctaLabel}」を基準に文脈に応じて調整（短い動詞句）。

# ブリーフ
- 商品名: ${brief.productName}
- 業種: ${industryLabel}
${brief.usp ? `- 強み・USP: ${brief.usp}` : ''}
- ターゲット: ${brief.target}
${brief.customerPain ? `- 顧客の悩み・購入障壁: ${brief.customerPain}` : ''}
${brief.price ? `- 価格・料金: ${brief.price}` : ''}
- オファー: ${brief.offer}
${brief.riskReversal ? `- リスクリバーサル（保証）: ${brief.riskReversal}` : ''}
${brief.referenceLpUrls ? `- 競合・参考 LP（URL）: ${brief.referenceLpUrls}` : ''}
${brief.proofMetrics ? `- 実績数値・社会的証明: ${brief.proofMetrics}` : ''}
${brief.authority ? `- 権威付け: ${brief.authority}` : ''}
${brief.features ? `- 機能・特徴（旧フィールド）: ${brief.features}` : ''}
${brief.lpUrl ? `- 既存 LP URL（参考）: ${brief.lpUrl}` : ''}
${brief.industryTags?.length ? `- 業種タグ: ${brief.industryTags.join(', ')}` : ''}
`.trim();
}

export function buildUserPromptForSection(
  sectionType: LpSectionType,
  brief: LpBrief
): string {
  const productNameOrPlaceholder = brief.productName || '本商品';
  const guides: Record<LpSectionType, string> = {
    hero: `
ファーストビュー（FV）のコピーを生成してください。
- headline: 30 字以内、最大訴求ベネフィット
- subheadline: 50 字以内、補強コピー
- ctaText: 12 字以内、行動喚起ボタン文言
`.trim(),
    problem: `
ターゲットが抱える課題提起セクションを生成してください。
- headline: 30 字以内
- items: 3 つの課題（title 15 字 / description 60 字）
`.trim(),
    solution: `
解決策セクションを生成してください。
- headline: 30 字以内
- description: 120 字以内
`.trim(),
    features: `
機能紹介セクションを生成してください。
- headline: 30 字以内
- items: 4 つの機能（title 15 字 / description 80 字 / iconHint: lucide-react のアイコン名候補 1 つ）
`.trim(),
    numeric_proof: `
数字訴求セクションを生成してください。
- items: 3 つの数字（number: "97%" 等、label: 30 字以内、note: ※注記 任意）
- ブリーフの「実績数値・社会的証明」項目に数値があれば、その範囲内のみ使用。AI による数値捏造は厳禁。
- ブリーフに実績がない場合、抽象的な数字（"3秒で実感" 等）か業界一般値（"※当社調べ" 注記必須）のみ。
`.trim(),
    comparison: `
比較表セクションを生成してください。
- headline: 30 字以内
- rowLabels: 比較項目 5 つ（例: 制作時間 / 月額費用 / etc）
- columns: ["${productNameOrPlaceholder}", "従来の方法", "他社サービス"] の 3 列、各 rows は rowLabels と同数
- ブリーフの「競合・参考 LP URL」に競合がある場合、それを意識した差別化軸を選ぶ（ただし URL を実際に閲覧する機能はないので、業種・USP から推測）。
`.trim(),
    voice: `
お客様の声セクションを生成してください。
- headline: 30 字以内
- items: 3 つの voice（quote 80 字以内、author 30 字以内、proofBadge: "代理店勤務" 等 任意）
- ※「個人の感想です」を quote 末尾に付ける
- ブリーフの「実績数値・社会的証明」に具体的なお客様の声があれば、それを基に。なければ業界一般的な悩み解決ストーリーを抽象的に生成。
`.trim(),
    pricing: `
料金セクションを生成してください。
- headline: 30 字以内
- plans: 3 つのプラン（Free / Starter / Pro）。price は ¥表記。features は各 4 個。ctaText 12 字以内
`.trim(),
    faq: `
FAQ セクションを生成してください。
- headline: 30 字以内
- items: 6 つの Q&A（question 50 字、answer 150 字以内）
`.trim(),
    inline_cta: `
セクション間 CTA を生成してください。
- headline: 30 字以内
- buttonText: 12 字以内
- note: 任意（30 字以内）
`.trim(),
    final_cta: `
最終 CTA を生成してください。
- headline: 50 字以内、強い行動喚起
- buttonText: 12 字以内
- note: 任意（30 字以内、保証・特典等）
- ブリーフの「リスクリバーサル」項目があれば、note に保証文言を端的に含める（例:「14日間返金保証付き」）。
`.trim(),
  };
  return guides[sectionType];
}
