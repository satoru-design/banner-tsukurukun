# STORES請求書決済 移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stripe凍結に伴い、autobanner.jp の課金を STORES請求書決済（月額・月次手動請求・ハードキャップ一本）へ移行する。

**Architecture:** 新規 `src/lib/billing/stores/` プロバイダを追加し、`PAYMENT_PROVIDER='stores'` で課金経路を切替える。月次請求は自前の `Invoice` 台帳で管理。支払い検知は STORES webhook(`webhookUrl`)で起動 →`GET /payments/{id}` で `status` を正本確認、ポーリングcronをバックストップに置く。超過従量課金は撤廃しハードキャップ化。Stripeコードは温存。

**Tech Stack:** Next.js 16 (App Router) / React 19 / Prisma 7 (Neon dev/prod) / Vitest 3 / zod 4 / TypeScript 5 / Vercel Cron

**確定済み STORES請求書決済 API（一次情報: Coiney-SDK/CoineyKit-Payge api.yaml）:**
- Base: `https://api.coiney.io/api/v1`、認証 `Authorization: Bearer sk_live_...`、`X-CoineyPayge-Version: 2016-10-25`
- `POST /payments`（作成）/ `GET /payments/{id}`（取得）/ `GET /payments`（一覧）/ `PATCH /payments/{id}`（更新）
- 作成必須: `amount`(min1), `currency:"jpy"`, `method:"creditcard"`。任意: `subject`,`description`,`metadata`(string値),`redirectUrl`,`cancelUrl`,`webhookUrl`(max255),`expiredOn`(date,既定3ヶ月),`locale`
- レスポンス: `id`,`object:"payment"`,`mode`,`amount`,`status`(**open|expired|paid|refunded|cancelled**),`paidAt`,`createdAt`,`links.paymentUrl`
- `metadata` に `userId`/`invoiceId` を格納し突合に使う。Idempotency-Keyヘッダーは非対応 → 自前 `Invoice` の一意制約で冪等化。

---

## 前提（実装開始前に人が確認）

- [ ] STORES管理画面 > STORES請求書決済 > 開発者用設定 から **test/live のAPIキー**を取得済みであること
- [ ] Vercel 環境変数（Preview/Production 個別）に下記を登録:
  - `PAYMENT_PROVIDER=stores`
  - `STORES_API_KEY=sk_live_...`（Preview には test キー）
  - `STORES_WEBHOOK_SECRET=<任意のランダム文字列>`（webhook受信URLのトークン検証に使用）
  - `STORES_AMOUNT_STARTER` / `STORES_AMOUNT_PRO` / `STORES_AMOUNT_BUSINESS`（各プランの月額・整数円。Stripeの現行価格に合わせる）
  - `STORES_INVOICE_DUE_DAYS=7`（入金期限・既定7日）/ `STORES_GRACE_DAYS=3`（猶予日数）
- [ ] `.env.example` にも上記キー（値は空）を追記すること（Task 1で実施）
- [ ] DBマイグレーションは dev ブランチ→確認→`scripts/migrate-prod.mjs` で本番、の順。本番DB直接操作禁止。

---

## ファイル構成

新規:
- `src/lib/billing/stores/stores-client.ts` — Coiney APIクライアント（createPayment/getPayment）
- `src/lib/billing/stores/amounts.ts` — プラン→月額（env由来）
- `src/lib/billing/stores/issue-invoice.ts` — Invoice発行（API作成＋台帳記録、冪等）
- `src/lib/billing/stores/activate.ts` — 支払い確定→プラン有効化/延長
- `src/lib/billing/stores/reconcile.ts` — STORES status→Invoice status マッピングと突合
- `src/lib/billing/stores/dunning.ts` — 督促＆猶予超過降格
- `src/app/api/billing/stores/checkout/route.ts` — 新規/更新アップグレード（invoice発行→paymentUrl返却）
- `src/app/api/billing/stores/webhook/route.ts` — STORES webhook受信→reconcile
- `src/app/api/cron/stores-poll/route.ts` — 未確定invoiceのポーリング突合
- `src/app/api/cron/stores-renew/route.ts` — 月次更新invoice発行＋督促＋降格

改修:
- `prisma/schema.prisma` — `Invoice` モデル追加、`User.storesCustomerId`/`User.invoices` 追加
- `src/lib/plans/limits.ts` — メータード前提の上限をハードキャップ化（コメント整理）
- `src/app/api/ironclad-generate/route.ts` — `sendMeteredUsage()` 呼び出しを provider 分岐で停止
- `vercel.json` — `stores-poll`/`stores-renew` cron 追加
- `.env.example` — STORES_* 追記

温存（変更しない）: 既存 `stripe*` / `payjp*` コード・カラム、`OverageCharge`（新規書込みのみ停止）

---

## Phase 1: 基盤（スキーマ＋APIクライアント）

### Task 1: 環境変数サンプルと Invoice スキーマ

**Files:**
- Modify: `.env.example`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `.env.example` に STORES 設定を追記**

`.env.example` の末尾に追記:

```dotenv
# --- STORES請求書決済 (Coiney) ---
PAYMENT_PROVIDER=stripe            # stripe | payjp | stores
STORES_API_KEY=
STORES_WEBHOOK_SECRET=
STORES_AMOUNT_STARTER=
STORES_AMOUNT_PRO=
STORES_AMOUNT_BUSINESS=
STORES_INVOICE_DUE_DAYS=7
STORES_GRACE_DAYS=3
```

- [ ] **Step 2: `prisma/schema.prisma` に Invoice モデルと User リレーションを追加**

`User` モデル内（既存 `stripeCustomerId` 付近）に追記:

```prisma
  storesCustomerId String?
  invoices         Invoice[]
```

スキーマ末尾にモデル追加:

```prisma
model Invoice {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  plan            String
  amount          Int
  periodStart     DateTime
  periodEnd       DateTime
  storesPaymentId String?   @unique
  paymentUrl      String?
  status          String    @default("issued") // issued | paid | overdue | canceled
  dueDate         DateTime
  issuedAt        DateTime  @default(now())
  paidAt          DateTime?

  @@unique([userId, periodStart])
  @@index([status])
}
```

- [ ] **Step 3: dev ブランチへマイグレーション生成・適用**

