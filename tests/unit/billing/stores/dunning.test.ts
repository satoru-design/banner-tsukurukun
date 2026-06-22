import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { invoice: { findMany: vi.fn(), update: vi.fn() }, user: { update: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ getPrisma: () => prisma }));

import { sweepOverdue } from "@/lib/billing/stores/dunning";

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
