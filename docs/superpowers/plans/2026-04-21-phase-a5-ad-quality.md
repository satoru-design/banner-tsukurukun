# Phase A.5: 広告品質改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存 Phase A の dual image provider 出力に対して、コピー 8 アングル・価格バッジ・CTA 5 種テンプレート・自動ジャンプ率・広告化画像プロンプトを追加し、banavo.net 上位事例と並ぶ広告品質（参考比 75〜80%）を実現する。

**Architecture:** 既存の `generate-copy` を 8 アングル出力に全面改訂し、JSON に `priceBadge` / `ctaTemplate` / `emphasis_ratio` / `urgency` を追加。新規に `PriceBadge.tsx` / `CtaButton.tsx` / `cta-templates.ts` / `angle-keywords.ts` を作成し、Step3Editor に統合。既存 Step2Angles を 4×2 グリッド化、Prisma に永続化カラムを追加。

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript / Prisma 7 / Neon Postgres / Gemini 2.5 Pro / Imagen 4 / FLUX 1.1 pro / Tailwind v4 / react-rnd / html2canvas

**Spec reference:** `docs/superpowers/specs/2026-04-21-phase-a5-ad-quality.md`
**Creative direction:** `docs/references/phase-a5-creative-direction.md`
**Research:** `docs/references/banner-kingsroad.md`

---

## File Structure

### New files

| パス | 責務 |
|---|---|
| `src/lib/prompts/angle-keywords.ts` | 8 アングル別の英語キーワード辞書 |
| `src/lib/cta-templates.ts` | CTA 5 種プリセット（class / suggestedText / arrow フラグ） |
| `src/components/canvas/PriceBadge.tsx` | 価格バッジ 5 形状のレンダリング |
| `src/components/canvas/CtaButton.tsx` | CTA 5 テンプレのレンダリング |
| `docs/baselines/2026-04-21-phase-a5/evaluation.md` | 手動受入テストの結果シート |

### Modified files

| パス | 変更内容 |
|---|---|
| `src/lib/banner-state.ts` | `AngleId` / `PriceBadge` / `PriceBadgeShape` / `PriceBadgePosition` / `CtaTemplateId` / `Urgency` 型追加。`computeDefaultBadgePosition()` / `validateAndFixMarkTag()` / `autoSelectCta()` 関数追加。`renderRichText()` に `emphasisRatio` 引数追加 |
| `src/app/api/analyze-lp/route.ts` | 出力 JSON に `pricing.initialOffer` / `pricing.discount` フィールド追加 |
| `src/app/api/generate-copy/route.ts` | system prompt を 8 アングル版に全面刷新、JSON スキーマ拡張（priceBadge/ctaTemplate/urgency/emphasis_ratio） |
| `src/app/api/save-banner/route.ts` | 新カラム（angleId/priceBadge/ctaTemplateId/ctaText/emphasisRatio/urgency）を受けて保存 |
| `src/components/steps/Step2Angles.tsx` | 4 カード → 4×2 グリッド（8 カード） |
| `src/components/steps/Step3Editor.tsx` | PriceBadge / CtaButton の配置、スタイルセレクタ追加 |
| `src/app/page.tsx` | 画像プロンプト構築に `ANGLE_KEYWORDS` / `PROVIDER_PREFIX` 合流、新 state 追加、handleSaveList に新フィールド |
| `prisma/schema.prisma` | Banner モデルに `angleId` / `priceBadge` / `ctaTemplateId` / `ctaText` / `emphasisRatio` / `urgency` を追加 |

---

## Task 0: ブランチ作成

- [ ] **Step 1: main がクリーンか確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git status
git branch --show-current
```
Expected: `main`, `nothing to commit`

- [ ] **Step 2: Phase A.5 用ブランチを切る**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git checkout -b feature/phase-a5-ad-quality
```
Expected: `Switched to a new branch 'feature/phase-a5-ad-quality'`

- [ ] **Step 3: 依存関係の確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`（Phase A 版が問題なくビルドされる）

---

## Task 1 (Day 1): generate-copy 8 アングル化 + JSON スキーマ拡張

**Files:**
- Modify: `src/lib/banner-state.ts`（型定義を追加）
- Modify: `src/app/api/generate-copy/route.ts`（system prompt 全面刷新）

- [ ] **Step 1: `banner-state.ts` に新型を追加**

`src/lib/banner-state.ts` の末尾（既存のエクスポート群の後）に追加：

```typescript
// ========== Phase A.5: Ad Quality Uplift ==========

export type AngleId =
  | 'benefit'
  | 'fear'
  | 'authority'
  | 'empathy'
  | 'numeric'
  | 'target'
  | 'scene'
  | 'sensory';

export type Urgency = 'low' | 'high';

export type EmphasisRatio = '2x' | '3x';

export type PriceBadgeShape =
  | 'circle-red'
  | 'circle-gold'
  | 'rect-red'
  | 'ribbon-orange'
  | 'capsule-navy';

export type PriceBadgePosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center-right'
  | 'floating-product';

export interface PriceBadge {
  text: string;
  shape: PriceBadgeShape;
  color: string;
  position: PriceBadgePosition;
  emphasisNumber?: string;
}

export type CtaTemplateId =
  | 'cta-green-arrow'
  | 'cta-orange-arrow'
  | 'cta-red-urgent'
  | 'cta-gold-premium'
  | 'cta-navy-trust';

export interface CtaTemplate {
  id: CtaTemplateId;
  text: string;
  arrow: boolean;
}