Run: `npx prisma migrate dev --name add_stores_invoice`
Expected: マイグレーション作成成功、`Invoice` テーブルが dev Neon ブランチに作成される。`npx prisma generate` も自動実行。

- [ ] **Step 4: Commit**

```bash
git add .env.example prisma/schema.prisma prisma/migrations
git commit -m "feat(billing): add STORES Invoice schema and env scaffolding"
```

---

### Task 2: STORES APIクライアント

**Files:**
- Create: `src/lib/billing/stores/stores-client.ts`
- Test: `src/lib/billing/stores/stores-client.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/billing/stores/stores-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPayment, getPayment } from "./stores-client";

const OK = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

const sample = {
  id: "pay_123",
  object: "payment",
  mode: "test",
  amount: 1000,
  currency: "jpy",
  status: "open",
  createdAt: "2026-06-22T00:00:00Z",
  links: { paymentUrl: "https://payge.coiney.io/pay/pay_123" },
};

beforeEach(() => {
  process.env.STORES_API_KEY = "sk_test_dummy";
});
afterEach(() => vi.restoreAllMocks());

describe("createPayment", () => {
  it("posts to /payments with auth headers and returns parsed payment", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(OK(sample));
    const p = await createPayment({ amount: 1000, subject: "Pro 月額", metadata: { userId: "u1" } });
    expect(p.links.paymentUrl).toBe("https://payge.coiney.io/pay/pay_123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.coiney.io/api/v1/payments");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_dummy");
    expect((init!.headers as Record<string, string>)["X-CoineyPayge-Version"]).toBe("2016-10-25");
    const sent = JSON.parse(init!.body as string);
    expect(sent).toMatchObject({ amount: 1000, currency: "jpy", method: "creditcard" });
  });

  it("throws when API returns non-2xx", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 400, text: async () => "bad" } as Response);
    await expect(createPayment({ amount: 1, subject: "x" })).rejects.toThrow(/400/);
  });
});

describe("getPayment", () => {
  it("GETs /payments/{id} and returns parsed payment", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(OK({ ...sample, status: "paid", paidAt: "2026-06-22T01:00:00Z" }));
    const p = await getPayment("pay_123");
    expect(p.status).toBe("paid");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/billing/stores/stores-client.test.ts`
Expected: FAIL（`stores-client` が存在しない）

- [ ] **Step 3: 最小実装**

`src/lib/billing/stores/stores-client.ts`:

```ts
import { z } from "zod";

const BASE_URL = "https://api.coiney.io/api/v1";
const API_VERSION = "2016-10-25";

export interface CreatePaymentParams {
  amount: number;
  subject: string;
  description?: string;
  metadata?: Record<string, string>;
  redirectUrl?: string;
  cancelUrl?: string;
  webhookUrl?: string;
  expiredOn?: string; // YYYY-MM-DD
}

const PaymentSchema = z.object({
  id: z.string(),
  object: z.literal("payment"),
  mode: z.enum(["live", "test"]),
  amount: z.number(),
  currency: z.literal("jpy"),
  status: z.enum(["open", "expired", "paid", "refunded", "cancelled"]),
  paidAt: z.string().nullish(),
  createdAt: z.string(),
  links: z.object({
    paymentUrl: z.string(),
    redirectUrl: z.string().optional(),
    cancelUrl: z.string().optional(),
    webhookUrl: z.string().optional(),
  }),
});

export type StoresPayment = z.infer<typeof PaymentSchema>;
export type StoresStatus = StoresPayment["status"];

function authHeaders(): Record<string, string> {
  const key = process.env.STORES_API_KEY;
  if (!key) throw new Error("STORES_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "X-CoineyPayge-Version": API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function createPayment(p: CreatePaymentParams): Promise<StoresPayment> {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      amount: p.amount,
      currency: "jpy",
      method: "creditcard",
      locale: "ja_JP",
      subject: p.subject,
      description: p.description,
      metadata: p.metadata,
      redirectUrl: p.redirectUrl,
      cancelUrl: p.cancelUrl,
      webhookUrl: p.webhookUrl,
      expiredOn: p.expiredOn,
    }),
  });
  if (!res.ok) {
    throw new Error(`STORES createPayment failed: ${res.status} ${await res.text()}`);
  }
  return PaymentSchema.parse(await res.json());
}

export async function getPayment(id: string): Promise<StoresPayment> {
  const res = await fetch(`${BASE_URL}/payments/${id}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`STORES getPayment failed: ${res.status} ${await res.text()}`);
  }
  return PaymentSchema.parse(await res.json());
}
```

- [ ] **Step 4: テスト合格を確認**

Run: `npx vitest run src/lib/billing/stores/stores-client.test.ts`
Expected: PASS（3件）

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/stores/stores-client.ts src/lib/billing/stores/stores-client.test.ts
git commit -m "feat(billing): add STORES (Coiney) API client"
```

---

## Phase 2: 請求書発行サービス

### Task 3: プラン→月額リゾルバ（env由来）

**Files:**
- Create: `src/lib/billing/stores/amounts.ts`
- Test: `src/lib/billing/stores/amounts.test.ts`

- [ ] **Step 1: 失敗するテスト**

`src/lib/billing/stores/amounts.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { monthlyAmount, type PaidPlan } from "./amounts";

beforeEach(() => {
  process.env.STORES_AMOUNT_STARTER = "2980";
  process.env.STORES_AMOUNT_PRO = "9800";
  process.env.STORES_AMOUNT_BUSINESS = "29800";
});

describe("monthlyAmount", () => {
  it("returns the env-configured amount for each paid plan", () => {
    expect(monthlyAmount("starter")).toBe(2980);
    expect(monthlyAmount("pro")).toBe(9800);
    expect(monthlyAmount("business")).toBe(29800);
  });

  it("throws when the env var is missing or non-numeric", () => {
    delete process.env.STORES_AMOUNT_PRO;
    expect(() => monthlyAmount("pro")).toThrow(/STORES_AMOUNT_PRO/);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/billing/stores/amounts.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/lib/billing/stores/amounts.ts`:

```ts
export type PaidPlan = "starter" | "pro" | "business";

const ENV_KEY: Record<PaidPlan, string> = {
  starter: "STORES_AMOUNT_STARTER",
  pro: "STORES_AMOUNT_PRO",
  business: "STORES_AMOUNT_BUSINESS",
};

export function monthlyAmount(plan: PaidPlan): number {
  const key = ENV_KEY[plan];
  const raw = process.env[key];
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1) {
    throw new Error(`${key} is not set to a valid positive integer (got: ${raw})`);
  }
  return n;
}
```

