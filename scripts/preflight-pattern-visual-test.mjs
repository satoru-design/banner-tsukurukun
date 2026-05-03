#!/usr/bin/env node
/**
 * Pre-flight: pattern × visual style 比較テスト
 *
 * 目的:
 *   現状の画像プロンプトでは pattern が「単語1個」しか効いていない（buildFinalImagePrompt:468）。
 *   visualStyleHint を追加注入したら gpt-image-2 が描き分けられるかを 12 枚生成して目視判定する。
 *
 * 出力:
 *   output/preflight-pattern-{date}/
 *     baseline_{pattern}.png    (現状プロンプト、pattern 単語1個のみ)
 *     enhanced_{pattern}.png    (現状 + visualStyleHint 注入)
 *     index.html                (12枚を 6×2 grid で並べた比較ページ)
 *     prompts.json              (各 pattern × variant のプロンプト raw)
 *
 * 使い方:
 *   cd banner-tsukurukun
 *   node scripts/preflight-pattern-visual-test.mjs
 *
 * コスト見積: 12枚 × ~$0.06 ≒ $0.72 (~¥110)
 * 所要時間: 直列で約 12-18 分
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------- .env.local / .env をパースして process.env に流し込む ----------
function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = resolve(ROOT, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnv();

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY が見つかりません (.env / .env.local 確認)');
  process.exit(1);
}

// ---------- 固定材料: スクショの内容そのまま ----------
const MATERIALS = {
  product: 'ファイブポイントデトックス',
  target: '40代女性',
  purpose: '購入Cvr最大化',
  copies: [
    '16日間で、スルッと-2kg',
    '5つの厳選ハーブが内側から働きかけ、溜め込まない毎日をサポートします。',
    '40代からのカラダの変化に',
    '', // copy4 (CTA直前ダメ押し) は省略
  ],
  designRequirements: [
    '製品ボトルと5つのハーブのイラストを配置。背景は白基調で清潔感を強調。',
    '緑とアースカラーを基調とした配色。フォントは信頼感のある明朝体。',
    '数字（92%など）を大きくあしらい、信頼性と実績を視覚的にアピール。',
    '全体的に情報を整理し、余白を活かしたレイアウト。誠実でクリーンな印象。',
  ],
  cta: '詳しくはコチラ',
  tone: '共感と解決',
  caution: '個人の感想であり効果効能を保証するものではありません。',
};

const PATTERNS = ['王道', '綺麗め', 'インパクト重視', '信頼感', 'ストーリー型', 'ラグジュアリー'];

// ---------- ここが pre-flight の核: 強化版 visualStyleHint ----------
const VISUAL_STYLE_HINTS = {
  '王道':
    [
      '配色: 白基調 + 緑(#2E7D32 系)アクセント + 黒文字。コントラスト強め。',
      '構図: 左にコピー、右に商品の左右分割。中央に大きな数字を必ず配置。',
      '質感: フラット、クリーン、印刷物的な実直さ。',
      'フォント: 太いゴシック体メイン、数字部分は極太+斜体可。',
      '装飾: 強調枠、ふきだし、矢印、円形バッジでメッセージを強調。',
      '全体イメージ: 通販雑誌・ジャパネット型ダイレクトレスポンス王道。',
    ].join('\n'),
  '綺麗め':
    [
      '配色: オフホワイト + ペールグリーン(#D5E8D4 系) + 淡いベージュ。低彩度。',
      '構図: 余白を大胆にとり、商品をセンター単体配置。コピーは控えめ。',
      '質感: 上質紙、ソフトシャドウ、自然光のような柔らかい照明。',
      'フォント: 細めの明朝体メイン。サブは細ゴシック。',
      '装飾: ほぼなし。細い罫線か、葉のシルエット程度。',
      '全体イメージ: 女性誌「&Premium」「kiitos」風、抜け感とミニマル。',
    ].join('\n'),
  'インパクト重視':
    [
      '配色: ビビッドな黄色(#FFEB00) or 蛍光緑 or 赤(#E53935)を多用。コントラスト極大。',
      '構図: 大文字コピーが画面の50-60%を占める。商品は左下脇役、数字は最大級。',
      '質感: 漫画的ベタ塗り、強い縁取り(stroke)、爆発エフェクト。',
      'フォント: 極太ゴシック・斜体・変形可。「!!」「-2kg」を巨大に。',
      '装飾: オノマトペ「スルッ」「ドン!」、集中線、星型バッジ。',
      '全体イメージ: 漫画広告、トリプルA8、スクロールを物理的に止める強い視覚刺激。',
    ].join('\n'),
  '信頼感':
    [
      '配色: ネイビー(#0D2C54) + 白 + ゴールド(#C9A227)差し色。落ち着いた高彩度。',
      '構図: 認証バッジを大きく目立つ位置に配置。中央上部に専門家肖像枠の余白を確保。',
      '質感: マット、堅実、医療パンフレット・公式書類風。',
      'フォント: 明朝体・セリフ系、伝統的で重量感あり。',
      '装飾: 罫線、賞のリボン、鍵マーク、checkmark。',
      '全体イメージ: 学術・公的・長期実績を訴求。製薬・金融広告の信頼トーン。',
    ].join('\n'),
  'ストーリー型':
    [
      '配色: 暖色系ベージュ(#F5E6D3) + ライトオレンジ + ブラウン。自然光ライク。',
      '構図: 40代女性の日常シーン(リビング・キッチン)が画面の70%を占める。コピーは下部に控えめオーバーレイ。',
      '質感: 写真ベース、ライフスタイル誌風、シネマティック、浅い被写界深度。',
      'フォント: 細めゴシック+手書き風混在可。日記のような親密さ。',
      'マスクや仰々しい装飾は禁止。写真の力で語る。',
      '全体イメージ: 共感→興味の流れ。北欧暮らしの道具店・ドキュメンタリー的。',
    ].join('\n'),
  'ラグジュアリー':
    [
      '配色: ディープネイビー or ブラック基調 + ゴールドホイル(#D4AF37) + ホワイトスペース。',
      '構図: 余白を大胆にとり、商品をセンター単体配置。コピーは最小限。',
      '質感: マット紙 + 箔押し風、エンボス、ガラスのような光沢。',
      'フォント: 細めセリフ体(Didot, Bodoni 系)・大文字・字間広め。',
      '装飾: ゴールドの細線、最小限のアイコン、ヘアラインボーダー。',
      '全体イメージ: ハイエンドD2C、価値提案優先、価格訴求なし。Cartier・Aesop の広告ライク。',
    ].join('\n'),
};

// ---------- GPT2_PREFIX を src/lib/prompts/ironclad-banner.ts:224 から copy ----------
const GPT2_PREFIX = `## 最重要ルール
- 商品画像は、添付された実画像をそのまま使用すること
- 商品画像を新規生成しないこと
- 商品画像のラベル文字、ロゴ、色、形状、キャップ、比率、容器デザインを変更しない
- 認証バッジ・受賞バッジは、添付された実素材がある場合のみ使用
- 添付されていない受賞歴は勝手に追加しない
- 実在素材がない要素は、無理に生成せず省略する

## 表現ルール
- 広告規約に配慮
- 未確認の受賞歴・認証・実績・ランキングを入れない
- 公式に確認されていない数値や効能を断定しない
- 過剰な不安訴求、身体羞恥、極端なビフォーアフター、誇大表現は禁止
- 医療効果を断定しない

## デザインルール
- スクロールを止める強いビジュアル
- テキストはスマホで読みやすい大きさ
- 主コピー → 補足 → CTA の順で視認しやすく配置
- 人物を入れる場合は日本人女性として自然に描画
- 白人・欧米系にしない

---

`;

function buildBaselinePrompt(pattern) {
  // src/lib/prompts/ironclad-banner.ts:458 buildFinalImagePrompt の再現（reference 画像なし）
  const lines = [
    'あなたはMeta広告で高CTR・高CVRを狙うバナーを作るプロです。',
    '',
    '## パターン',
    pattern,
    '',
    '## 商材',
    MATERIALS.product,
    '',
    '## ターゲット',
    MATERIALS.target,
    '',
    '## 目的',
    MATERIALS.purpose,
    '',
    '## コピー',
    ...MATERIALS.copies.filter((c) => c && c.trim()).map((c) => `・${c}`),
    '',
    '## デザイン',
    '・1:1 正方形構図。左右均等、中央にメイン被写体を据える構成',
    ...MATERIALS.designRequirements.filter((d) => d).map((d) => `・${d}`),
    `・CTA「${MATERIALS.cta}」`,
    `・${MATERIALS.tone}の世界観`,
    '・広告規約に配慮しつつ、スクロールを止める強いビジュアル',
    '・未確認の受賞歴・認証・実績・ランキングは入れない',
    '',
    '## 注意',
    MATERIALS.caution,
    '',
    '## 出力',
    '1:1 の広告バナー画像を1枚生成',
  ];
  return GPT2_PREFIX + lines.join('\n');
}

function buildEnhancedPrompt(pattern) {
  // baseline + 末尾に visualStyleHint を追記
  const baseline = buildBaselinePrompt(pattern);
  return (
    baseline +
    '\n\n## 🎨 ビジュアルスタイル指示（必ず厳守）\n' +
    `この広告は「${pattern}」スタイル。下記の視覚指示に従って描画すること。\n\n` +
    VISUAL_STYLE_HINTS[pattern]
  );
}

// ---------- 出力先 ----------
const today = new Date().toISOString().slice(0, 10);
const OUT_DIR = resolve(ROOT, 'output', `preflight-pattern-${today}`);
mkdirSync(OUT_DIR, { recursive: true });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- 単発生成 ----------
async function generateOne(variant, pattern, prompt) {
  const label = `${variant}_${pattern}`;
  const start = Date.now();
  console.log(`[${label}] 生成開始 (promptLength=${prompt.length})`);
  try {
    const resp = await openai.images.generate({
      model: 'gpt-image-2',
      prompt,
      size: '1024x1024',
      quality: 'high',
      n: 1,
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error('no b64_json in response');
    const buf = Buffer.from(b64, 'base64');
    const outPath = resolve(OUT_DIR, `${label}.png`);
    writeFileSync(outPath, buf);
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[${label}] OK (${sec}s, ${(buf.length / 1024).toFixed(0)}KB)`);
    return { variant, pattern, ok: true, file: `${label}.png`, sec };
  } catch (e) {
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${label}] FAIL (${sec}s): ${msg}`);
    return { variant, pattern, ok: false, error: msg };
  }
}

// ---------- 比較 HTML ----------
function buildIndexHtml(results) {
  const cellFor = (variant, pattern) => {
    const r = results.find((r) => r.variant === variant && r.pattern === pattern);
    if (!r) return '<td>-</td>';
    if (!r.ok) return `<td style="color:#c00;font-size:11px">FAIL: ${r.error}</td>`;
    return `<td><img src="${r.file}" style="width:240px;height:240px;object-fit:cover;border:1px solid #ccc" /></td>`;
  };
  const rows = PATTERNS.map(
    (p) => `
    <tr>
      <th style="padding:8px;background:#f5f5f5;font-size:13px">${p}</th>
      ${cellFor('baseline', p)}
      ${cellFor('enhanced', p)}
    </tr>`,
  ).join('');
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>pre-flight pattern visual test ${today}</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#fff;color:#111;padding:24px}
    table{border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    h1{margin:0 0 8px 0;font-size:20px}
    p{color:#555;margin:4px 0 16px 0}
    .legend{font-size:12px;color:#888}
  </style>
</head>
<body>
  <h1>pre-flight: pattern × visualStyleHint 比較</h1>
  <p>商材: ${MATERIALS.product} / ターゲット: ${MATERIALS.target} / size: 1024x1024 / reference 画像なし</p>
  <p class="legend">judge: (1) baseline 内で 6 pattern を識別できるか / (2) enhanced は実用に耐える幅か / (3) コピー固定が両 variant で守られているか</p>
  <table>
    <tr>
      <th></th>
      <th style="padding:8px;background:#f5f5f5">baseline<br/><span style="font-weight:normal;font-size:11px;color:#777">pattern 単語1個のみ</span></th>
      <th style="padding:8px;background:#f5f5f5">enhanced<br/><span style="font-weight:normal;font-size:11px;color:#777">+ visualStyleHint 注入</span></th>
    </tr>
    ${rows}
  </table>
</body>
</html>`;
}

// ---------- main ----------
(async () => {
  console.log(`出力先: ${OUT_DIR}`);
  console.log(`生成枚数: ${PATTERNS.length * 2} (6 pattern × 2 variant)`);
  console.log('---');

  const allPrompts = {};
  const results = [];

  for (const variant of ['baseline', 'enhanced']) {
    for (const pattern of PATTERNS) {
      const prompt = variant === 'baseline' ? buildBaselinePrompt(pattern) : buildEnhancedPrompt(pattern);
      allPrompts[`${variant}_${pattern}`] = prompt;
      const r = await generateOne(variant, pattern, prompt);
      results.push(r);
    }
  }

  writeFileSync(resolve(OUT_DIR, 'prompts.json'), JSON.stringify(allPrompts, null, 2));
  writeFileSync(resolve(OUT_DIR, 'index.html'), buildIndexHtml(results));
  writeFileSync(resolve(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));

  const ok = results.filter((r) => r.ok).length;
  const ng = results.length - ok;
  console.log('---');
  console.log(`完了: ${ok} OK / ${ng} FAIL`);
  console.log(`HTML: ${resolve(OUT_DIR, 'index.html')}`);
})();