// アングル別のデフォルト emphasis_ratio
export const ANGLE_EMPHASIS_RATIO: Record<AngleId, EmphasisRatio> = {
  numeric: '3x',
  sensory: '3x',
  fear: '3x',
  benefit: '2x',
  authority: '2x',
  empathy: '2x',
  target: '2x',
  scene: '2x',
};
```

- [ ] **Step 2: `generate-copy/route.ts` の system prompt を全面書き換え**

`src/app/api/generate-copy/route.ts` の既存 `systemPrompt` 定数（L14-49 付近）を以下に完全置換：

```typescript
    const systemPrompt = `
あなたは日本のダイレクトレスポンス広告に 15 年従事したコピーライター兼クリエイティブディレクターです。
banavo.net 上位バナーと同等の CTR（目標 1%+）を叩き出すコピーを生成してください。

【8 アングル】それぞれで 1 本ずつ、計 8 本を生成してください。

抽象 4 層（課題発見の切り口）
1. benefit   : 得られる理想の未来を描写
2. fear      : 何もしないと失うものを提示
3. authority : No.1 / 実績 / 専門家の裏付け
4. empathy   : ターゲットの内心を代弁

具体 4 層（表現技法）
5. numeric   : 数字を main_copy または sub_copy に必ず含める（%・円・種類数・年数など）
6. target    : 「〇〇なあなたへ」「40 代男性必見」のような呼びかけで始める
7. scene     : 使用する時間・場所・状況を具体描写（例:「朝の 5 分で」「出張先で」）
8. sensory   : オノマトペ・触感・視覚効果で五感を刺激（例:「とろける」「さらさら」）

【各アングル共通の制約】
- main_copy: 20 文字以内、<mark></mark> で強調 1 単語のみ囲む（必須）
  強調対象の優先順位: ①数字 → ②核心ベネフィット → ③オノマトペ → ④動詞
- sub_copy: 35 文字以内、main を補強。\n で改行可
- emphasis_ratio: "2x" | "3x"（numeric / sensory / fear は 3x、それ以外は 2x）
- priceBadge: LP の価格情報から自動生成。情緒系 (sensory/empathy) は null 可
- ctaTemplate: 下記 5 種から商材 × 緊急度で選択
- urgency: "low" | "high"（LP に「期間限定」「本日限り」「残り〇〇」があれば high）

【CTA テンプレート 5 種】
- cta-green-arrow   : 健康食品・通販（緑、矢印 true）
- cta-orange-arrow  : EC 全般（オレンジ、矢印 true）
- cta-red-urgent    : 期間限定・セール（赤、矢印 true、緊急度高）
- cta-gold-premium  : プレミアム D2C（金、矢印 false）
- cta-navy-trust    : BtoB・金融・医療（ネイビー、矢印 false）

【価格バッジ形状 5 種】
- circle-red      : 赤丸（セール・定番）
- circle-gold     : 金丸（プレミアム・D2C）
- rect-red        : 赤角丸（緊急・限定）
- ribbon-orange   : リボン型（キャンペーン）
- capsule-navy    : カプセル型ネイビー（BtoB）

【価格バッジ位置】
- top-left / top-right / bottom-left / bottom-right / center-right / floating-product

【JSON 出力フォーマット】純粋な JSON 配列のみ、Markdown のバッククォートも含めないでください。
[
  {
    "strategy": {
      "angle_id": "benefit",
      "angle_label": "ベネフィット",
      "target_insight": "このバナーを見た人がどう感じるべきか"
    },
    "copy": {
      "main_copy": "<mark>強調語</mark>を含む 20 字以内",
      "sub_copy": "35 字以内、\\n 改行可",
      "emphasis_ratio": "2x"
    },
    "priceBadge": {
      "text": "初回限定 ¥980",
      "shape": "circle-red",
      "color": "#E63946",
      "position": "bottom-left",
      "emphasisNumber": "980"
    },
    "ctaTemplate": {
      "id": "cta-orange-arrow",
      "text": "今すぐ購入",
      "arrow": true
    },
    "urgency": "low",
    "design_specs": {
      "tone_and_manner": "清潔感のあるミニマル",
      "color_palette": { "main": "#1B1B1B", "accent": "#E63946" },
      "layout_id": "z-pattern",
      "image_gen_prompt": "英語プロンプト。アングル固有キーワードを含む。"
    }
  }
]

8 アングル全てで生成してください。情緒系 (sensory/empathy) で価格訴求が合わない場合は priceBadge を null にしてください。
`;
```

- [ ] **Step 3: モデル ID を確認（既に gemini-2.5-pro になっているはず）**

```bash
grep "model:" /c/Users/strkk/claude_pjt/banner-tsukurukun/src/app/api/generate-copy/route.ts
```
Expected: `model: 'gemini-2.5-pro',`（Phase A 完了直後の fix で 2.5 pro に切替済）

- [ ] **Step 4: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 5: curl で API 動作確認**

ローカル dev server を起動：
```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run dev
```

別ターミナルで：
```bash
curl -X POST http://localhost:3000/api/generate-copy \
  -H "Content-Type: application/json" \
  -u koike:banner2026 \
  -d '{"productName":"テストサプリ","target":"40代男性","lpText":"健康をサポート。初回限定 980円。"}' \
  | python -m json.tool | head -100
```
Expected: レスポンスに 8 個のアングル（`angle_id` が benefit/fear/authority/empathy/numeric/target/scene/sensory）がそれぞれ 1 回ずつ出現。`priceBadge` と `ctaTemplate` が入っている。

※ LP に価格情報が無い場合、情緒系 (sensory/empathy) の priceBadge が null でも OK。

- [ ] **Step 6: dev server 停止（`Ctrl+C`）+ Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/lib/banner-state.ts src/app/api/generate-copy/route.ts
git commit -m "feat(A5-Day1): 8-angle copy generation with priceBadge/ctaTemplate/urgency in JSON schema"
```