- [ ] **Step 4: 合格確認**

Run: `npx vitest run src/lib/billing/stores/amounts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/stores/amounts.ts src/lib/billing/stores/amounts.test.ts
git commit -m "feat(billing): add env-driven STORES plan amount resolver"
```

---

### Task 4: Invoice発行（冪等）

**Files:**
- Create: `src/lib/billing/stores/issue-invoice.ts`
- Test: `src/lib/billing/stores/issue-invoice.test.ts`

発行ロジック: 対象 `(userId, periodStart)` の Invoice が既にあれば再利用（二重請求防止）。無ければ STORES `createPayment` を呼び、`Invoice` を `issued` で作成。`metadata` に `userId`/`invoiceId` を格納。`periodStart` は当月初、`periodEnd` は翌月初、`dueDate` は `issuedAt + STORES_INVOICE_DUE_DAYS`。

- [ ] **Step 1: 失敗するテスト**

`src/lib/billing/stores/issue-invoice.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = {
  invoice: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma }));
const createPayment = vi.fn();
vi.mock("./stores-client", () => ({ createPayment: (...a: unknown[]) => createPayment(...a) }));

import { issueInvoice } from "./issue-invoice";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STORES_AMOUNT_PRO = "9800";
  process.env.STORES_INVOICE_DUE_DAYS = "7";
  process.env.NEXT_PUBLIC_APP_URL = "https://autobanner.jp";
});

const periodStart = new Date("2026-07-01T00:00:00Z");

it("returns the existing invoice without calling STORES when one exists for the period", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_1", paymentUrl: "u", status: "issued" });
  const r = await issueInvoice({ userId: "u1", plan: "pro", periodStart });
  expect(r.id).toBe("inv_1");
  expect(createPayment).not.toHaveBeenCalled();
});

it("creates a STORES payment and persists an issued invoice when none exists", async () => {
  prisma.invoice.findUnique.mockResolvedValue(null);
  prisma.invoice.create.mockResolvedValue({ id: "inv_new" });
  prisma.invoice.update.mockResolvedValue({ id: "inv_new", paymentUrl: "https://pay/x", storesPaymentId: "pay_x" });
  createPayment.mockResolvedValue({ id: "pay_x", links: { paymentUrl: "https://pay/x" }, status: "open" });

  const r = await issueInvoice({ userId: "u1", plan: "pro", periodStart });

  expect(createPayment).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 9800, metadata: expect.objectContaining({ userId: "u1", invoiceId: "inv_new" }) }),
  );
  expect(r.paymentUrl).toBe("https://pay/x");
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/billing/stores/issue-invoice.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/lib/billing/stores/issue-invoice.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { createPayment } from "./stores-client";
import { monthlyAmount, type PaidPlan } from "./amounts";

const PLAN_LABEL: Record<PaidPlan, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export interface IssueInvoiceParams {
  userId: string;
  plan: PaidPlan;
  periodStart: Date; // 当月初 (UTC)
}

export async function issueInvoice({ userId, plan, periodStart }: IssueInvoiceParams) {
  const existing = await prisma.invoice.findUnique({
    where: { userId_periodStart: { userId, periodStart } },
  });
  if (existing) return existing;

  const amount = monthlyAmount(plan);
  const periodEnd = addMonths(periodStart, 1);
  const dueDays = Number(process.env.STORES_INVOICE_DUE_DAYS ?? "7");
  const now = new Date();
  const dueDate = addDays(now, dueDays);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // 先に台帳行を作って invoiceId を確定 → metadata に載せる
  const invoice = await prisma.invoice.create({
    data: { userId, plan, amount, periodStart, periodEnd, status: "issued", dueDate, issuedAt: now },
  });

  const payment = await createPayment({
    amount,
    subject: `autobanner.jp ${PLAN_LABEL[plan]} 月額`,
    description: `invoice=${invoice.id} period=${periodStart.toISOString().slice(0, 10)}`,
    metadata: { userId, invoiceId: invoice.id },
    redirectUrl: `${appUrl}/account/billing?paid=1`,
    cancelUrl: `${appUrl}/account/billing?canceled=1`,
    webhookUrl: `${appUrl}/api/billing/stores/webhook?token=${process.env.STORES_WEBHOOK_SECRET ?? ""}`,
  });

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { storesPaymentId: payment.id, paymentUrl: payment.links.paymentUrl },
  });
}
```

- [ ] **Step 4: 合格確認**

Run: `npx vitest run src/lib/billing/stores/issue-invoice.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/stores/issue-invoice.ts src/lib/billing/stores/issue-invoice.test.ts
git commit -m "feat(billing): add idempotent STORES invoice issuance"
```

---

## Phase 3: 支払い検知とプラン有効化

### Task 5: status マッピングとプラン有効化

**Files:**
- Create: `src/lib/billing/stores/reconcile.ts`
- Test: `src/lib/billing/stores/reconcile.test.ts`

突合ロジック: `Invoice.storesPaymentId` で `GET /payments/{id}` し、STORES status をマップ。`paid`→Invoice `paid`＋ユーザーの `plan` 設定・`planExpiresAt = max(now, 既存) + 1ヶ月`。`expired`/`cancelled`→Invoice `overdue`（降格は dunning が判定）。冪等: 既に `paid` の Invoice は再処理しない。

- [ ] **Step 1: 失敗するテスト**

