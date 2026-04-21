# Phase A.5 Creative Direction 完全仕様書

- **作成日**: 2026-04-21
- **起草**: creative-direction agent（小池慧の参謀）
- **前提資料**: `banner-kingsroad.md`（広告王道調査）/ `2026-04-21-banner-tsukurukun-v2-design.md`（Phase A 設計）
- **対象**: Phase A.5（広告品質改善）案 ① Quick Win MVP 5 機能
- **参考バナー**: banavo.net 上位事例 9 枚（健康食品 A/B/C、ヘアケア D/E/F、旅行 G/H/I）

---

## ブランド/UX 分析（全体方針）

### 現状課題
1. `generate-copy` は抽象 4 アングル（Benefit/Fear/Authority/Empathy）のみ。ダイレクトレスポンス広告に必須の「数字」「シーン」「臨場感」が弱い
2. 価格バッジ・CTA ボタン・ジャンプ率という**「広告らしさの決定打 3 兄弟」**が JSON スキーマに存在しない
3. 画像プロンプトが「ネガティブスペース意識」止まりで、広告写真特有のライティング・商品プロミネンスの語彙が不足

### クリエイティブ方針（Phase A.5 の North Star）
> **「素人が作ったおしゃれ画像」から「プロの広告代理店が作った売れるバナー」へ。**

参考 9 枚に共通するのは「①カテゴリタグ → ②ジャンプ率の高いキャッチ → ③数字を含むサブコピー → ④価格バッジ → ⑤矢印付き CTA」の**5 層情報レイヤー**。この 5 層を Gemini の 1 回の JSON 出力で一気通貫に生成し、Step3 の UI に素直にマッピングする。

---

## 1. コピー 8 アングル拡張

### 完全仕様：アングル定義と prompt テンプレート

#### 既存 4 アングル（抽象層：課題発見）
| ID | 名称 | 訴求軸 | 主ターゲット感情 |
|---|---|---|---|
| `benefit` | ベネフィット | 得られる未来 | 期待・向上心 |
| `fear` | フィア | 失うリスク | 不安・焦り |
| `authority` | 権威 | 社会的証明 | 安心・信頼 |
| `empathy` | 共感 | 悩みの可視化 | 納得・共鳴 |

#### 追加 4 アングル（具体層：表現技法）
| ID | 名称 | 訴求軸 | 典型フレーズ |
|---|---|---|---|
| `numeric` | 数字表現型 | 定量具体化 | 「367 種」「初回 ¥980」「50%OFF」 |
| `target` | ターゲット絞込み型 | 呼びかけ | 「40 代の男性へ」「忙しいあなたに」 |
| `scene` | 利用シーン提案型 | 使用文脈 | 「浴室の 3 分で」「出張の朝に」 |
| `sensory` | 臨場感演出型 | 五感刺激 | 「とろける泡」「さらさら感」「ツヤ髪」 |

### prompt テンプレート（Gemini 2.5 Pro 向け system prompt 改訂版）