---

## Task 2 (Day 2): PriceBadge コンポーネント + 配置ロジック

**Files:**
- Create: `src/components/canvas/PriceBadge.tsx`
- Modify: `src/lib/banner-state.ts`（`computeDefaultBadgePosition` 追加）

- [ ] **Step 1: `PriceBadge.tsx` を作成**

`src/components/canvas/PriceBadge.tsx`:

```tsx
'use client';

import React from 'react';
import type { PriceBadge as PriceBadgeType, PriceBadgeShape } from '@/lib/banner-state';

const BADGE_STYLES: Record<PriceBadgeShape, string> = {
  'circle-red':
    'w-[120px] h-[120px] rounded-full bg-[#E63946] text-white flex flex-col items-center justify-center text-center font-black shadow-lg',
  'circle-gold':
    'w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#D4A017] to-[#8B6914] text-white flex flex-col items-center justify-center text-center font-black shadow-lg border-2 border-[#FFD700]',
  'rect-red':
    'px-6 py-3 rounded-xl bg-[#E63946] text-white font-black shadow-md -rotate-3',
  'ribbon-orange':
    'relative px-8 py-2 bg-[#FF6B35] text-white font-black shadow-md',
  'capsule-navy':
    'px-6 py-2 rounded-full bg-[#1D3557] text-white font-bold shadow-sm',
};

type Props = {
  badge: PriceBadgeType;
};

export function PriceBadge({ badge }: Props) {
  const base = BADGE_STYLES[badge.shape] ?? BADGE_STYLES['circle-red'];
  const style = { backgroundColor: badge.color || undefined };

  // emphasisNumber がある場合は数字部分を他のテキストと分離表示（1.5x）
  if (badge.emphasisNumber) {
    const [before, after] = badge.text.split(badge.emphasisNumber);
    return (
      <div className={base} style={style} data-testid="price-badge">
        {before && <span className="text-[14px] leading-none">{before}</span>}
        <span className="text-[32px] leading-none">{badge.emphasisNumber}</span>
        {after && <span className="text-[14px] leading-none">{after}</span>}
      </div>
    );
  }

  return (
    <div className={base} style={style} data-testid="price-badge">
      <span className="text-[16px] leading-tight">{badge.text}</span>
    </div>
  );
}
```

- [ ] **Step 2: `banner-state.ts` に `computeDefaultBadgePosition` を追加**

`src/lib/banner-state.ts` の新型群の後に追加：

```typescript
export function computeDefaultBadgePosition(
  layoutStyle: 'left' | 'right' | 'center',
  hasPerson: boolean,
  angle: AngleId
): PriceBadgePosition {
  // 人物が右側 → バッジは左下（視線の終点、写真と被らない）
  if (layoutStyle === 'left' && hasPerson) return 'bottom-left';
  // 人物が左側 → バッジは右上（Z 型の起点）
  if (layoutStyle === 'right' && hasPerson) return 'top-right';
  // 権威型はヘッダー付近
  if (angle === 'authority') return 'top-right';
  // 数字型は主役、センター配置
  if (angle === 'numeric') return 'center-right';
  return 'bottom-right';
}
```

- [ ] **Step 3: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/components/canvas/PriceBadge.tsx src/lib/banner-state.ts
git commit -m "feat(A5-Day2): add PriceBadge component (5 shapes) and default position logic"
```

---

## Task 3 (Day 3): CTA テンプレート 5 種 + CtaButton + Step3 統合

**Files:**
- Create: `src/lib/cta-templates.ts`
- Create: `src/components/canvas/CtaButton.tsx`
- Modify: `src/lib/banner-state.ts`（`autoSelectCta` 追加）
- Modify: `src/components/steps/Step3Editor.tsx`（PriceBadge / CtaButton の差込）

- [ ] **Step 1: `cta-templates.ts` を作成**

`src/lib/cta-templates.ts`:

```typescript
import type { CtaTemplateId } from './banner-state';

export interface CtaTemplateDef {
  id: CtaTemplateId;
  className: string;
  suggestedText: string[];
  arrow: boolean;
}

export const CTA_TEMPLATES: Record<CtaTemplateId, CtaTemplateDef> = {
  'cta-green-arrow': {
    id: 'cta-green-arrow',
    className:
      'px-8 py-4 rounded-full bg-gradient-to-b from-[#22C55E] to-[#15803D] text-white font-black text-lg shadow-[0_4px_12px_rgba(34,197,94,0.4)] hover:shadow-[0_6px_16px_rgba(34,197,94,0.6)] hover:scale-[1.03] transition-all',
    suggestedText: ['今すぐ購入', '無料で試す', '今すぐ予約'],
    arrow: true,
  },
  'cta-orange-arrow': {
    id: 'cta-orange-arrow',
    className:
      'px-8 py-4 rounded-xl bg-gradient-to-b from-[#FF8C42] to-[#D96A1F] text-white font-black text-lg shadow-[0_4px_12px_rgba(217,106,31,0.45)] hover:scale-[1.03] transition-all',
    suggestedText: ['今すぐ購入', 'カートに入れる', '詳細を見る'],
    arrow: true,
  },
  'cta-red-urgent': {
    id: 'cta-red-urgent',
    className:
      'px-8 py-4 rounded-xl bg-gradient-to-b from-[#EF4444] to-[#B91C1C] text-white font-black text-lg shadow-[0_4px_12px_rgba(185,28,28,0.5)] hover:scale-[1.03] transition-all animate-pulse',
    suggestedText: ['本日限り', '残りわずか', '今すぐ申し込む'],
    arrow: true,
  },
  'cta-gold-premium': {
    id: 'cta-gold-premium',
    className:
      'px-8 py-4 rounded-lg bg-gradient-to-b from-[#D4A017] to-[#8B6914] text-white font-black text-lg shadow-md border border-[#FFD700] hover:scale-[1.02] transition-all',
    suggestedText: ['詳細を確認する', '無料体験を申し込む', '特別価格で購入'],
    arrow: false,
  },
  'cta-navy-trust': {
    id: 'cta-navy-trust',
    className:
      'px-8 py-3 rounded-md bg-[#1D3557] text-white font-bold shadow-sm hover:bg-[#2A4A7F] transition-all',
    suggestedText: ['資料請求する', '無料相談を予約', 'お問い合わせ'],
    arrow: false,
  },
};
```

- [ ] **Step 2: `CtaButton.tsx` を作成**

`src/components/canvas/CtaButton.tsx`:

```tsx
'use client';