`src/lib/billing/stores/reconcile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = {
  invoice: { findUnique: vi.fn(), update: vi.fn() },
  user: { update: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
};
vi.mock("@/lib/prisma", () => ({ prisma }));
const getPayment = vi.fn();
vi.mock("./stores-client", () => ({ getPayment: (...a: unknown[]) => getPayment(...a) }));

import { reconcileInvoice } from "./reconcile";

beforeEach(() => vi.clearAllMocks());

it("activates the plan and marks invoice paid when STORES reports paid", async () => {
  prisma.invoice.findUnique.mockResolvedValue({
    id: "inv_1", userId: "u1", plan: "pro", status: "issued",
    storesPaymentId: "pay_1", periodStart: new Date("2026-07-01T00:00:00Z"),
  });
  getPayment.mockResolvedValue({ id: "pay_1", status: "paid", paidAt: "2026-07-02T00:00:00Z" });

  const r = await reconcileInvoice("inv_1");

  expect(r.status).toBe("paid");
  expect(prisma.user.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ plan: "pro" }) }),
  );
});

it("is idempotent: already-paid invoice does not re-activate", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_1", status: "paid", storesPaymentId: "pay_1" });
  const r = await reconcileInvoice("inv_1");
  expect(getPayment).not.toHaveBeenCalled();
  expect(prisma.user.update).not.toHaveBeenCalled();
  expect(r.status).toBe("paid");
});

it("marks invoice overdue when STORES reports expired", async () => {
  prisma.invoice.findUnique.mockResolvedValue({ id: "inv_1", userId: "u1", plan: "pro", status: "issued", storesPaymentId: "pay_1" });
  getPayment.mockResolvedValue({ id: "pay_1", status: "expired" });
  const r = await reconcileInvoice("inv_1");
  expect(r.status).toBe("overdue");
  expect(prisma.user.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/billing/stores/reconcile.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/lib/billing/stores/reconcile.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { getPayment, type StoresStatus } from "./stores-client";

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

const TERMINAL = new Set(["paid", "canceled"]);

export async function reconcileInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error(`invoice not found: ${invoiceId}`);
  if (TERMINAL.has(invoice.status)) return invoice; // 冪等
  if (!invoice.storesPaymentId) return invoice;

  const payment = await getPayment(invoice.storesPaymentId);
  const s: StoresStatus = payment.status;

  if (s === "paid") {
    const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: invoice.userId } });
      const base = user?.planExpiresAt && user.planExpiresAt > new Date() ? user.planExpiresAt : new Date();
      await tx.user.update({
        where: { id: invoice.userId },
        data: { plan: invoice.plan, planStartedAt: new Date(), planExpiresAt: addMonths(base, 1) },
      });
      return tx.invoice.update({ where: { id: invoice.id }, data: { status: "paid", paidAt } });
    });
  }

  if (s === "expired" || s === "cancelled") {
    return prisma.invoice.update({ where: { id: invoice.id }, data: { status: "overdue" } });
  }

  return invoice; // open / refunded は変更なし
}
```

- [ ] **Step 4: 合格確認**

Run: `npx vitest run src/lib/billing/stores/reconcile.test.ts`
Expected: PASS（3件）

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/stores/reconcile.ts src/lib/billing/stores/reconcile.test.ts
git commit -m "feat(billing): add STORES status reconcile + plan activation"
```

---

### Task 6: Webhook受信エンドポイント

**Files:**
- Create: `src/app/api/billing/stores/webhook/route.ts`
- Test: `src/app/api/billing/stores/webhook/route.test.ts`

STORES webhook の本文スキーマは非公開のため、本文は信用せず **`?token=` で `STORES_WEBHOOK_SECRET` を検証 → `reconcile` で `GET /payments/{id}` を正本確認**する。payment_id は本文 `id` かクエリから拾えれば使い、無ければ未確定invoiceを reconcile する保険を持つ。

- [ ] **Step 1: 失敗するテスト**

`src/app/api/billing/stores/webhook/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { invoice: { findFirst: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma }));
const reconcileInvoice = vi.fn();
vi.mock("@/lib/billing/stores/reconcile", () => ({ reconcileInvoice: (...a: unknown[]) => reconcileInvoice(...a) }));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STORES_WEBHOOK_SECRET = "secret123";
});

function req(url: string, body: unknown) {
  return new Request(url, { method: "POST", body: JSON.stringify(body) });
}

it("rejects when token is missing or wrong", async () => {
  const res = await POST(req("https://x/api/billing/stores/webhook?token=wrong", {}));
  expect(res.status).toBe(401);
  expect(reconcileInvoice).not.toHaveBeenCalled();
});

