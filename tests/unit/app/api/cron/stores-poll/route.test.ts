import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { invoice: { findMany: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));
const reconcileInvoice = vi.fn();
vi.mock("@/lib/billing/stores/reconcile", () => ({ reconcileInvoice: (...a: unknown[]) => reconcileInvoice(...a) }));

import { GET } from "@/app/api/cron/stores-poll/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cronsecret";
});

const authed = () =>
  new Request("https://x/api/cron/stores-poll", { headers: new Headers({ authorization: "Bearer cronsecret" }) });

it("401 without valid cron secret", async () => {
  const res = await GET(new Request("https://x", { headers: new Headers({ authorization: "Bearer nope" }) }));
  expect(res.status).toBe(401);
});

it("reconciles each pending invoice", async () => {
  prisma.invoice.findMany.mockResolvedValue([{ id: "inv_1" }, { id: "inv_2" }]);
  reconcileInvoice.mockResolvedValue({});
  const res = await GET(authed());
  expect(res.status).toBe(200);
  expect(reconcileInvoice).toHaveBeenCalledTimes(2);
});