import React from 'react';
import type { CtaTemplateId } from '@/lib/banner-state';
import { CTA_TEMPLATES } from '@/lib/cta-templates';

type Props = {
  templateId: CtaTemplateId;
  text: string;
  showArrow?: boolean;
};

const CtaArrow = () => (
  <svg className="inline ml-2 w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8.59 16.58L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);

export function CtaButton({ templateId, text, showArrow }: Props) {
  const template = CTA_TEMPLATES[templateId] ?? CTA_TEMPLATES['cta-orange-arrow'];
  const withArrow = showArrow ?? template.arrow;
  return (
    <button type="button" className={template.className} data-testid={`cta-${template.id}`}>
      {text}
      {withArrow && <CtaArrow />}
    </button>
  );
}
```

- [ ] **Step 3: `banner-state.ts` に `autoSelectCta` を追加**

`src/lib/banner-state.ts` に追加：

```typescript
export type ProductCategory = 'health' | 'cosme' | 'travel' | 'btob' | 'ec-general';

export function autoSelectCta(
  category: ProductCategory,
  urgency: Urgency
): CtaTemplateId {
  const map: Record<ProductCategory, Record<Urgency, CtaTemplateId>> = {
    health: { low: 'cta-green-arrow', high: 'cta-red-urgent' },
    cosme: { low: 'cta-gold-premium', high: 'cta-orange-arrow' },
    travel: { low: 'cta-orange-arrow', high: 'cta-red-urgent' },
    btob: { low: 'cta-navy-trust', high: 'cta-navy-trust' },
    'ec-general': { low: 'cta-orange-arrow', high: 'cta-red-urgent' },
  };
  return map[category][urgency];
}
```

- [ ] **Step 4: `Step3Editor.tsx` に PriceBadge / CtaButton の import を追加**

`src/components/steps/Step3Editor.tsx` の先頭 import 群に追加：

```tsx
import { PriceBadge } from '@/components/canvas/PriceBadge';
import { CtaButton } from '@/components/canvas/CtaButton';
import type { PriceBadge as PriceBadgeType, CtaTemplateId } from '@/lib/banner-state';
```

- [ ] **Step 5: `Step3Editor.tsx` の Props 型に Phase A.5 追加**

`Step3Editor.tsx` の `type Props = { ... }` 内、Phase A5 セクション末尾に追加：

```tsx
  // Phase A5: Price Badge
  activeBadge: PriceBadgeType | null;
  setActiveBadge: (badge: PriceBadgeType | null) => void;
  // Phase A5: CTA
  activeCtaTemplateId: CtaTemplateId;
  setActiveCtaTemplateId: (id: CtaTemplateId) => void;
  activeCtaText: string;
  setActiveCtaText: (text: string) => void;
```

- [ ] **Step 6: `Step3Editor.tsx` の canvas JSX 内に PriceBadge / CtaButton の配置**

編集キャンバス（`step === 4` ブロック内、`canvasRef` の div 内）の末尾に以下を追加。座標は `absolute` でバッジ/CTA のポジションを制御：

```tsx
{props.activeBadge && (
  <div
    className="absolute z-20"
    style={getBadgePositionStyle(props.activeBadge.position, props.canvasSize)}
  >
    <PriceBadge badge={props.activeBadge} />
  </div>
)}

{props.activeCtaText && (
  <div
    className="absolute z-20"
    style={{
      bottom: `${props.canvasSize.h * 0.08}px`,
      left: '50%',
      transform: 'translateX(-50%)',
    }}
  >
    <CtaButton
      templateId={props.activeCtaTemplateId}
      text={props.activeCtaText}
      showArrow={true}
    />
  </div>
)}
```

同ファイル内に `getBadgePositionStyle` ヘルパー関数を追加（コンポーネント外）：

```tsx
function getBadgePositionStyle(
  position: string,
  canvas: { w: number; h: number }
): React.CSSProperties {
  const m = canvas.w * 0.04;
  switch (position) {
    case 'top-left': return { top: m, left: m };
    case 'top-right': return { top: m, right: m };
    case 'bottom-left': return { bottom: m, left: m };
    case 'bottom-right': return { bottom: m, right: m };
    case 'center-right': return { top: '50%', right: m, transform: 'translateY(-50%)' };
    case 'floating-product':
    default: return { bottom: canvas.h * 0.2, right: canvas.w * 0.35 };
  }
}
```

- [ ] **Step 7: `page.tsx` に新 state を追加**

`src/app/page.tsx` の既存 state 群の末尾に追加：

```tsx
const [activeBadge, setActiveBadge] = useState<PriceBadge | null>(null);
const [activeCtaTemplateId, setActiveCtaTemplateId] = useState<CtaTemplateId>('cta-orange-arrow');
const [activeCtaText, setActiveCtaText] = useState<string>('今すぐ購入');
```

import にも追加：

```tsx
import type { PriceBadge, CtaTemplateId } from '@/lib/banner-state';
```

- [ ] **Step 8: `selectAngle` 関数で新 state を初期化**

`page.tsx` の `selectAngle` 関数内（アングル選択時の state 初期化部分）に追加：

```tsx
// Phase A5: Load priceBadge / ctaTemplate from variation
setActiveBadge(v.priceBadge ?? null);
if (v.ctaTemplate) {
  setActiveCtaTemplateId(v.ctaTemplate.id);
  setActiveCtaText(v.ctaTemplate.text);
}
```

- [ ] **Step 9: `<Step3Editor />` 呼び出しに新 props を渡す**

`page.tsx` の `<Step3Editor />` に追加：

```tsx
activeBadge={activeBadge}
setActiveBadge={setActiveBadge}
activeCtaTemplateId={activeCtaTemplateId}
setActiveCtaTemplateId={setActiveCtaTemplateId}
activeCtaText={activeCtaText}
setActiveCtaText={setActiveCtaText}
```

- [ ] **Step 10: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 11: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/
git commit -m "feat(A5-Day3): add CTA 5 templates and CtaButton, wire PriceBadge/CTA into Step3Editor"
```

---

## Task 4 (Day 4): renderRichText 拡張 + validateAndFixMarkTag

**Files:**
- Modify: `src/lib/banner-state.ts`（`renderRichText` 拡張、`validateAndFixMarkTag` 追加）
- Modify: `src/components/steps/Step3Editor.tsx`（`renderRichText` 呼び出しで emphasisRatio を渡す）

- [ ] **Step 1: 既存 `renderRichText` を拡張**

`src/lib/banner-state.ts` の既存 `renderRichText` を以下に置換：

```typescript
export const renderRichText = (
  text: string,
  accentColor: string,
  emphasisRatio: EmphasisRatio = '2x'
): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(<mark>.*?<\/mark>)/);
  const scale = emphasisRatio === '3x' ? 1.5 : 1.0;
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return React.createElement('span', {
        key: i,
        style: {
          color: accentColor,
          fontSize: `${scale}em`,
          fontWeight: 900,
          display: 'inline-block',
          lineHeight: 1.2,
          margin: '0 0.05em',
        }
      }, part.replace(/<\/?mark>/g, ''));
    }
    return React.createElement('span', { key: i }, part);
  });
};
```

- [ ] **Step 2: `validateAndFixMarkTag` を追加**

`src/lib/banner-state.ts` に追加：

```typescript
/**
 * main_copy の <mark></mark> タグを検証・修正する。
 * - 0 個 → 数字優先で自動ラップ（なければ先頭の名詞）
 * - 1 個 → そのまま
 * - 2 個以上 → 先頭のみ残し他は平文化
 */
export function validateAndFixMarkTag(mainCopy: string): string {
  const markCount = (mainCopy.match(/<mark>/g) ?? []).length;
  if (markCount === 1) return mainCopy;
  if (markCount === 0) {
    // 数字を自動検出してラップ
    const withNumberMark = mainCopy.replace(/([0-9]+[%円]?)/, '<mark>$1</mark>');
    if (withNumberMark !== mainCopy) return withNumberMark;
    // 数字がなければ先頭の漢字/カタカナ/ひらがなをラップ
    return mainCopy.replace(/^([ぁ-んァ-ヶ一-龠]{2,5})/, '<mark>$1</mark>');
  }
  // 2 個以上ある場合は最初だけ残す
  let count = 0;
  return mainCopy.replace(/<mark>(.+?)<\/mark>/g, (match, inner) => {
    count++;
    return count === 1 ? match : inner;
  });
}
```

- [ ] **Step 3: `Step3Editor.tsx` の `renderRichText` 呼び出しに `emphasis_ratio` を渡す**

`Step3Editor.tsx` 内で既存の `renderRichText(...)` 呼び出しを探す：

```bash
grep -n "renderRichText" /c/Users/strkk/claude_pjt/banner-tsukurukun/src/components/steps/Step3Editor.tsx
```

見つかった全箇所について、第 3 引数に `props.activeEmphasisRatio ?? '2x'` を追加。

例（Before）:
```tsx
{renderRichText(el.content, accentColor)}
```
After:
```tsx
{renderRichText(el.content, accentColor, props.activeEmphasisRatio ?? '2x')}
```

- [ ] **Step 4: `Step3Editor` Props に `activeEmphasisRatio` を追加**

`Step3Editor.tsx` の Props 型に追加：

```tsx
  // Phase A5: Jump rate (emphasis ratio)
  activeEmphasisRatio: '2x' | '3x';
```

- [ ] **Step 5: `page.tsx` に state を追加**

```tsx
const [activeEmphasisRatio, setActiveEmphasisRatio] = useState<'2x' | '3x'>('2x');
```

- [ ] **Step 6: `selectAngle` でアングル選択時に emphasis_ratio を設定**

`page.tsx` の `selectAngle` 内に追加：

```tsx
setActiveEmphasisRatio(v.copy?.emphasis_ratio ?? '2x');
```

- [ ] **Step 7: `page.tsx` の `handleGenerateCopy` で `validateAndFixMarkTag` 適用**

`page.tsx` の import に追加：

```tsx
import { validateAndFixMarkTag } from '@/lib/banner-state';
```

`handleGenerateCopy` 内、レスポンス処理部で各 variation の main_copy を検証：

```tsx
const cleaned = (data.variations ?? []).map((v: any) => ({
  ...v,
  copy: {
    ...v.copy,
    main_copy: validateAndFixMarkTag(v.copy?.main_copy ?? ''),
  },
}));
setVariations(cleaned);
```

- [ ] **Step 8: `Step3Editor` 呼び出しに `activeEmphasisRatio` を渡す**

```tsx
activeEmphasisRatio={activeEmphasisRatio}
```

- [ ] **Step 9: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 10: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/
git commit -m "feat(A5-Day4): renderRichText emphasisRatio support + validateAndFixMarkTag post-processing"
```

---

## Task 5 (Day 5): 画像プロンプト広告化

**Files:**
- Create: `src/lib/prompts/angle-keywords.ts`
- Modify: `src/app/page.tsx`（画像プロンプト構築 useEffect を改修）

- [ ] **Step 1: `angle-keywords.ts` を作成**

`src/lib/prompts/angle-keywords.ts`:

```typescript
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
};