it("reconciles the invoice referenced by the payment id", async () => {
  prisma.invoice.findFirst.mockResolvedValue({ id: "inv_1" });
  reconcileInvoice.mockResolvedValue({ id: "inv_1", status: "paid" });
  const res = await POST(req("https://x/api/billing/stores/webhook?token=secret123", { id: "pay_1" }));
  expect(res.status).toBe(200);
  expect(reconcileInvoice).toHaveBeenCalledWith("inv_1");
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/app/api/billing/stores/webhook/route.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/app/api/billing/stores/webhook/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcileInvoice } from "@/lib/billing/stores/reconcile";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || token !== process.env.STORES_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let paymentId: string | undefined;
  try {
    const body = (await req.json()) as { id?: string };
    paymentId = body?.id;
  } catch {
    /* 本文は信用しないので無視 */
  }

  if (paymentId) {
    const invoice = await prisma.invoice.findFirst({ where: { storesPaymentId: paymentId } });
    if (invoice) await reconcileInvoice(invoice.id);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: 合格確認**

Run: `npx vitest run src/app/api/billing/stores/webhook/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/billing/stores/webhook
git commit -m "feat(billing): add STORES webhook receiver (token-verified, reconcile-by-truth)"
```

---

### Task 7: ポーリングcron（バックストップ）

**Files:**
- Create: `src/app/api/cron/stores-poll/route.ts`
- Test: `src/app/api/cron/stores-poll/route.test.ts`
- Modify: `vercel.json`

未確定（`issued`）かつ `storesPaymentId` を持つ Invoice を `reconcile`。CRON_SECRET 認証。

- [ ] **Step 1: 失敗するテスト**

`src/app/api/cron/stores-poll/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { invoice: { findMany: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma }));
const reconcileInvoice = vi.fn();
vi.mock("@/lib/billing/stores/reconcile", () => ({ reconcileInvoice: (...a: unknown[]) => reconcileInvoice(...a) }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cronsecret";
});

const auth = { headers: { authorization: "Bearer cronsecret" } } as unknown as Request;

it("401 without valid cron secret", async () => {
  const res = await GET({ headers: { authorization: "Bearer nope" } } as unknown as Request);
  expect(res.status).toBe(401);
});

it("reconciles each pending invoice", async () => {
  prisma.invoice.findMany.mockResolvedValue([{ id: "inv_1" }, { id: "inv_2" }]);
  reconcileInvoice.mockResolvedValue({});
  const res = await GET(auth);
  expect(res.status).toBe(200);
  expect(reconcileInvoice).toHaveBeenCalledTimes(2);
});
```

> NOTE: テストは `req.headers.authorization` を読む実装に合わせる。Next の `Request` は `req.headers.get(...)` だが、ここではテスト容易性のため `headers.get` を使い、テストでは `new Headers({...})` を渡す形へ Step 3 で整合させる。

- [ ] **Step 2: テストを実装に整合（Headersを使う）**

テストの `auth`/`GET(...)` 呼び出しを次に差し替え:

```ts
const auth = new Request("https://x/api/cron/stores-poll", { headers: new Headers({ authorization: "Bearer cronsecret" }) });
// 401ケース:
const res = await GET(new Request("https://x", { headers: new Headers({ authorization: "Bearer nope" }) }));
```

- [ ] **Step 3: 失敗確認**

Run: `npx vitest run src/app/api/cron/stores-poll/route.test.ts`
Expected: FAIL

- [ ] **Step 4: 実装**

`src/app/api/cron/stores-poll/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcileInvoice } from "@/lib/billing/stores/reconcile";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const pending = await prisma.invoice.findMany({
    where: { status: "issued", storesPaymentId: { not: null } },
    select: { id: true },
    take: 200,
  });
  let reconciled = 0;
  for (const inv of pending) {
    try {
      await reconcileInvoice(inv.id);
      reconciled++;
    } catch (e) {
      console.error(`stores-poll reconcile failed for ${inv.id}`, e);
    }
  }
  return NextResponse.json({ ok: true, checked: pending.length, reconciled });
}
```

- [ ] **Step 5: 合格確認**

Run: `npx vitest run src/app/api/cron/stores-poll/route.test.ts`
Expected: PASS

- [ ] **Step 6: vercel.json に cron 追加**

`vercel.json` の `crons` 配列に追記（15分毎）:

```json
{ "path": "/api/cron/stores-poll", "schedule": "*/15 * * * *" }
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/stores-poll vercel.json
git commit -m "feat(billing): add STORES polling cron backstop"
```

---

## Phase 4: アップグレード導線

### Task 8: アップグレード（invoice発行→paymentUrl返却）API

**Files:**
- Create: `src/app/api/billing/stores/checkout/route.ts`
- Test: `src/app/api/billing/stores/checkout/route.test.ts`

ログインユーザーの当月 invoice を発行し `paymentUrl` を返す。認証は既存のセッション取得関数に合わせる（実装時に `src/app/api/billing/checkout-session/route.ts` のセッション取得方法をそのまま流用）。

- [ ] **Step 1: 既存checkoutのセッション取得を確認**

Run: `npx grep -n "auth\|getServerSession\|session" src/app/api/billing/checkout-session/route.ts`（または Read）
目的: ユーザー特定の方法（`auth()` か `getServerSession` か）を確認し、本ルートで同じ手段を使う。

- [ ] **Step 2: 失敗するテスト**

`src/app/api/billing/stores/checkout/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const issueInvoice = vi.fn();
vi.mock("@/lib/billing/stores/issue-invoice", () => ({ issueInvoice: (...a: unknown[]) => issueInvoice(...a) }));
const getUserId = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserId: () => getUserId() }));

import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

function req(body: unknown) {
  return new Request("https://x/api/billing/stores/checkout", { method: "POST", body: JSON.stringify(body) });
}

it("401 when not authenticated", async () => {
  getUserId.mockResolvedValue(null);
  const res = await POST(req({ plan: "pro" }));
  expect(res.status).toBe(401);
});

it("400 on invalid plan", async () => {
  getUserId.mockResolvedValue("u1");
  const res = await POST(req({ plan: "free" }));
  expect(res.status).toBe(400);
});

it("returns paymentUrl for a valid upgrade", async () => {
  getUserId.mockResolvedValue("u1");
  issueInvoice.mockResolvedValue({ id: "inv_1", paymentUrl: "https://pay/x" });
  const res = await POST(req({ plan: "pro" }));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ paymentUrl: "https://pay/x" });
});
```

> NOTE: `@/lib/auth/current-user` の `getCurrentUserId` は Step 1 で確認した実セッション取得をラップする薄い関数。存在しなければ本タスクで作成（中身は既存checkoutと同じ取得方法）。

- [ ] **Step 3: 失敗確認**

Run: `npx vitest run src/app/api/billing/stores/checkout/route.test.ts`
Expected: FAIL

- [ ] **Step 4: 実装**

必要なら `src/lib/auth/current-user.ts`（既存セッション取得をラップ）を作成。続いて:

`src/app/api/billing/stores/checkout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { issueInvoice } from "@/lib/billing/stores/issue-invoice";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { PaidPlan } from "@/lib/billing/stores/amounts";

export const dynamic = "force-dynamic";

const PAID: PaidPlan[] = ["starter", "pro", "business"];

function monthStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { plan } = (await req.json()) as { plan?: string };
  if (!plan || !PAID.includes(plan as PaidPlan)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const invoice = await issueInvoice({
    userId,
    plan: plan as PaidPlan,
    periodStart: monthStartUTC(new Date()),
  });

  return NextResponse.json({ invoiceId: invoice.id, paymentUrl: invoice.paymentUrl });
}
```

- [ ] **Step 5: 合格確認**

Run: `npx vitest run src/app/api/billing/stores/checkout/route.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/billing/stores src/lib/auth/current-user.ts
git commit -m "feat(billing): add STORES upgrade checkout route"
```

---

### Task 9: 課金プロバイダ分岐（フロント導線）

**Files:**
- Modify: 既存アップグレードボタンのコンポーネント（実装時に `CheckoutButton` 等を grep で特定）
- Test: 該当コンポーネントのテスト（あれば）

`PAYMENT_PROVIDER==='stores'` のとき、Stripe Checkout ではなく `/api/billing/stores/checkout` を呼び、返ってきた `paymentUrl` へ `window.location.assign` する分岐を追加。

- [ ] **Step 1: アップグレードボタン特定**

Run: `npx grep -rn "checkout-session\|CheckoutButton\|アップグレード" src/components src/app`（または Grep ツール）

- [ ] **Step 2: 分岐を追加（最小差分）**

クリックハンドラに provider 分岐を追加（`NEXT_PUBLIC_PAYMENT_PROVIDER` を参照。無ければ Step 3 で env 追加）:

```ts
const provider = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER ?? "stripe";
if (provider === "stores") {
  const res = await fetch("/api/billing/stores/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const { paymentUrl } = await res.json();
  if (paymentUrl) window.location.assign(paymentUrl);
  return;
}
// 既存 Stripe 経路はそのまま
```

- [ ] **Step 3: `NEXT_PUBLIC_PAYMENT_PROVIDER` を `.env.example` と Vercel に追加**

`.env.example` に `NEXT_PUBLIC_PAYMENT_PROVIDER=stripe` を追記。

- [ ] **Step 4: 手動確認（dev）**

Run: `npm run dev` → アカウント/料金ページでアップグレード押下 → STORES決済画面URLへ遷移することを確認（test キー）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(billing): route upgrade button to STORES when provider=stores"
```

---

## Phase 5: 月次更新・督促・降格

### Task 10: 督促＆降格ロジック

**Files:**
- Create: `src/lib/billing/stores/dunning.ts`
- Test: `src/lib/billing/stores/dunning.test.ts`

`overdue` または `dueDate` 超過の `issued` invoice を対象に、`dueDate + STORES_GRACE_DAYS` を過ぎたユーザーを `plan='free'` に降格。降格対象を返す（通知は呼び出し側 cron が担当）。

- [ ] **Step 1: 失敗するテスト**

`src/lib/billing/stores/dunning.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { invoice: { findMany: vi.fn(), update: vi.fn() }, user: { update: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma }));

import { sweepOverdue } from "./dunning";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STORES_GRACE_DAYS = "3";
});