```
あなたは日本のダイレクトレスポンス広告に 15 年従事したコピーライター兼クリエイティブディレクターです。
banavo.net 上位バナーと同等の CTR（目標 1%+）を叩き出すコピーを生成してください。

【8 アングル】それぞれで 1 本ずつ、計 8 本を生成してください。

抽象 4 層（課題発見の切り口）
1. benefit   : 得られる理想の未来を描写
2. fear      : 何もしないと失うものを提示
3. authority : No.1 / 実績 / 専門家の裏付け
4. empathy   : ターゲットの内心を代弁

具体 4 層（表現技法）
5. numeric   : 数字を main_copy または sub_copy に必ず含める（％・円・種類数・年数など）
6. target    : 「〇〇なあなたへ」「40 代男性必見」のような呼びかけで始める
7. scene     : 使用する時間・場所・状況を具体描写（例：「朝の 5 分で」「出張先のホテルで」）
8. sensory   : オノマトペ・触感・視覚効果で五感を刺激（例：「とろける」「さらさら」「ふわっと」）

【各アングル共通の制約】
- main_copy: 20 文字以内、<mark></mark> で強調 1 単語のみ囲む
- sub_copy: 35 文字以内、main を補強。改行可（\n で明示）
- emphasis_ratio: "2x" | "3x"（main_copy 内の <mark> 単語を何倍サイズで描画するか。numeric と sensory は 3x、それ以外は 2x）
- priceBadge: 下記スキーマ参照
- ctaTemplate: 下記 5 種から選択

【JSON 構造】※ Markdown のバッククォートは含めない
[
  {
    "strategy": {
      "angle_id": "benefit|fear|authority|empathy|numeric|target|scene|sensory",
      "angle_label": "人間可読名（例：数字表現型）",
      "target_insight": "このバナーを見た人がどう感じるべきか"
    },
    "copy": {
      "main_copy": "<mark>強調語</mark>を含む 20 字以内",
      "sub_copy": "35 字以内、\n 改行可",
      "emphasis_ratio": "2x"
    },
    "priceBadge": { "text": "初回限定 ¥980", "shape": "circle-red", "color": "#E63946", "position": "bottom-left" },
    "ctaTemplate": { "id": "cta-orange-arrow", "text": "今すぐ購入", "arrow": true },
    "design_specs": {
      "tone_and_manner": "...",
      "color_palette": { "main": "#1B1B1B", "accent": "#E63946" },
      "layout_id": "z-pattern | f-type | split-screen | center-focus | footer-type",
      "image_gen_prompt": "英語プロンプト。角度固有のキーワードを含む（下記 5 章参照）"
    }
  }
]
```

### 実装スケッチ（`generate-copy/route.ts` 差分）

```typescript
// 既存の systemPrompt を上記 8 アングル版に置換
// responseMimeType: 'application/json' は維持、temperature 0.7 も維持
// 出力は 8 要素の配列 → フロント側で 4×2 グリッドに配置

// Step2Angles.tsx 側：
// <div className="grid grid-cols-4 gap-3">
//   {variations.map(v => <AngleCard angle={v} key={v.strategy.angle_id} />)}
// </div>
// モバイル: grid-cols-2、デスクトップ: grid-cols-4
```

### 9 参考バナーとの整合性（型マッピング）

| バナー | 商材 | 該当アングル | 根拠 |
|---|---|---|---|
| A | 健康食品 / サプリ | `benefit` + `numeric` | 「バランスを整えて / パフォーマンス UP」= 未来描写、「50%OFF 2,500 円」= 数字 |
| B | 黒酢ガーリック | `target` + `fear` | 「いつまでも若々しくいたいあなたへ」= 呼びかけ＋老化不安 |
| C | 青汁 | `numeric` + `scene` | 「367 種の栄養」= 数字、「簡単健康習慣」= 使用シーン |
| D | シャンプー NATURE'S GLOW | `sensory` + `benefit` | 「自然なツヤ髪へ」= 触覚視覚、「植物の力で」= 得られる未来 |
| E | ヘアケア（浴室） | `scene` + `sensory` | 「洗うたび美しく」= 使用タイミング、「しっとりツヤ髪」= 五感 |
| F | ヘアケア（スパ） | `empathy` + `benefit` | 「自信を持てる髪で新しい出発」= 内心代弁＋未来 |
| G | イタリア旅行 | `numeric` + `authority` | 「3 日間 50 万円」= 数字、「ロレンツォが特別にアテンド」= 権威 |
| H | 京都旅行 | `sensory` + `scene` | 「瞬間を京都で感じて」= 五感＋シーン |
| I | バリ旅行 | `numeric` + `scene` | 「3 泊 4 日 15 万円」= 数字、「絶景巡りとリラクゼーション」= 使用文脈 |

**洞察**: 9 枚中 9 枚で「数字 or 臨場感」が必ず 1 レイヤー入っている。既存 4 アングルだけではこの層が生成されず、ここが CTR を決めている。

---

## 2. 価格バッジ生成

### 完全仕様：JSON スキーマ