export const AD_COMMON_PREFIX =
  'high-quality Japanese direct-response ad banner aesthetic, commercial photography, crisp focus, dramatic studio lighting';
```

- [ ] **Step 2: `page.tsx` に state を追加（現在のアングル ID 保持）**

既存 state 群に追加：

```tsx
import type { AngleId } from '@/lib/banner-state';

const [activeAngleId, setActiveAngleId] = useState<AngleId>('benefit');
```

- [ ] **Step 3: `selectAngle` でアングル ID を保存**

`selectAngle` 関数内：

```tsx
setActiveAngleId(v.strategy?.angle_id ?? 'benefit');
```

- [ ] **Step 4: 画像プロンプト構築 useEffect を改修**

`page.tsx` の既存の画像プロンプト構築 useEffect（`manualImagePrompt` を setState するもの）を以下の合流ロジックに変更：

`page.tsx` 先頭の import に追加：

```tsx
import { ANGLE_KEYWORDS, PROVIDER_PREFIX, AD_COMMON_PREFIX } from '@/lib/prompts/angle-keywords';
```

既存 useEffect 内の `manualImagePrompt` 組み立て部分を以下に置換：

```tsx
const angleKeywords = ANGLE_KEYWORDS[activeAngleId] ?? '';
const providerPrefix = PROVIDER_PREFIX[imageModel] ?? '';