it("downgrades users whose unpaid invoice passed due + grace", async () => {
  const old = new Date(Date.now() - 10 * 86400_000);
  prisma.invoice.findMany.mockResolvedValue([
    { id: "inv_1", userId: "u1", status: "issued", dueDate: old },
  ]);
  const r = await sweepOverdue(new Date());
  expect(prisma.user.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "u1" }, data: { plan: "free" } }),
  );
  expect(prisma.invoice.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "inv_1" }, data: { status: "overdue" } }),
  );
  expect(r.downgraded).toContain("u1");
});

it("does not downgrade within the grace window", async () => {
  const recent = new Date(Date.now() - 1 * 86400_000);
  prisma.invoice.findMany.mockResolvedValue([{ id: "inv_2", userId: "u2", status: "issued", dueDate: recent }]);
  const r = await sweepOverdue(new Date());
  expect(prisma.user.update).not.toHaveBeenCalled();
  expect(r.downgraded).toHaveLength(0);
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/billing/stores/dunning.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/lib/billing/stores/dunning.ts`:

```ts
import { prisma } from "@/lib/prisma";

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export async function sweepOverdue(now: Date) {
  const grace = Number(process.env.STORES_GRACE_DAYS ?? "3");
  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ["issued", "overdue"] } },
    select: { id: true, userId: true, dueDate: true, status: true },
  });

  const downgraded: string[] = [];
  for (const inv of candidates) {
    const deadline = addDays(new Date(inv.dueDate), grace);
    if (now > deadline) {
      await prisma.user.update({ where: { id: inv.userId }, data: { plan: "free" } });
      if (inv.status !== "overdue") {
        await prisma.invoice.update({ where: { id: inv.id }, data: { status: "overdue" } });
      }
      downgraded.push(inv.userId);
    }
  }
  return { downgraded };
}
```

- [ ] **Step 4: 合格確認**

Run: `npx vitest run src/lib/billing/stores/dunning.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/stores/dunning.ts src/lib/billing/stores/dunning.test.ts
git commit -m "feat(billing): add STORES dunning + downgrade sweep"
```

---

### Task 11: 月次更新cron（発行＋督促＋降格＋Slack通知）

**Files:**
- Create: `src/app/api/cron/stores-renew/route.ts`
- Test: `src/app/api/cron/stores-renew/route.test.ts`
- Modify: `vercel.json`

毎日実行: `planExpiresAt` が `now+3日` 以内の有料ユーザーへ翌月分 invoice を発行（冪等）＋ `sweepOverdue` 実行。Slack通知は既存の通知ユーティリティを流用（実装時に `src/lib/**` の Slack 送信関数を grep で特定）。CRON_SECRET 認証。

- [ ] **Step 1: 失敗するテスト**

`src/app/api/cron/stores-renew/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { user: { findMany: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma }));
const issueInvoice = vi.fn();
vi.mock("@/lib/billing/stores/issue-invoice", () => ({ issueInvoice: (...a: unknown[]) => issueInvoice(...a) }));
const sweepOverdue = vi.fn();
vi.mock("@/lib/billing/stores/dunning", () => ({ sweepOverdue: (...a: unknown[]) => sweepOverdue(...a) }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cronsecret";
});
const ok = () => new Request("https://x", { headers: new Headers({ authorization: "Bearer cronsecret" }) });

it("401 without cron secret", async () => {
  const res = await GET(new Request("https://x", { headers: new Headers({ authorization: "Bearer nope" }) }));
  expect(res.status).toBe(401);
});

it("issues next-month invoices for expiring paid users and runs the overdue sweep", async () => {
  prisma.user.findMany.mockResolvedValue([{ id: "u1", plan: "pro" }]);
  issueInvoice.mockResolvedValue({ id: "inv_x" });
  sweepOverdue.mockResolvedValue({ downgraded: [] });
  const res = await GET(ok());
  expect(res.status).toBe(200);
  expect(issueInvoice).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", plan: "pro" }));
  expect(sweepOverdue).toHaveBeenCalled();
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/app/api/cron/stores-renew/route.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/app/api/cron/stores-renew/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueInvoice } from "@/lib/billing/stores/issue-invoice";
import { sweepOverdue } from "@/lib/billing/stores/dunning";
import type { PaidPlan } from "@/lib/billing/stores/amounts";

export const dynamic = "force-dynamic";

function nextMonthStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 86400_000);

  const expiring = await prisma.user.findMany({
    where: { plan: { in: ["starter", "pro", "business"] }, planExpiresAt: { lte: soon } },
    select: { id: true, plan: true },
  });

  let issued = 0;
  for (const u of expiring) {
    try {
      await issueInvoice({ userId: u.id, plan: u.plan as PaidPlan, periodStart: nextMonthStartUTC(now) });
      issued++;
    } catch (e) {
      console.error(`stores-renew issue failed for ${u.id}`, e);
    }
  }

  const sweep = await sweepOverdue(now);
  return NextResponse.json({ ok: true, issued, downgraded: sweep.downgraded.length });
}
```

- [ ] **Step 4: 合格確認**

Run: `npx vitest run src/app/api/cron/stores-renew/route.test.ts`
Expected: PASS

- [ ] **Step 5: vercel.json に cron 追加（毎日 09:00 JST = 00:00 UTC）**

```json
{ "path": "/api/cron/stores-renew", "schedule": "0 0 * * *" }
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/stores-renew vercel.json
git commit -m "feat(billing): add STORES monthly renewal + dunning cron"
```

---

## Phase 6: ハードキャップ移行（メータード撤廃）

### Task 12: 生成APIのメータード送信を provider で停止

**Files:**
- Modify: `src/app/api/ironclad-generate/route.ts:261-281`（Pro/Business メータード送信）
- Test: 既存 `ironclad-generate` のテスト or 新規

ハードキャップ自体は既存（`USAGE_HARDCAP_*`）が機能している。本タスクは **`PAYMENT_PROVIDER==='stores'` のときメータード送信(`sendMeteredUsage`)をスキップ**し、上限到達は既存の 429 ＋誘導に委ねる。

- [ ] **Step 1: 該当箇所を Read で確認**

Read: `src/app/api/ironclad-generate/route.ts:255-285`

- [ ] **Step 2: provider ガードを追加**

`sendMeteredUsage(...)` を呼ぶ箇所を次でラップ:

```ts
if ((process.env.PAYMENT_PROVIDER ?? "stripe") !== "stores") {
  // 既存のメータード送信（Pro: ¥80超過、Business: ¥40超過）
  await sendMeteredUsage(/* 既存引数そのまま */);
}
```

- [ ] **Step 3: ハードキャップ境界テスト（新規）**

`src/app/api/ironclad-generate/metered-guard.test.ts`（軽量・`sendMeteredUsage` がモックされ provider=stores で呼ばれないこと）:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
// 既存ルートのテストパターンに合わせ、sendMeteredUsage を spy して
// PAYMENT_PROVIDER=stores のとき呼ばれないことを検証する。
// （ルートの import 構造は実装時に既存テストへ準拠）
it.todo("does not send metered usage when provider is stores");
```