```typescript
// src/lib/banner-state.ts に追加
export type PriceBadgeShape =
  | 'circle-red'       // 赤丸（セール・定番）
  | 'circle-gold'      // 金丸（プレミアム・D2C）
  | 'rect-red'         // 赤角丸（緊急・限定）
  | 'ribbon-orange'    // リボン型（キャンペーン告知）
  | 'capsule-navy';    // カプセル型ネイビー（BtoB・金融）

export type PriceBadgePosition =
  | 'top-left' | 'top-right'
  | 'bottom-left' | 'bottom-right'
  | 'center-right' | 'floating-product'; // 商品画像のそば

export interface PriceBadge {
  text: string;              // 例: "初回限定 ¥980"
  shape: PriceBadgeShape;
  color: string;             // Hex（shape のデフォルトを上書き可）
  position: PriceBadgePosition;
  emphasisNumber?: string;   // 例: "980" を他より大きく表示
}
```

### text の生成ルール（優先順位）

1. **LP 解析結果を最優先**: `analyze-lp` の出力 JSON に `pricing.initialOffer` / `pricing.discount` フィールドを追加し、そこから自動抽出
2. **フォールバック**: LP に記載がなければアングル別の定型文を採用
   - `numeric`: 「初回限定 ¥{number}」
   - `fear`: 「今だけ 50%OFF」
   - `authority`: 「累計販売 〇〇万個」
   - `scene`/`sensory`: 「送料無料」（価格訴求より体験訴求）
3. **ユーザー上書き**: Step3 に `<input>` で常に編集可能（最優先）

### 5 種の HTML/CSS 実装スケッチ

```tsx
// src/components/canvas/PriceBadge.tsx
const BADGE_STYLES: Record<PriceBadgeShape, string> = {
  'circle-red':
    'w-[120px] h-[120px] rounded-full bg-[#E63946] text-white flex flex-col items-center justify-center text-center font-black shadow-lg',
  'circle-gold':
    'w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#D4A017] to-[#8B6914] text-white flex flex-col items-center justify-center text-center font-black shadow-lg border-2 border-[#FFD700]',
  'rect-red':
    'px-6 py-3 rounded-xl bg-[#E63946] text-white font-black shadow-md -rotate-3',
  'ribbon-orange':
    'relative px-8 py-2 bg-[#FF6B35] text-white font-black shadow-md before:absolute before:left-0 before:top-full before:border-t-[10px] before:border-l-[10px] before:border-t-[#B8471C] before:border-l-transparent',
  'capsule-navy':
    'px-6 py-2 rounded-full bg-[#1D3557] text-white font-bold shadow-sm',
};

// emphasisNumber は CSS で 1.5x サイズ
<div className={BADGE_STYLES[badge.shape]} style={{ backgroundColor: badge.color }}>
  <span className="text-[14px]">初回限定</span>
  <span className="text-[32px] leading-none">¥{badge.emphasisNumber}</span>
</div>
```

### 配置ロジック（AI デフォルト配置）

```typescript
// src/lib/banner-state.ts に追加
export function computeDefaultBadgePosition(
  layout: LayoutStyle,
  hasPerson: boolean,
  angle: AngleId
): PriceBadgePosition {
  // 人物が右側 → バッジは左下（視線の終点、写真と被らない）
  if (layout === 'left' && hasPerson) return 'bottom-left';
  // 人物が左側 → バッジは右上（Z 型の起点）
  if (layout === 'right' && hasPerson) return 'top-right';
  // 権威型はヘッダー付近（信頼感を先に）
  if (angle === 'authority') return 'top-right';
  // 数字型は主役、センター配置
  if (angle === 'numeric') return 'center-right';
  return 'bottom-right';
}
```

### 9 参考バナーとの整合性

| バナー | shape | position | emphasisNumber |
|---|---|---|---|
| A | circle-red | bottom-left | 「50%OFF 2,500 円」 |
| B | circle-gold | center-right | 「980」 |
| C | rect-red | center-right | 「980」 |
| D | circle-gold | top-left | 「50%OFF」 |
| E | circle-gold | center-right | 「50%OFF」 |
| F | （なし）| — | — |
| G | （金縁+水色ストライプの大コピー自体が兼用）| center | 「50 万円〜」 |
| H | （なし・情緒系）| — | — |
| I | （水色ストライプ+赤フチの大コピー兼用）| center | 「15 万円〜」 |