const finalMegaPrompt = [
  AD_COMMON_PREFIX,
  providerPrefix,
  angleKeywords,
  layoutInstruction,
  personConstraint,
  toneConstraint,
  `-- Core Visual Description --\n${baseImagePrompt}`,
  `-- Technical Specs --\n4k, highly detailed, photorealistic, professional lighting, no text, no watermarks, flawless aesthetic.`,
  userAdditions,
].filter(Boolean).join('\n\n');

setManualImagePrompt(finalMegaPrompt);
```

useEffect の依存配列に `activeAngleId` と `imageModel` を追加：

```tsx
}, [layoutStyle, bannerTone, hasPerson, personAttr, additionalInstructions, baseImagePrompt, activeAngleId, imageModel]);
```

- [ ] **Step 5: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 6: プロバイダスモークテスト（広告化プロンプトで生成が通るか）**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npx tsx scripts/test-image-providers.ts
```
Expected: `imagen4.png` と `flux.png` が生成される（既存スクリプトで動作確認、新キーワードは useEffect 経由で使われるので統合後に検証）。

- [ ] **Step 7: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/
git commit -m "feat(A5-Day5): inject ad-specific keywords (AD_COMMON_PREFIX + PROVIDER_PREFIX + ANGLE_KEYWORDS) into mega-prompt"
```

---

## Task 6 (Day 6): Step2Angles 4×2 グリッド + analyze-lp の pricing 追加

**Files:**
- Modify: `src/components/steps/Step2Angles.tsx`（4 カード → 8 カード）
- Modify: `src/app/api/analyze-lp/route.ts`（`pricing` フィールド追加）

- [ ] **Step 1: `Step2Angles.tsx` を 4×2 グリッドに改修**

`src/components/steps/Step2Angles.tsx` の現在の実装を読んで JSX グリッド部分を特定：

```bash
grep -n "grid\|variations.map" /c/Users/strkk/claude_pjt/banner-tsukurukun/src/components/steps/Step2Angles.tsx
```

JSX 内の variation 描画部分を以下に変更：

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  {props.variations.map((v, idx) => (
    <button
      key={v.strategy?.angle_id ?? idx}
      type="button"
      onClick={() => props.onSelectAngle(idx)}
      className="p-4 rounded-xl border border-slate-700 hover:border-sky-400 bg-slate-900/40 text-left transition-all"
      data-testid={`angle-card-${v.strategy?.angle_id ?? idx}`}
    >
      <div className="text-xs text-sky-400 mb-1">
        {v.strategy?.angle_label ?? v.strategy?.angle_id ?? `Angle ${idx + 1}`}
      </div>
      <div className="font-bold text-sm mb-1 leading-tight">
        {v.copy?.main_copy?.replace(/<\/?mark>/g, '') ?? ''}
      </div>
      <div className="text-xs text-slate-400 leading-tight">
        {v.copy?.sub_copy ?? ''}
      </div>
    </button>
  ))}
</div>
```

- [ ] **Step 2: `Step2Angles.tsx` の Props 型に `variations` が 8 要素の配列である前提を反映**

Props 型に変更なし（既存の `variations: Array<{...}>` のまま）。ただし型を厳密化したい場合は：

```tsx
variations: Array<{
  strategy: { angle_id: string; angle_label?: string; target_insight?: string };
  copy: { main_copy: string; sub_copy: string; emphasis_ratio?: '2x' | '3x' };
  priceBadge?: unknown;
  ctaTemplate?: { id: string; text: string; arrow: boolean };
  urgency?: 'low' | 'high';
  design_specs: Record<string, unknown>;
}>;
```