> 既存ルートが大きい場合、`sendMeteredUsage` を別関数へ薄く切り出してからガードを当て、その関数単体をテストする方が安全。実装時に判断。

- [ ] **Step 4: 全テスト実行**

Run: `npx vitest run`
Expected: 既存緑＋新規緑（または `.todo` がskip）

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ironclad-generate
git commit -m "feat(billing): disable metered overage when provider=stores (hard-cap only)"
```

---

### Task 13: 料金表示・上限到達UIの文言整備

**Files:**
- Modify: 料金/アカウント画面（実装時に特定）、`src/components/account/ProOverageDisplay.tsx`

`provider=stores` のとき「超過課金」表記を出さず、上限到達時は「上位プランへ」の誘導のみ表示。

- [ ] **Step 1: 超過表示コンポーネントの参照箇所を Grep**

Run: Grep `ProOverageDisplay|超過|メータード|従量`

- [ ] **Step 2: provider ガードで超過表示を抑止**

`ProOverageDisplay` 等の描画を `NEXT_PUBLIC_PAYMENT_PROVIDER==='stores'` のとき非表示にする。

- [ ] **Step 3: 手動確認（dev）**

Run: `npm run dev` → Pro相当の状態で超過表記が出ないこと、上限到達で誘導が出ることを確認。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(billing): hide overage UI under stores provider"
```

---

## Phase 7: 既存Stripe利用者の移行

### Task 14: 移行対象の抽出スクリプト（dry-run）

**Files:**
- Create: `scripts/stores-migration-report.mjs`

現在の有料ユーザー（`stripeSubscriptionId != null` かつ `plan != free`）と `planExpiresAt` を一覧出力。送信前の現状把握（読み取りのみ）。

- [ ] **Step 1: スクリプト作成**

`scripts/stores-migration-report.mjs`:

```js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  where: { plan: { in: ["starter", "pro", "business"] } },
  select: { id: true, email: true, plan: true, planExpiresAt: true, stripeSubscriptionId: true },
  orderBy: { planExpiresAt: "asc" },
});

console.log(`paid users: ${users.length}`);
for (const u of users) {
  console.log([u.email, u.plan, u.planExpiresAt?.toISOString() ?? "-", u.stripeSubscriptionId ?? "-"].join("\t"));
}
await prisma.$disconnect();
```

- [ ] **Step 2: dev で実行・件数確認**

Run: `node scripts/stores-migration-report.mjs`
Expected: 現在の有料ユーザー一覧が表示される（読み取りのみ・変更なし）

- [ ] **Step 3: Commit**

```bash
git add scripts/stores-migration-report.mjs
git commit -m "chore(billing): add stores migration dry-run report script"
```

---

### Task 15: 告知バナー＋移行導線

**Files:**
- Create/Modify: アカウント/ダッシュボードに告知バナー（実装時に既存 `PaymentFailedBanner.tsx` のパターンを流用）

有料ユーザーへ「決済方法変更のお願い（次回更新からSTORES請求書）」を表示し、`/account/billing` の paymentUrl 導線へ誘導。`planExpiresAt` までは現状維持（猶予）。

- [ ] **Step 1: バナーコンポーネント作成（`PaymentFailedBanner` を雛形に）**

Read: `src/components/billing/PaymentFailedBanner.tsx` → 同型で `StoresMigrationNotice.tsx` を作成。表示条件: `provider==='stores'` かつ `plan!=='free'` かつ 当月 `Invoice` が `paid` でない。

- [ ] **Step 2: アカウント画面に差し込み**

既存バナー挿入箇所へ追加。

- [ ] **Step 3: 手動確認（dev）**