**洞察**: 健康食品・ヘアケアで 5/6 枚がバッジあり、情緒系（F, H）では省略。**アングルが `sensory` or `empathy` 単体のときは priceBadge を `null` 可**にすると自然。

---

## 3. CTA テンプレート 5 種

### 完全仕様：5 種のデザイン仕様

```typescript
// src/lib/cta-templates.ts（新規）
export type CtaTemplateId =
  | 'cta-green-arrow'    // 健康食品・通販（定番）
  | 'cta-orange-arrow'   // EC 全般（行動喚起・定番）
  | 'cta-red-urgent'     // 期間限定・セール
  | 'cta-gold-premium'   // プレミアム D2C
  | 'cta-navy-trust';    // BtoB・金融・医療

export const CTA_TEMPLATES = {
  'cta-green-arrow': {
    className:
      'px-8 py-4 rounded-full bg-gradient-to-b from-[#22C55E] to-[#15803D] text-white font-black text-lg shadow-[0_4px_12px_rgba(34,197,94,0.4)] hover:shadow-[0_6px_16px_rgba(34,197,94,0.6)] hover:scale-[1.03] transition-all',
    suggestedText: ['今すぐ購入', '無料で試す', '今すぐ予約'],
    arrow: true,
  },
  'cta-orange-arrow': {
    className:
      'px-8 py-4 rounded-xl bg-gradient-to-b from-[#FF8C42] to-[#D96A1F] text-white font-black text-lg shadow-[0_4px_12px_rgba(217,106,31,0.45)] hover:scale-[1.03] transition-all',
    suggestedText: ['今すぐ購入', 'カートに入れる', '詳細を見る'],
    arrow: true,
  },
  'cta-red-urgent': {
    className:
      'px-8 py-4 rounded-xl bg-gradient-to-b from-[#EF4444] to-[#B91C1C] text-white font-black text-lg shadow-[0_4px_12px_rgba(185,28,28,0.5)] hover:scale-[1.03] transition-all animate-pulse',
    suggestedText: ['本日限り', '残りわずか', '今すぐ申し込む'],
    arrow: true,
  },
  'cta-gold-premium': {
    className:
      'px-8 py-4 rounded-lg bg-gradient-to-b from-[#D4A017] to-[#8B6914] text-white font-black text-lg shadow-md border border-[#FFD700] hover:scale-[1.02] transition-all',
    suggestedText: ['詳細を確認する', '無料体験を申し込む', '特別価格で購入'],
    arrow: false,
  },
  'cta-navy-trust': {
    className:
      'px-8 py-3 rounded-md bg-[#1D3557] text-white font-bold shadow-sm hover:bg-[#2A4A7F] transition-all',
    suggestedText: ['資料請求する', '無料相談を予約', 'お問い合わせ'],
    arrow: false,
  },
} as const;

// 矢印 SVG
export const CtaArrow = () => (
  <svg className="inline ml-2 w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.59 16.58L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);
```

### 文言生成ルール（商材タイプ × 緊急性）

| 商材タイプ | 低緊急度 | 高緊急度 |
|---|---|---|
| 健康食品 / D2C | `cta-green-arrow` | `cta-red-urgent` |
| コスメ / ヘアケア | `cta-gold-premium` | `cta-orange-arrow` |
| 旅行 | `cta-orange-arrow` | `cta-red-urgent` |
| BtoB / 金融 | `cta-navy-trust` | `cta-navy-trust` |
| EC 全般 | `cta-orange-arrow` | `cta-red-urgent` |

**緊急度の判定**: LP に「期間限定」「本日限り」「残り〇〇」のいずれかが含まれれば「高」。Gemini に判定させる（`urgency: "low" | "high"` を JSON に含める）。

