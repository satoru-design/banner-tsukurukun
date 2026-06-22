import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { user: { findMany: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));
const issueInvoice = vi.fn();
vi.mock("@/lib/billing/stores/issue-invoice", () => ({ issueInvoice: (...a: unknown[]) => issueInvoice(...a) }));
const sweepOverdue = vi.fn();
vi.mock("@/lib/billing/stores/dunning", () => ({ sweepOverdue: (...a: unknown[]) => sweepOverdue(...a) }));

import { GET } from "@/app/api/cron/stores-renew/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cronsecret";
});
const authed = () =>
  new Request("https://x/api/cron/stores-renew", { headers: new Headers({ authorization: "Bearer cronsecret" }) });

it("401 without cron secret", async () => {
  const res = await GET(new Request("https://x", { headers: new Headers({ authorization: "Bearer nope" }) }));
  expect(res.status).toBe(401);
});

it("issues anniversary-based invoices for expiring paid users and runs the overdue sweep", async () => {
  const planExpiresAt = new Date("2026-06-25T00:00:00Z");
  prisma.user.findMany.mockResolvedValue([{ id: "u1", plan: "pro", planExpiresAt }]);
  issueInvoice.mockResolvedValue({ id: "inv_x" });
  sweepOverdue.mockResolvedValue({ downgraded: [] });
  const res = await GET(authed());
  expect(res.status).toBe(200);
  // periodStart should be planExpiresAt since it is in the future relative to now
  expect(issueInvoice).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "u1", plan: "pro", periodStart: planExpiresAt })
  );
  expect(sweepOverdue).toHaveBeenCalled();
});

it("uses startOfDayUTC(now) as periodStart when planExpiresAt is null (lapsed user)", async () => {
  prisma.user.findMany.mockResolvedValue([{ id: "u2", plan: "starter", planExpiresAt: null }]);
  issueInvoice.mockResolvedValue({ id: "inv_y" });
  sweepOverdue.mockResolvedValue({ downgraded: [] });
  await GET(authed());
  expect(issueInvoice).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "u2", periodStart: expect.any(Date) })
  );
});