Run: `npm run dev` → 有料・未払い状態で告知が出ること。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(billing): add STORES migration notice banner for existing paid users"
```

---

## Phase 8: 顧客宛メール（任意・後追い可）

### Task 16: paymentUrl メール送付（Resend導入）

**Files:**
- Create: `src/lib/mail/resend.ts`
- Modify: `src/lib/billing/stores/issue-invoice.ts`（発行後にメール送信を呼ぶ）、`stores-renew` cron
- Test: `src/lib/mail/resend.test.ts`

> 現状コードに顧客宛メール基盤が無いため新規導入。Resend（`resend` npm）を採用。`RESEND_API_KEY`/`MAIL_FROM` を env 追加。最小: 件名＋本文＋paymentUrl リンク。

- [ ] **Step 1: 依存追加**

Run: `npm i resend`

- [ ] **Step 2: 失敗するテスト**

`src/lib/mail/resend.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const send = vi.fn();
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: (...a: unknown[]) => send(...a) } })) }));
import { sendInvoiceEmail } from "./resend";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.MAIL_FROM = "billing@autobanner.jp";
});

it("sends an email containing the payment url", async () => {
  send.mockResolvedValue({ id: "email_1" });
  await sendInvoiceEmail({ to: "u@example.com", plan: "Pro", paymentUrl: "https://pay/x" });
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ to: "u@example.com", from: "billing@autobanner.jp" }),
  );
  const arg = send.mock.calls[0][0] as { html: string };
  expect(arg.html).toContain("https://pay/x");
});
```

- [ ] **Step 3: 失敗確認**

Run: `npx vitest run src/lib/mail/resend.test.ts`
Expected: FAIL

- [ ] **Step 4: 実装**

`src/lib/mail/resend.ts`:

```ts
import { Resend } from "resend";

export interface InvoiceEmailParams {
  to: string;
  plan: string;
  paymentUrl: string;
}

export async function sendInvoiceEmail({ to, plan, paymentUrl }: InvoiceEmailParams) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) throw new Error("RESEND_API_KEY / MAIL_FROM is not set");
  const resend = new Resend(key);
  return resend.emails.send({
    to,
    from,
    subject: `【autobanner.jp】${plan} のお支払いのご案内`,
    html: `<p>autobanner.jp ${plan} のお支払いをお願いいたします。</p>
<p><a href="${paymentUrl}">こちらからカード決済</a></p>`,
  });
}
```

- [ ] **Step 5: 合格確認 → issue-invoice/renew から呼び出し**

Run: `npx vitest run src/lib/mail/resend.test.ts` → PASS。
その後 `issueInvoice` 発行成功時にユーザーemailへ `sendInvoiceEmail` を呼ぶ（メール送信失敗は invoice 発行を失敗させない＝try/catchでログのみ）。`.env.example` に `RESEND_API_KEY=`/`MAIL_FROM=` 追記。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(billing): email payment URL to customers on invoice issuance"
```

---

## Phase 9: 切替・本番反映

### Task 17: 統合スモーク（dev/test キー）

- [ ] **Step 1: 全テスト**

Run: `npx vitest run`
Expected: 全緑

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: 成功（Prisma generate＋Next build）

- [ ] **Step 3: dev でE2Eスモーク**

`PAYMENT_PROVIDER=stores`＋test キーで: アップグレード→STORES決済画面→（testカード決済 or PATCHで疑似paid）→webhook/poll→plan有効化→ダッシュボードでプラン反映、を一連で確認。

- [ ] **Step 4: Commit（必要なら微修正）**

```bash
git add -A
git commit -m "test(billing): integration smoke for stores provider"
```

### Task 18: 本番マイグレーション＆切替

- [ ] **Step 1: 本番DBへ Invoice マイグレーション適用**

Run: `node scripts/migrate-prod.mjs`（既存の本番マイグレーション手順）
Expected: `Invoice` テーブル・`User.storesCustomerId` が本番に作成される。

- [ ] **Step 2: 移行レポートで現状把握**

Run: 本番接続で `node scripts/stores-migration-report.mjs`（読み取りのみ）

- [ ] **Step 3: Vercel 本番 env を `PAYMENT_PROVIDER=stores`/`NEXT_PUBLIC_PAYMENT_PROVIDER=stores`/`STORES_*`(liveキー) に設定し再デプロイ**

注意: 既存 `STRIPE_*` は残す（ロールバック余地）。空コミット push で rebuild。

- [ ] **Step 4: 本番スモーク（少額・自分のアカウント）**

実カードで最小プランを1件決済 →webhook→plan有効化を確認。確認後、必要なら STORES 管理画面でキャンセル/返金。

- [ ] **Step 5: 既存有料ユーザーへ告知（Task15バナー＋Task16メール）を有効化**

---

## Self-Review（計画著者によるスペック突合）

- スペック「Invoice台帳・@@unique冪等・論理削除」→ Task1で実装 ✅
- 「stores-client（createInvoice/getPaymentStatus）」→ Task2 ✅
- 「課金フロー: 新規アップグレード」→ Task8/9 ✅
- 「支払い検知: webhook＋ポーリングfallback＋GET正本確認」→ Task5/6/7 ✅
- 「月次更新cron・督促・降格」→ Task10/11 ✅
- 「ハードキャップ移行（メータード撤廃）」→ Task12/13 ✅
- 「既存Stripe利用者の猶予→乗せ替え」→ Task14/15 ✅
- 「環境変数（PAYMENT_PROVIDER/STORES_API_KEY/WEBHOOK_SECRET）」→ Task1/9/18 ✅
- 「Stripeコード温存」→ 削除タスク無し・provider分岐のみ ✅
- 未検証ポイント①〜④ → 本計画冒頭で API 確定（webhook=`webhookUrl`あり/本文非公開→GET正本）✅
- 顧客宛メール（スペック未記載の発見事項）→ Task16として明示分離 ✅

型整合: `PaidPlan`(amounts.ts) を checkout/issue/renew で一貫使用。`reconcile` の STORES status enum は stores-client の `StoresStatus` に一致。Invoice.status 値（issued|paid|overdue|canceled）は全タスクで一貫。

未確定で実装時に現物確認が必要な接続点（明示）:
1. セッション/ユーザー取得方法（`getCurrentUserId` の中身）= 既存 checkout に準拠（Task8 Step1）
2. アップグレードボタンの実体（Task9 Step1）
3. Slack通知ユーティリティの関数名（Task11）
4. `ironclad-generate` のメータード呼び出し引数（Task12 Step1）