- [ ] **Step 3: `analyze-lp/route.ts` の prompt に pricing 抽出を追加**

`src/app/api/analyze-lp/route.ts` の既存 prompt（`【出力キー】` セクション）に以下を追加：

```typescript
const prompt = `
あなたは世界最高峰のダイレクトレスポンス・クリエイティブディレクターです。
提供された LP のテキストデータを精読し、以下のポイントを抽出・推測し、JSON フォーマットで構造化して回答してください。
Markdown ブロックなどを含めず、純粋な JSON テキストのみ出力してください。

【出力キー】
- "inferred_product_name": 推測される主要な商材名またはサービス名
- "inferred_target_demographic": 推測されるターゲット層・デモグラフィック属性
- "main_appeal": LP 全体を通じたメインの訴求ポイント・切り口
- "worldview": LP のデザイントーンや世界観
- "insight": このLPの中で最もユーザーの心を動かすと思われる要素
- "pricing": {
    "initialOffer": "初回限定価格の文字列（例: '初回限定 ¥980'）、なければ null",
    "discount": "割引率や割引額の文字列（例: '50%OFF' or '2,500円OFF'）、なければ null",
    "urgency": "期間限定・先着・残りわずか等のトリガーが LP にあれば 'high'、なければ 'low'"
  }
- "productCategory": "health | cosme | travel | btob | ec-general のいずれか"
`;
```

- [ ] **Step 4: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 5: curl で analyze-lp の新出力を確認**

dev server 起動後：

```bash
curl -X POST http://localhost:3000/api/analyze-lp \
  -H "Content-Type: application/json" \
  -u koike:banner2026 \
  -d '{"url":"https://www.apple.com/jp/iphone/"}' \
  | python -m json.tool | head -40
```
Expected: レスポンスに `"pricing": { "initialOffer": ..., "discount": ..., "urgency": ... }` と `"productCategory"` フィールドが含まれる。

- [ ] **Step 6: Commit**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add src/
git commit -m "feat(A5-Day6): 4x2 grid UI for 8 angles, analyze-lp extracts pricing + productCategory"
```

---

## Task 7 (Day 7): Prisma schema 更新 + save-banner 拡張 + 手動受入テスト

**Files:**
- Modify: `prisma/schema.prisma`（新カラム 6 個追加）
- Modify: `src/app/api/save-banner/route.ts`（新フィールド受領）
- Modify: `src/app/page.tsx`（`handleSaveList` に新フィールドを含める）
- Create: `docs/baselines/2026-04-21-phase-a5/evaluation.md`（評価シート）

- [ ] **Step 1: `prisma/schema.prisma` に新カラム追加**

`prisma/schema.prisma` の Banner モデルを以下に更新：

```prisma
model Banner {
  id               String   @id @default(cuid())
  productName      String?
  lpUrl            String?
  target           String?
  mainCopy         String?
  subCopy          String?
  elements         String?
  base64Image      String?
  angle            String?
  imageModel       String?

  // Phase A.5 で追加
  angleId          String?  // "benefit" | "fear" | ... | "sensory"
  priceBadge       String?  // JSON stringified PriceBadge | null
  ctaTemplateId    String?  // CTA テンプレ ID
  ctaText          String?  // 実際に使われた CTA 文言
  emphasisRatio    String?  // "2x" | "3x"
  urgency          String?  // "low" | "high"

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

- [ ] **Step 2: Prisma マイグレーション生成 + Neon 適用**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npx prisma migrate dev --name add_phase_a5_columns
```
Expected: `prisma/migrations/<timestamp>_add_phase_a5_columns/` が作成、Neon にカラム追加。

- [ ] **Step 3: `save-banner/route.ts` で新フィールドを受領**

`src/app/api/save-banner/route.ts` の POST 内 destructuring を更新：

```typescript
const {
  productName, lpUrl, target, mainCopy, subCopy,
  elements, base64Image, angle, imageModel,
  // Phase A.5
  angleId, priceBadge, ctaTemplateId, ctaText, emphasisRatio, urgency,
} = data;

const banner = await prisma.banner.create({
  data: {
    productName, lpUrl, target, mainCopy, subCopy,
    elements: JSON.stringify(elements),
    base64Image, angle, imageModel,
    angleId,
    priceBadge: priceBadge ? JSON.stringify(priceBadge) : null,
    ctaTemplateId, ctaText, emphasisRatio, urgency,
  },
});
```

- [ ] **Step 4: `page.tsx` の `handleSaveList` に新フィールド追加**

`src/app/page.tsx` の `handleSaveList` 内の fetch body を以下に更新：

```tsx
const res = await fetch('/api/save-banner', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productName,
    lpUrl: url,
    target,
    mainCopy: manualMainCopy,
    subCopy: manualSubCopy,
    elements: editorTexts,
    base64Image: b64,
    angle: v?.strategy?.angle || 'Manual',
    imageModel: lastProviderUsed ?? imageModel,
    // Phase A.5
    angleId: activeAngleId,
    priceBadge: activeBadge,
    ctaTemplateId: activeCtaTemplateId,
    ctaText: activeCtaText,
    emphasisRatio: activeEmphasisRatio,
    urgency: v?.urgency ?? 'low',
  }),
});
```

- [ ] **Step 5: ビルド確認**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
npm run build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 6: 手動受入テスト準備（評価シート作成）**

`docs/baselines/2026-04-21-phase-a5/evaluation.md`:

```markdown
# Phase A.5 手動受入テスト評価シート

## テスト対象 LP（3 本）

