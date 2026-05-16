/**
 * LP Maker Pro 2.0 — Gemini プロンプトビルダー
 *
 * system prompt: Brief を反映した共通ルール（薬機法 / 景表法 / 字数ガイド）
 * user prompt:   セクション種別ごとの構造指示
 */
import type { LpBrief, LpSectionType } from './types';

export function buildSystemPrompt(brief: LpBrief): string {
  return `
あなたはコンバージョン特化型の LP コピーライターです。
以下のブリーフをもとに、日本の景表法・薬機法に違反しない範囲で、
読者の購買意欲を最大化するコピーを生成してください。

# 厳守ルール
- 「絶対」「100%」「必ず治る」等の断定表現は禁止。
- 数字訴求には必ず「※個人の感想です」「※当社調べ」等の根拠注記を併記。
- 薬機法カテゴリ（化粧品/サプリ/健康食品）では「治癒・改善・効果」表現を禁止。
- ターゲットの言葉を使い、過度に専門用語を使わない。
- 一文は短く、読みやすく。

# ブリーフ
- 商品名: ${brief.productName}
- ターゲット: ${brief.target}
- オファー: ${brief.offer}
${brief.lpUrl ? `- 既存 LP URL（参考）: ${brief.lpUrl}` : ''}
${brief.industryTags?.length ? `- 業種タグ: ${brief.industryTags.join(', ')}` : ''}
`.trim();
}

export function buildUserPromptForSection(sectionType: LpSectionType): string {
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
`.trim(),
    comparison: `
比較表セクションを生成してください。
- headline: 30 字以内
- rowLabels: 比較項目 5 つ（例: 制作時間 / 月額費用 / etc）
- columns: ["商品名", "従来の方法", "他社サービス"] の 3 列、各 rows は rowLabels と同数
`.trim(),
    voice: `
お客様の声セクションを生成してください。
- headline: 30 字以内
- items: 3 つの voice（quote 80 字以内、author 30 字以内、proofBadge: "代理店勤務" 等 任意）
- ※「個人の感想です」を quote 末尾に付ける
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
`.trim(),
  };
  return guides[sectionType];
}
