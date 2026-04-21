# Phase A Red-Team レビュー

- 実施日: 2026-04-21
- 対象ブランチ: `feature/phase-a-image-dual`
- レビュワー: Red Team (WorldClassExecutiveOS)
- 対象: Phase A（画像モデル Dual 化 + Basic Auth + Postgres 移行）

---

## 1. 致命的リスク（失敗確率 30% 以上、損害大）

### R-C1: 「フォールバック二重課金」— レート制限でも片方→もう片方に常に飛ぶ

**場所**: `src/lib/image-providers/index.ts` `generateWithFallback`

**現状**: `try { ... } catch (err) { lastError = err; }` でエラー種別を区別せず、**どんな失敗でも必ずもう一方のプロバイダを呼ぶ**。

**再現シナリオ**:
- Imagen 4 のクォータを 1 日の昼に使い切る → 残り半日、ユーザーが「imagen4」を選んで 10 回押すたびに **毎回 FLUX に落ちて $0.04 × 10 = $0.40 / 日** が無駄発生
- FLUX 側がプロンプトのセーフティで 422 を返した場合も Imagen 4 に落ちる。両方拒否 → ユーザーが「なぜか失敗する」と連打 → **1 クリックで 2 API コール分の課金**
- 深刻度: Basic Auth 破られた場合、1 人の攻撃者が `curl` ループで **1 分 30 回 × 2 モデル = 60 コール = $2.40/分 = $144/時間** の損害を出せる

**損害試算**: 運用中に月 $50〜$200 の課金漏れ、Auth 破りで $100/時間超

**修正**:
```typescript
// リトライ対象のエラーだけフォールバック、それ以外は即 throw
catch (err) {
  if (!isTransientError(err)) throw err;  // 422/400/認証エラーは fail-fast
  lastError = err;
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|5\d\d|rate.?limit|ECONN|ETIMEDOUT/i.test(msg);
}
```

加えて **1 プロセス内で rate limit ヒット後は 60 秒クールダウン**（in-memory Map で `lastFailedAt`）を挟む。

---

### R-C2: 「Vercel 504 後のゾンビ課金」— タイムアウト後も Replicate ジョブは完走

**場所**: `src/app/api/generate-image/route.ts` (`maxDuration = 60`)、`src/lib/image-providers/flux.ts`

**現状**: `replicate.run()` は polling しながら結果を待つ。**Vercel Hobby の function が 60 秒で殺されても Replicate のジョブはキャンセルされない**。ユーザーは 504 を見て再ボタン押下 → もう 1 ジョブ走る。

**再現シナリオ**:
- FLUX の混雑時、1 ジョブ 65 秒 → Vercel が 504 → **Replicate 側は完走 → $0.04 課金** → ユーザー再クリック → もう 1 回 $0.04 → **実質 2 倍課金で画像は 1 枚しか手に入らない**
- Preview デプロイ放置中に何らかの理由でリトライ嵐が起きたら $数十の事故

**損害試算**: 混雑時は 20〜30% が二重課金。月 200 枚生成で $8〜$12 の無駄

**修正**:
1. `maxDuration = 300` に上げる（Vercel Pro 契約時のみ有効、Hobby なら 60 が上限なので非同期化）
2. 即効策: `replicate.run()` を **45 秒の AbortController でラップ**、超えたら client には「timeout」を返し、**同一プロンプト+seed のキャッシュキーで 10 分 dedupe**
3. フロント側: 生成中のダブルクリック防止（button `disabled={loading}`、現状は `loading` guard あるが視覚的な明示が弱い）

```typescript
// flux.ts 冒頭
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 45_000);
try {
  const output = await replicate.run(..., { signal: controller.signal });
} finally { clearTimeout(timeout); }
```

---

### R-C3: 「Basic Auth 突破後の課金爆発」— 外部公開 URL に単一パスワード 1 本

**場所**: `middleware.ts`、Vercel Preview / Production