### ホバー・シャドウ仕様
- **shadow**: RGBA でベース色の 0.4〜0.5 透明度、縦オフセット 4px、ブラー 12px
- **hover**: scale(1.03) + shadow 強化（0.6 透明度・16px ブラー）
- **transition**: 200ms ease
- **緊急度「高」**: `animate-pulse`（Tailwind 標準）で 2 秒周期の脈動

### 9 参考バナーとの整合性

| バナー | 該当 CTA | 文言 |
|---|---|---|
| A | `cta-green-arrow`（白地に緑でも可）| 今すぐ購入 |
| B | `cta-red-urgent` | 今すぐ購入 |
| C | `cta-orange-arrow` | 今すぐ予約 ▶ |
| D | `cta-gold-premium` (ベージュ系) | 今すぐ購入 |
| E | `cta-orange-arrow` (ピンク寄り) | 今すぐ購入 |
| F | `cta-gold-premium` (ベージュ) | 今すぐ購入 |
| G/H/I | （旅行系は CTA ボタンなしが多い、代わりに価格が CTA 兼用）| — |

**洞察**: 参考バナーの 2/3 が「▶ 矢印付き」。`arrow: true` をデフォルトに。

---

## 4. ジャンプ率の自動設計

### 「強調 1 単語」特定ロジック：ハイブリッド方式

**Gemini 側（一次指定）**
- system prompt に「main_copy は必ず `<mark></mark>` で強調 1 単語のみを囲む」を強制
- 強調対象の優先順位を明示：①数字 → ②商品の核心ベネフィット → ③感情を揺さぶるオノマトペ → ④それ以外の動詞

**後処理ロジック（二次バリデーション）**
```typescript
// src/lib/banner-state.ts
export function validateAndFixMarkTag(mainCopy: string): string {
  const markCount = (mainCopy.match(/<mark>/g) || []).length;
  if (markCount === 1) return mainCopy;
  if (markCount === 0) {
    // 数字を自動検出してラップ
    const withNumberMark = mainCopy.replace(/([0-9]+[%円]?)/, '<mark>$1</mark>');
    if (withNumberMark !== mainCopy) return withNumberMark;
    // 数字がなければ最初の名詞（雑にカタカナ語や「〇〇で」の前）をラップ
    return mainCopy.replace(/^([ぁ-んァ-ヶ一-龠]{2,5})/, '<mark>$1</mark>');
  }
  // 2 個以上ある場合は最初だけ残す
  let count = 0;
  return mainCopy.replace(/<mark>(.+?)<\/mark>/g, (m, p1) => {
    count++;
    return count === 1 ? m : p1;
  });
}
```

### 倍率の出し分け基準（`emphasis_ratio`）

| アングル | 倍率 | 理由 |
|---|---|---|
| `numeric` | **3x** | 数字は広告の主役。Apple iPad Pro は 2x だが広告バナーは 3x が効く |
| `sensory` | **3x** | オノマトペ・触感は感情トリガー、躍動感が必要 |
| `fear` | **3x** | 煽り系は強ジャンプ |
| `benefit` | 2x | 未来描写は読み物、賑やかすぎると安っぽい |
| `authority` | 2x | 信頼感は落ち着きが必要（iPad Pro の 2x 帯） |
| `empathy` | 2x | 共感は同じ目線、ジャンプさせすぎない |
| `target` | 2x | 呼びかけは自然なトーン |
| `scene` | 2x | シーン描写は情緒、ジャンプ率低め |

**ターゲット層で変えるか？** 変える。
- **30 代以下 / SNS 世代**: 全アングル +0.5x（動画世代は刺激慣れ）
- **50 代以上 / シニア**: 全アングル -0.5x（可読性優先）
- **BtoB**: 全アングル -0.5x（落ち着き優先）

### `renderRichText` 既存実装との整合性

現 `Step3Editor` の `main` タイプで `renderRichText(el.content, accent)` が呼ばれており、これは `<mark>` を accent 色で描画する実装のはず。**拡張**:

```typescript
// src/lib/banner-state.ts
export function renderRichText(
  content: string,
  accentColor: string,
  emphasisRatio: '2x' | '3x' = '2x'
): React.ReactNode {
  const parts = content.split(/(<mark>.*?<\/mark>)/);
  return parts.map((p, i) => {
    const match = p.match(/<mark>(.*?)<\/mark>/);
    if (match) {
      return (
        <span
          key={i}
          style={{
            color: accentColor,
            fontSize: emphasisRatio === '3x' ? '1em' : '1em', // 親側で fontSize を渡す
            transform: emphasisRatio === '3x' ? 'scale(1.5)' : 'scale(1.0)',
            display: 'inline-block',
            fontWeight: 900,
            margin: '0 0.1em',
          }}
        >
          {match[1]}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
```

※ `fontSize` を実数倍するアプローチでも可。`transform: scale` は行高への影響があるため、**実寸変更**が推奨。`main_copy` の描画時に base fontSize × ratio を算出して inline style で適用する。

---

## 5. 画像プロンプトの広告化

### Imagen 4 / FLUX それぞれへの英語キーワード注入

#### 共通プレフィックス（全アングル）
```
"high-quality Japanese direct-response ad banner aesthetic,
commercial photography, crisp focus, dramatic studio lighting,
strong negative space on the {layoutSide} for overlay typography,
16:9 or 1:1 composition, shot on Canon EOS R5, 85mm lens"
```

#### Imagen 4 特有（Google 系、人物とテキスト整合に強い）
```
追加: "photorealistic, magazine cover quality, soft rim light, shallow depth of field"
回避: 過剰な光学フレアは NG → "no lens flare" を negativePrompt に
```

#### FLUX 1.1 pro 特有（Replicate、スタイル制御に強い）
```
追加: "cinematic color grading, product hero shot, editorial advertising style"
negativePrompt: "text, letters, watermark, logo, low quality, blurry, cartoon, 3d render, nsfw"
```

### Phase A の useEffect メガプロンプトへの追加位置

想定：`page.tsx` or 親コンポーネント側で下記のような構築をしているはず。

```typescript
// 推定：既存の画像プロンプト構築 useEffect
const megaPrompt = [
  angleData.design_specs.image_gen_prompt,  // ★ここに注入
  `tone and manner: ${angleData.design_specs.tone_and_manner}`,
  `layout: ${layoutStyle}`,
  hasPerson === 'yes' ? `include a ${personAttr} person` : 'no person',
  bannerTone,
  additionalInstructions,
].filter(Boolean).join(', ');
```

**改訂**: Gemini 側から返ってくる `image_gen_prompt` に予め広告語彙を含めるよう、`generate-copy` の system prompt で強制する（下記参照）。`useEffect` 側では追加で「プロバイダ別プレフィックス」を差し込むだけにする。

```typescript
const PROVIDER_PREFIX = {
  imagen4: 'photorealistic, magazine cover quality, soft rim light',
  flux: 'cinematic color grading, product hero shot, editorial advertising style',
};
const megaPrompt = [
  'high-quality Japanese direct-response ad banner aesthetic, commercial photography',
  PROVIDER_PREFIX[imageModel],
  ANGLE_KEYWORDS[angleData.strategy.angle_id], // ★ 追加
  angleData.design_specs.image_gen_prompt,
  `strong negative space on the ${layoutStyle} for overlay typography`,
  hasPerson === 'yes' ? `${personAttr} person, natural pose, looking at product` : '',
  bannerTone,
  additionalInstructions,
].filter(Boolean).join(', ');
```

### アングルの型ごとのキーワード辞書

```typescript
// src/lib/prompts/angle-keywords.ts
export const ANGLE_KEYWORDS: Record<AngleId, string> = {
  benefit:   'bright uplifting mood, warm sunlight, confident smile, aspirational lifestyle',
  fear:      'moody dramatic lighting, concerned expression, contrast between before and after, muted tones',
  authority: 'professional trustworthy, business attire, clean white background, authoritative composition, medical-grade precision',
  empathy:   'intimate relatable, natural home setting, soft window light, candid unposed moment',
  numeric:   'product hero shot with prominent price tag area, bold composition, high contrast for text overlay',
  target:    'demographic-specific setting (age-appropriate environment), direct eye contact with camera',
  scene:     'specific use-case environment (bathroom/office/kitchen), in-the-moment action shot',
  sensory:   'tactile texture emphasis, slow-motion splash or flow, macro details, vibrant saturation',
};
```

