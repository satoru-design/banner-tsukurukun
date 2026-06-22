import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = {
  invoice: { findMany: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
};
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
  // C1: user has no remaining entitlement → downgrade fires
  prisma.user.findUnique.mockResolvedValue({ planExpiresAt: null });
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

// C1: stale overdue invoice must NOT downgrade a user who has paid a later period
it("does not downgrade when user still has valid planExpiresAt (C1)", async () => {
  const old = new Date(Date.now() - 10 * 86400_000); // past due
  prisma.invoice.findMany.mockResolvedValue([
    { id: "inv_old", userId: "u3", status: "overdue", dueDate: old },
  ]);
  // User paid for a later period — planExpiresAt is in the future
  const futureExpiry = new Date(Date.now() + 30 * 86400_000);
  prisma.user.findUnique.mockResolvedValue({ planExpiresAt: futureExpiry });

  const r = await sweepOverdue(new Date());

  expect(prisma.user.update).not.toHaveBeenCalled();
  expect(r.downgraded).toHaveLength(0);
});