1. LP1（健康食品）: <URL>
2. LP2（ヘアケア）: <URL>
3. LP3（旅行）: <URL>

## 生成手順

各 LP で 8 アングル全て生成 → Step2 で各アングル選択 → Step3 で画像生成（Imagen 4 固定）→ スクショ保存。
合計: 3 LP × 8 アングル = 24 枚。

保存先: `docs/baselines/2026-04-21-phase-a5/after/`
ファイル名: `after-<LP番号>-<angle_id>.jpg`（例: `after-1-benefit.jpg`）

## 評価軸（各 1〜5 点）

各 24 枚について以下を評価。スプレッドシートまたは本ファイルの下に記入。

1. 広告らしさ（参考 banavo 比）
2. 可読性
3. 商品への視線誘導
4. 価格バッジの自然さ（null の場合は N/A）
5. ジャンプ率の効果（強調単語のインパクト）

## 合格基準

- 24 枚平均で各軸 3.5 以上
- 参考バナー（banavo.net 上位 9 枚）と並べたブラインドテスト：30% 以上が Phase A.5 側を選ぶ

## 評価結果（記入用）

| LP | Angle | 広告らしさ | 可読性 | 視線誘導 | バッジ | ジャンプ率 | 備考 |
|---|---|---|---|---|---|---|---|
| 1 | benefit | | | | | | |
| 1 | fear | | | | | | |
| 1 | authority | | | | | | |
| 1 | empathy | | | | | | |
| 1 | numeric | | | | | | |
| 1 | target | | | | | | |
| 1 | scene | | | | | | |
| 1 | sensory | | | | | | |
| 2〜3 は同様に 16 行追加 | | | | | | | |

## 総合判定
- [ ] 合格 → main マージ
- [ ] 不合格 → 改善点を `docs/baselines/2026-04-21-phase-a5/issues.md` に記録、fix 後再評価
```

- [ ] **Step 7: red-team + code-reviewer + simplify レビュー実行**

```
@red-team Phase A.5 の実装を docs/superpowers/specs/2026-04-21-phase-a5-ad-quality.md と突き合わせてレビューしてください。特に以下を重点的に：
- priceBadge の position 計算で canvas 外にはみ出すケース
- validateAndFixMarkTag の正規表現で漢字カバー範囲の漏れ
- 8 アングル生成で Gemini がアングル ID を重複させた場合の挙動
- CTA animate-pulse が html2canvas で書き出し時に崩れないか
- 新 Prisma カラムの null 可能性と既存レコードの扱い
```

指摘事項を `docs/reviews/2026-04-21-phase-a5-red-team.md` に保存、Critical は即対応。

```
@superpowers:code-reviewer Phase A.5 の実装を仕様書・プランと突き合わせて差分チェックしてください。
```

`docs/reviews/2026-04-21-phase-a5-code-review.md` に保存。

```
/simplify src/lib/ src/components/canvas/ src/app/api/generate-copy/
```

修正があれば：

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git add -u
git commit -m "refactor(A5-Day7): apply red-team/code-review/simplify findings"
```

- [ ] **Step 8: 24 枚の手動受入テスト実行（人間作業）**

上記評価シートの手順に従って 3 LP × 8 アングル = 24 枚を生成・保存・評価。

**※ このステップは小池さんの手動作業。エージェントは代行できない。**

- [ ] **Step 9: PR 作成**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git push origin feature/phase-a5-ad-quality
```

GitHub UI で PR 作成：
- **Title**: `Phase A.5: Ad Quality Uplift (8 angles + price badge + CTA templates + jump rate + ad prompts)`
- **Body**: 評価シート（`docs/baselines/2026-04-21-phase-a5/evaluation.md`）へのリンク + 主要変更 summary

- [ ] **Step 10: Vercel Preview で動作確認 + main マージ**

Preview URL で各アングル 1 本ずつ（合計 8 本）動作確認 → 問題なければ Merge pull request。

- [ ] **Step 11: Phase A.5 完了タグ**

```bash
cd /c/Users/strkk/claude_pjt/banner-tsukurukun
git checkout main
git pull
git tag phase-a5-complete -m "Phase A.5: Ad quality uplift (8 angles + badge + CTA + jump rate + ad prompts)"
git push origin phase-a5-complete
```

---

## Self-Review Checklist

プラン実行者は着手前に以下を確認：

- [ ] `docs/superpowers/specs/2026-04-21-phase-a5-ad-quality.md` を読んだ
- [ ] `docs/references/phase-a5-creative-direction.md` を読んだ（実装詳細の根拠）
- [ ] `.env.local` に必要な環境変数が揃っている（Phase A と同じ）
- [ ] 各タスク完了時に `npm run build` を通してから Commit する
- [ ] `[ ]` を `[x]` に進捗ごとに更新する
- [ ] 不明点は Task を停止して user に確認する。仕様を勝手に推測しない

## 既知の判断ポイント（実装中に発生しうる）

1. **`renderRichText` の emphasisRatio 適用方法**: `fontSize: ${scale}em` で行高が崩れる場合、`transform: scale(1.5)` + `display: inline-block` に切替。実機で確認して決定。
2. **CTA `animate-pulse` の html2canvas 書き出し**: 書き出し瞬間にアニメーション中のフレームがキャプチャされる可能性。必要なら書き出し直前に pulse を無効化する state を追加。
3. **Step2Angles の 8 カード表示でカード高さが揃わない**: `min-height` で統一、テキスト長が極端に違う場合は `line-clamp-2` でトリム。
4. **Prisma `priceBadge` の JSON stringify**: 既存 `elements` フィールドと同じパターンで OK。保存時は stringify、読み出し時は parse。

## 変更履歴
- 2026-04-21: 初稿