### 9 参考バナーとの整合性（画像表現の語彙）

| バナー | 該当アングル | 想定プロンプト語彙 |
|---|---|---|
| A | benefit + numeric | "confident businessman holding supplement, bright office, soft warm light, negative space on top-left" |
| B | fear + authority | "athletic mature male silhouette, dramatic red-black lighting, gold-rimmed product bottle, studio shot" |
| C | numeric + scene | "natural garden morning light, healthy man drinking green juice, lush plants, product pouch on right" |
| D | sensory + benefit | "shampoo bottles on warm wooden counter, houseplants, golden hour side light, product hero shot" |
| E | scene + sensory | "woman under shower, water droplets macro, pink product bottle right, soft humid atmosphere" |
| F | empathy | "woman with eyes closed, spa setting, soft natural light, relaxed side profile, earth tones" |
| G | numeric + authority | "beach selfie group shot, Italian coastline, vibrant colors, confetti decorative elements" |
| H | sensory + scene | "autumn Kyoto Kiyomizu-dera, woman in fall outfit, picture-book illustration style, warm maple leaves" |
| I | numeric + scene | "Bali beach with palm frame, turquoise water, relaxation luxury, selfie inset bottom-right" |

---

## AB テスト提案（Phase A.5 検証フェーズ）

Phase A.5 デプロイ後、**同一 LP で下記仮説を検証**：

| 仮説 | A 群 | B 群 | 評価指標 |
|---|---|---|---|
| H1 | 既存 4 アングル | 新 8 アングル | 人間による「使える率」（目視）/ CTR（後日） |
| H2 | priceBadge なし | priceBadge あり | CVR（バナー→LP 遷移後） |
| H3 | ジャンプ率 2x 固定 | アングル別 2x/3x 出し分け | 視線到達率（Phase D ヒートマップで代替） |
| H4 | Imagen 4 単独 | FLUX 1.1 pro 単独 | 画質評価（目視 5 段階） |
| H5 | CTA `cta-green-arrow` 固定 | 商材別自動選定 | クリック率（SNS 配信時） |

**最優先検証**: H1（8 アングルの採用率）と H2（価格バッジの有無）。この 2 つで CVR が 1.3 倍以上にならなければ Phase A.5 のスコープ自体を再検討する。

---

## 実装優先順位（1 週間スプリント想定）

| 日 | タスク | 担当ファイル |
|---|---|---|
| Day 1 | `generate-copy/route.ts` の 8 アングル化・JSON スキーマ拡張 | `src/app/api/generate-copy/route.ts` |
| Day 2 | `PriceBadge` コンポーネント + 5 種 CSS + 配置ロジック | `src/components/canvas/PriceBadge.tsx`, `src/lib/banner-state.ts` |
| Day 3 | `CTA_TEMPLATES` 5 種 + `CtaArrow` + Step3 UI 統合 | `src/lib/cta-templates.ts`, `src/components/steps/Step3Editor.tsx` |
| Day 4 | `renderRichText` 拡張 + `emphasis_ratio` 適用 + 後処理バリデーション | `src/lib/banner-state.ts` |
| Day 5 | 画像プロンプト広告化（プロバイダ別プレフィックス + アングル辞書） | `src/lib/prompts/angle-keywords.ts`, `page.tsx` 側の useEffect |
| Day 6 | Step2Angles の 4×2 グリッド UI 改修 | `src/components/steps/Step2Angles.tsx` |
| Day 7 | 参考 9 枚を入力した手動受入テスト（各アングル 1 本ずつ生成 → 目視評価スコアシート化） | — |

---

## 変更履歴
- 2026-04-21: 初稿（creative-direction agent 起草）