**現状**:
- パスワード比較が `u === user && p === pass` の **非定数時間比較（timing attack 余地）**
- `BASIC_AUTH_USER` だけ設定・`BASIC_AUTH_PASSWORD` 未設定 or 空文字 → **if ガードで素通しモード**に入る
- Basic Auth は HTTPS 前提で生パスワードが毎リクエスト飛ぶ。Preview URL（`*.vercel.app`）は検索エンジンにクロールされうる
- レート制限なし。Replicate は $0.04/枚、1 秒 5 並列で $12/分、1 時間で **$720**

**再現シナリオ**:
- 小池さんがスマホから共有したプレビュー URL が Slack 経由で漏れる → 総当たり（よくある辞書 5000 語）を 10 分放置 → 突破 → `/api/generate-image` を並列 cURL
- BASIC_AUTH_USER だけ設定忘れで素通し（開発時便利機能のため、本番事故として起きやすい）

**損害試算**: 最悪ケース 1 日 $数千、気付くまで 6〜24 時間で $2 万規模

**修正**（必須）:
1. **timing-safe 比較**を使う:
```typescript
import { timingSafeEqual } from 'crypto';
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
```
2. **環境変数未設定時のフェイルオープンを廃止**。本番では両方必須に。ローカル開発は `NODE_ENV==='development'` 時のみ許可:
```typescript
if (!user || !pass) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Auth misconfigured', { status: 503 });
  }
  return NextResponse.next();
}
```
3. **`/api/generate-image` に IP ベースの簡易レート制限**（Vercel KV or `@upstash/ratelimit` で 10 req/min/IP）
4. **Preview URL に `x-robots-tag: noindex` ヘッダ**、クロール防止
5. **Replicate 側で月額 usage cap を設定**（課金ダッシュボードの spending limit）

---

## 2. 重大リスク（失敗確率 10〜30%、損害中）

### R-H1: 「base64 直保存で Neon 無料枠が 2〜3 ヶ月で枯渇」

`prisma/schema.prisma` の `base64Image String?` は **1 枚あたり 100KB〜500KB**（1080×1080 JPEG 80%）。`html2canvas` の書き出しは原寸のため 300KB 平均。**Neon 無料枠 0.5GB = 1,700 行で満杯**、Phase B（3 サイズ展開）で 3 倍なので **570 枚で詰む**。

**修正**: `base64Image` は保存せず、**Vercel Blob または Cloudflare R2 に PUT し `imageUrl String?` だけ DB に持つ**。既存 row はマイグレーションで `null` にする（履歴表示で壊れないフォールバック実装）。Phase B 着手前が最後のチャンス。

---

### R-H2: 「PrismaClient が HMR で漏れる / Neon の接続プール 10 枯渇」

`src/app/api/save-banner/route.ts` の `let prisma: PrismaClient;` は **各リクエストで new** ではないが、**Next.js dev の HMR でモジュールが再評価されるたびに新インスタンス**が作られる。Neon 無料枠の接続数（pooler 経由で 10000 だが direct は 10）に突き当たる。

**修正**: `src/lib/prisma.ts` を作って `globalThis.__prisma` にキャッシュ、**全 route で import**:
```typescript
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```
Neon 接続 URL も pooler (`-pooler`) を使う。

---

### R-H3: 「FLUX 出力 URL の SSRF 余地」

`flux.ts` L74 `const res = await fetch(url);` は **Replicate が返した URL を無検証で fetch**。Replicate の CDN ドメイン (`replicate.delivery`) であることをチェックせず、将来的な API 仕様変化 / 中間者攻撃で **内部 URL（`http://169.254.169.254/` = AWS メタデータ）を踏める余地**。

**修正**:
```typescript
const parsed = new URL(url);
const allowed = ['replicate.delivery', 'pbxt.replicate.delivery'];
if (!allowed.some(d => parsed.hostname.endsWith(d)) || parsed.protocol !== 'https:') {
  throw new ImageProviderError('flux', `Untrusted image URL host: ${parsed.hostname}`);
}
```

---

## 3. 改善推奨（破綻リスクは低いが直した方が良い）

### R-M1: 「fallback 表示の UX バグ」
`Step3Editor.tsx` で `lastProviderUsed` と `lastFallback` の更新タイミングズレ（同一 render cycle）。切替直後は「imagen4 失敗 → imagen4 fallback」と誤表示。
→ バナー本文に `preferred !== lastProviderUsed` も条件に加える。

### R-M2: 「Imagen 4 の seed 無視を UI で誤認させない」
`imagen4.ts` は seed 非対応のためコメントで削除済みだが、フロント側に「seed 再現」UI 機能を将来足した場合に混乱。**ModelSelector の hint に「※ 再現性が必要な場合は FLUX」を明記**。Phase B のリサイズで「同 seed で 3 サイズ再生成」が Imagen 4 では効かない点、仕様書に警告を残す。

### R-M3: 「`npm run build` 時の Gemini API key 警告」
既存ルートが module-level で `new GoogleGenAI({ apiKey: '' })` している。**遅延初期化パターン**（`function getClient() { return (cached ??= new GoogleGenAI({ apiKey: ensureKey() })); }`）に揃える。ビルドログがノイジーで本番の本物の警告を見落とす。

---

## 4. 今すぐ直すべきこと（優先度順）

### 1. `middleware.ts` に timing-safe 比較 + 本番フェイルクローズ + レート制限導入

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

const PUBLIC_PATHS = ['/_next', '/favicon.ico'];  // /api/health は別途追加時に追加

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Auth misconfigured', { status: 503 });
    }
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [u, p] = Buffer.from(encoded, 'base64').toString().split(':');
    if (u && p && safeEq(u, user) && safeEq(p, pass)) return NextResponse.next();
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="banner-tsukurukun"' },
  });
}
```
加えて Replicate ダッシュボードで **月額 spending limit $30** を設定（Phase A 運用期間中の安全網）。

### 2. `generateWithFallback` を transient error だけに絞る

```typescript
// src/lib/image-providers/index.ts
function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|abort|5\d\d|rate.?limit|ECONN|ETIMEDOUT|ENOTFOUND/i.test(msg);
}

export async function generateWithFallback(preferred, params) {
  const order = preferred === 'imagen4' ? ['imagen4', 'flux'] : ['flux', 'imagen4'];
  let lastError: unknown = null;
  for (let i = 0; i < order.length; i++) {
    try {
      const result = await getProvider(order[i]).generate(params);
      if (i > 0) result.providerMetadata = { ...result.providerMetadata, fallback: true, preferredProvider: preferred };
      return result;
    } catch (err) {
      lastError = err;
      if (!isTransient(err)) throw err;  // fail-fast on permanent errors
    }
  }
  throw lastError;
}
```

### 3. `flux.ts` に AbortController + URL allowlist、`save-banner/route.ts` から PrismaClient 多重生成をシングルトン化

```typescript
// src/lib/image-providers/flux.ts（抜粋）
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 45_000);
try {
  const output = await replicate.run('black-forest-labs/flux-1.1-pro', { input, signal: controller.signal });
  // ... url 抽出 ...
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith('replicate.delivery') || parsed.protocol !== 'https:') {
    throw new ImageProviderError('flux', `Untrusted host: ${parsed.hostname}`);
  }
  const res = await fetch(url, { signal: controller.signal });
  // ...
} finally { clearTimeout(timer); }
```

```typescript
// src/lib/prisma.ts (新規)
import { PrismaClient } from '@prisma/client';
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
```
→ `src/app/api/save-banner/route.ts` で `import { prisma } from '@/lib/prisma'` に置換、`let prisma` を削除。

---

## 付記: Phase B 以降への警告

- **Phase B のスマートリサイズ**: 仕様書は「同 seed + 異 aspectRatio で構図維持」とあるが、**Imagen 4 は seed 非対応**。Imagen 4 選択時は「完全再生成される」旨の UI 警告を Phase B 着手時に必ず仕込む
- **Phase D のヒートマップ**: Replicate の追加モデルで FLUX のレート制限を共有する可能性 → **`predict-saliency` と `generate-image` は同じ Replicate account の queue に乗る**ため、ヒートマップ表示中の画像生成が遅延する観察点を A9 レビュー時に記録
- **base64 DB 保存は Phase B 着手の直前に Blob Storage へ移行**が最適タイミング（Phase B で 3 サイズ書き出し = ストレージ 3 倍になる前）

---

以上。
